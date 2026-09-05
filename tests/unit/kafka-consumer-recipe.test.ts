import * as fs from 'fs-extra';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vm from 'node:vm';
import * as ts from 'typescript';
import { applyKafkaConsumerRecipe } from '../../src/commands/recipes/kafka-consumer.recipe';
import { applyRecipe } from '../../src/commands/recipe';

describe('Kafka consumer recipe', () => {
  let root: string;
  const target = 'src/shared/kafka-consumer/kafka-consumer.ts';
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-kafka-'));
  });
  afterEach(async () => {
    await fs.remove(root);
  });

  it('previews without writing and reruns without replacing adaptations', async () => {
    await applyKafkaConsumerRecipe(root, true);
    expect(await fs.readdir(root)).toEqual([]);
    await applyKafkaConsumerRecipe(root);
    await applyKafkaConsumerRecipe(root);
    await fs.writeFile(path.join(root, target), '// owned adaptation');
    await expect(applyKafkaConsumerRecipe(root)).rejects.toThrow('already differs');
    expect(await fs.readFile(path.join(root, target), 'utf8')).toBe('// owned adaptation');
  });

  it('dispatches a no-write preview and rejects inherited recipe names', async () => {
    await applyRecipe('kafka-consumer', { path: root, dryRun: true, installDeps: true });
    await applyRecipe('toString', { path: root });
    expect(await fs.readdir(root)).toEqual([]);
  });

  async function runtime() {
    await applyKafkaConsumerRecipe(root);
    const content = await fs.readFile(path.join(root, target), 'utf8');
    const result = ts.transpileModule(content, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        experimentalDecorators: true,
      },
      reportDiagnostics: true,
    });
    expect(result.diagnostics).toEqual([]);
    const consumer = {
      connect: jest.fn(async () => undefined),
      subscribe: jest.fn(async () => undefined),
      run: jest.fn(async (_config: unknown) => undefined),
      commitOffsets: jest.fn(async (_offsets: unknown) => undefined),
      stop: jest.fn(async () => undefined),
      disconnect: jest.fn(async () => undefined),
    };
    const module = { exports: {} as Record<string, unknown> };
    vm.runInNewContext(result.outputText, {
      exports: module.exports,
      module,
      Buffer,
      require: (name: string) => {
        if (name === 'node:crypto') return require('node:crypto');
        if (name === '@nestjs/common')
          return {
            Injectable: () => () => undefined,
            Inject: () => () => undefined,
            Module: () => () => undefined,
          };
        if (name === 'kafkajs')
          return {
            Kafka: class {
              consumer() {
                return consumer;
              }
            },
          };
        if (name === 'typeorm') return {};
        throw new Error(`Unexpected import ${name}`);
      },
    });
    return {
      KafkaMessageProcessor: module.exports['KafkaMessageProcessor'] as new (
        ...args: unknown[]
      ) => {
        process(input: unknown): Promise<void>;
      },
      KafkaConsumerLifecycle: module.exports['KafkaConsumerLifecycle'] as new (
        ...args: unknown[]
      ) => {
        onApplicationBootstrap(): Promise<void>;
        onApplicationShutdown(): Promise<void>;
      },
      consumer,
    };
  }

  const options = {
    groupId: 'projection-v1',
    topics: ['domain.events.v1'],
    fromBeginning: true,
    kafka: {},
  };
  const message = () => ({
    topic: options.topics[0],
    partition: 0,
    message: {
      offset: '9007199254740999',
      headers: { id: Buffer.from('event-1') },
      key: Buffer.from('aggregate-1'),
      value: Buffer.from('{"revision":2}'),
    },
    heartbeat: jest.fn(async () => undefined),
  });

  it('commits the receipt and handler together; skips matching duplicates', async () => {
    const { KafkaMessageProcessor } = await runtime();
    let hash: string | undefined;
    const manager = {
      query: jest.fn(async (sql: string, args: string[]) => {
        if (sql.startsWith('SELECT')) return [{ payload_hash: hash }];
        if (hash) return [];
        hash = args[2];
        return [{ event_id: args[1] }];
      }),
    };
    const dataSource = { transaction: async (run: (m: unknown) => Promise<void>) => run(manager) };
    const handler = { handle: jest.fn(async () => undefined) };
    const processor = new KafkaMessageProcessor(dataSource, options, handler);
    const input = message();
    await processor.process(input);
    await processor.process(input);
    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(handler.handle).toHaveBeenCalledWith(input, manager);
    input.message.value = Buffer.from('{"revision":3}');
    await expect(processor.process(input)).rejects.toThrow('identity conflict');
  });

  it('rejects invalid identity before opening the transaction', async () => {
    const { KafkaMessageProcessor } = await runtime();
    const transaction = jest.fn();
    const processor = new KafkaMessageProcessor({ transaction }, options, { handle: jest.fn() });
    const input = message();
    input.message.headers.id = Buffer.from('');
    await expect(processor.process(input)).rejects.toThrow('stable outbox id');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('acknowledges only after successful processing, preserving large offsets', async () => {
    const { KafkaConsumerLifecycle, consumer } = await runtime();
    const process = jest.fn(async () => undefined);
    const lifecycle = new KafkaConsumerLifecycle(options, { process });
    await lifecycle.onApplicationBootstrap();
    const config = consumer.run.mock.calls[0]?.[0] as {
      autoCommit: boolean;
      eachMessage: (m: unknown) => Promise<void>;
    };
    expect(config.autoCommit).toBe(false);
    const input = message();
    await config.eachMessage(input);
    expect(consumer.commitOffsets).toHaveBeenCalledWith([
      { topic: input.topic, partition: 0, offset: '9007199254741000' },
    ]);
    consumer.commitOffsets.mockClear();
    process.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(config.eachMessage(input)).rejects.toThrow('database unavailable');
    expect(consumer.commitOffsets).not.toHaveBeenCalled();
    await lifecycle.onApplicationShutdown();
    expect(consumer.stop).toHaveBeenCalledTimes(1);
    expect(consumer.disconnect).toHaveBeenCalledTimes(1);
  });
});
