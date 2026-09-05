// Run with Bun against a generated, tsc-built fixture with its own dependencies.
// Requires a disposable loopback PostgreSQL database named kafka_proof and Kafka.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const fixture = process.argv[2];
if (!fixture) throw new Error('Pass the absolute generated fixture directory');
const databaseUrl = new URL(
  process.env.KAFKA_PROOF_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:32768/kafka_proof',
);
if (
  !['127.0.0.1', 'localhost'].includes(databaseUrl.hostname) ||
  databaseUrl.pathname !== '/kafka_proof'
) {
  throw new Error('This destructive fixture requires a dedicated loopback kafka_proof database');
}
const broker = process.env.KAFKA_PROOF_BROKER ?? '127.0.0.1:39092';
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(broker)) throw new Error('Test broker must be loopback');
const require = createRequire(resolve(fixture, 'package.json'));
require('reflect-metadata');
const { DataSource } = require('typeorm');
const { Kafka, logLevel } = require('kafkajs');
const { KafkaMessageProcessor, KafkaConsumerLifecycle } = require(
  resolve(fixture, 'dist/shared/kafka-consumer/kafka-consumer.js'),
);
const { KafkaConsumerReceipts1788600000000 } = require(
  resolve(fixture, 'dist/migrations/1788600000000-KafkaConsumerReceipts.js'),
);
const database = new DataSource({ type: 'postgres', url: databaseUrl.toString() });
const config = { clientId: 'ddd-proof', brokers: [broker], logLevel: logLevel.NOTHING };
const kafka = new Kafka(config);
const admin = kafka.admin();
const producer = kafka.producer();
const suffix = Date.now().toString();
const topic = `ddd.recipe.proof.${suffix}`;
const options = {
  groupId: `ddd-proof-${suffix}`,
  topics: [topic],
  fromBeginning: true,
  kafka: config,
};
let lifecycle;
let migrated = false;
let projectionCreated = false;
await database.initialize();
const runner = database.createQueryRunner();
const migration = new KafkaConsumerReceipts1788600000000();
const input = (id, revision = 2) => ({
  topic,
  partition: 0,
  message: {
    key: Buffer.from('aggregate'),
    value: Buffer.from(JSON.stringify({ revision })),
    headers: { id: Buffer.from(id) },
    offset: '0',
  },
});
const handler = {
  handle: async (message, manager) => {
    const content = JSON.parse(message.message.value.toString());
    assert.ok(Number.isInteger(content.revision));
    await manager.query(
      'INSERT INTO proof_projection VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET revision=GREATEST(proof_projection.revision,EXCLUDED.revision)',
      [message.message.key.toString(), content.revision],
    );
  },
};
const processor = new KafkaMessageProcessor(database, options, handler);
const count = async () =>
  (await runner.query('SELECT count(*)::int AS count FROM kafka_consumer_receipts'))[0].count;
async function waitFor(predicate) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error('Kafka proof timed out');
}
try {
  await migration.up(runner);
  migrated = true;
  await runner.query('CREATE TABLE proof_projection (id text PRIMARY KEY, revision int NOT NULL)');
  projectionCreated = true;
  await Promise.all(Array.from({ length: 8 }, () => processor.process(input('concurrent'))));
  assert.equal(await count(), 1);
  await assert.rejects(processor.process(input('concurrent', 3)), /identity conflict/);
  const failed = new KafkaMessageProcessor(database, options, {
    handle: async (message, manager) => {
      await handler.handle(message, manager);
      throw new Error('simulated database handler failure');
    },
  });
  await assert.rejects(failed.process(input('rollback', 99)), /simulated/);
  assert.equal(await count(), 1);
  assert.equal((await runner.query('SELECT revision FROM proof_projection'))[0].revision, 2);
  await processor.process(input('rollback'));
  await new KafkaMessageProcessor(database, options, handler).process(input('rollback'));
  assert.equal(await count(), 2);
  await admin.connect();
  await admin.createTopics({
    topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
    waitForLeaders: true,
  });
  await producer.connect();
  lifecycle = new KafkaConsumerLifecycle(options, processor);
  await lifecycle.onApplicationBootstrap();
  const record = (id, revision) => ({
    key: 'aggregate',
    value: JSON.stringify({ revision }),
    headers: { id },
  });
  await producer.send({ topic, messages: [record('one', 3), record('one', 3), record('two', 1)] });
  await waitFor(async () => (await count()) === 4);
  await waitFor(
    async () =>
      (await admin.fetchOffsets({ groupId: options.groupId, topics: [topic] }))[0]?.partitions[0]
        ?.offset === '3',
  );
  assert.equal((await runner.query('SELECT revision FROM proof_projection'))[0].revision, 3);
  await lifecycle.onApplicationShutdown();
  lifecycle = new KafkaConsumerLifecycle(options, processor);
  await lifecycle.onApplicationBootstrap();
  await producer.send({ topic, messages: [record('one', 3), record('three', 4)] });
  await waitFor(async () => (await count()) === 5);
  await waitFor(
    async () =>
      (await admin.fetchOffsets({ groupId: options.groupId, topics: [topic] }))[0]?.partitions[0]
        ?.offset === '5',
  );
  await lifecycle.onApplicationShutdown();
  lifecycle = undefined;
  await migration.down(runner);
  migrated = false;
  assert.equal(
    (await runner.query("SELECT to_regclass('kafka_consumer_receipts') AS name"))[0].name,
    null,
  );
  console.log(
    'PASS: PostgreSQL concurrency/rollback/replay/reversal; Kafka delivery/duplicates/offsets/restart/shutdown',
  );
} finally {
  await lifecycle?.onApplicationShutdown();
  await producer.disconnect();
  await admin.disconnect();
  if (projectionCreated) await runner.query('DROP TABLE proof_projection');
  if (migrated) await migration.down(runner);
  await runner.release();
  await database.destroy();
}
