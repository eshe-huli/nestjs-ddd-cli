import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SQL } from 'bun';
import { applyExternalProjectionWorkerRecipe } from '../../src/commands/recipes/external-projection-worker.recipe.ts';
import { resetConfigCache } from '../../src/utils/config.utils.ts';

const databaseUrl = process.env.EXTERNAL_PROJECTION_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('EXTERNAL_PROJECTION_TEST_DATABASE_URL is required');
}

const repositoryRoot = path.resolve(import.meta.dir, '../..');
const fixture = await mkdtemp(path.join(os.tmpdir(), 'ddd-external-projection-pg-'));
const sql = new SQL(databaseUrl, { max: 8 });

class SqlExecutor {
  constructor(client) {
    this.client = client;
  }

  async query(statement, parameters = []) {
    return this.client.unsafe(statement, parameters);
  }
}

class SqlDataSource extends SqlExecutor {
  async transaction(operation) {
    return this.client.begin((transaction) => operation(new SqlExecutor(transaction)));
  }
}

try {
  await writeFile(
    path.join(fixture, '.dddrc.json'),
    JSON.stringify({ orm: 'typeorm', database: 'postgres' }),
  );
  resetConfigCache();
  await applyExternalProjectionWorkerRecipe(fixture, {
    migrationTimestamp: '1790000000000',
  });
  await symlink(path.join(repositoryRoot, 'node_modules'), path.join(fixture, 'node_modules'));

  const generated = path.join(fixture, 'src/shared/external-projection-worker');
  const migrationModule = await import(
    pathToFileURL(
      path.join(fixture, 'src/migrations/1790000000000-CreateExternalProjectionOperations.ts'),
    ).href
  );
  const enqueuerModule = await import(
    pathToFileURL(path.join(generated, 'external-projection-enqueuer.ts')).href
  );
  const storeModule = await import(
    pathToFileURL(path.join(generated, 'external-projection-store.ts')).href
  );
  const migration = new migrationModule.CreateExternalProjectionOperations1790000000000();
  const dataSource = new SqlDataSource(sql);
  await migration.up(dataSource);

  const enqueuer = new enqueuerModule.ExternalProjectionEnqueuer();
  const intent = {
    projectionName: 'directory-v1',
    targetKey: 'subject-1',
    operationKind: 'upsert',
    idempotencyKey: 'command-1',
    payload: { displayName: 'Ada', details: { country: 'CI', active: true } },
  };
  const [first, replay] = await Promise.all([
    dataSource.transaction((manager) => enqueuer.enqueue(manager, intent)),
    dataSource.transaction((manager) =>
      enqueuer.enqueue(manager, {
        ...intent,
        payload: { details: { active: true, country: 'CI' }, displayName: 'Ada' },
      }),
    ),
  ]);
  assert.equal(first.operation.id, replay.operation.id);
  assert.equal(Number(first.created) + Number(replay.created), 1);
  await assert.rejects(
    dataSource.transaction((manager) =>
      enqueuer.enqueue(manager, { ...intent, payload: { displayName: 'Grace' } }),
    ),
    /idempotency key was reused/,
  );
  await assert.rejects(
    dataSource.transaction(async (manager) => {
      await enqueuer.enqueue(manager, {
        ...intent,
        targetKey: 'rolled-back-subject',
        idempotencyKey: 'rolled-back-command',
      });
      throw new Error('rollback proof');
    }),
    /rollback proof/,
  );
  const rolledBack = await sql.unsafe(
    `SELECT count(*)::int AS count
     FROM external_projection_operations
     WHERE idempotency_key = 'rolled-back-command'`,
  );
  assert.equal(Number(rolledBack[0]?.count), 0);

  const store = new storeModule.ExternalProjectionStore(dataSource);
  const claimed = await store.claimNext('worker-a', 30);
  assert.ok(claimed);
  assert.equal(await store.renewLease(claimed, 30), true);
  assert.equal(
    await store.renewLease({ ...claimed, leaseToken: '33333333-3333-4333-8333-333333333333' }, 30),
    false,
  );
  await sql.unsafe(
    `UPDATE external_projection_operations
     SET lease_expires_at = now() - interval '1 second'
     WHERE id = $1`,
    [claimed.id],
  );
  const reclaimed = await store.claimNext('worker-b', 30);
  assert.ok(reclaimed);
  assert.equal(reclaimed.id, claimed.id);
  assert.notEqual(reclaimed.leaseToken, claimed.leaseToken);
  assert.equal(await store.markApplied(claimed, 'stale-reference'), false);
  assert.equal(await store.markApplied(reclaimed, 'provider-reference'), true);

  for (const suffix of ['2', '3', '4']) {
    await dataSource.transaction((manager) =>
      enqueuer.enqueue(manager, {
        ...intent,
        targetKey: `subject-${suffix}`,
        idempotencyKey: `command-${suffix}`,
        payload: { sequence: Number(suffix) },
      }),
    );
  }
  const [retryClaim, uncertainClaim] = await Promise.all([
    store.claimNext('worker-c', 30),
    store.claimNext('worker-d', 30),
  ]);
  assert.ok(retryClaim);
  assert.ok(uncertainClaim);
  assert.notEqual(retryClaim.id, uncertainClaim.id);
  assert.equal(
    await store.markFailure(retryClaim, {
      disposition: 'retry_wait',
      errorCode: 'PROVIDER_UNAVAILABLE',
      nextAttemptAt: new Date(Date.now() + 60_000),
    }),
    true,
  );
  assert.equal(
    await store.markFailure(uncertainClaim, {
      disposition: 'uncertain',
      errorCode: 'PROVIDER_RESULT_UNKNOWN',
      nextAttemptAt: new Date(Date.now() + 60_000),
    }),
    true,
  );
  const blockedClaim = await store.claimNext('worker-e', 30);
  assert.ok(blockedClaim);
  assert.equal(
    await store.markFailure(blockedClaim, {
      disposition: 'blocked',
      errorCode: 'OPERATOR_REVIEW_REQUIRED',
    }),
    true,
  );

  const states = await sql.unsafe(
    `SELECT status, count(*)::int AS count
     FROM external_projection_operations
     GROUP BY status`,
  );
  assert.deepEqual(Object.fromEntries(states.map((row) => [row.status, Number(row.count)])), {
    applied: 1,
    blocked: 1,
    retry_wait: 1,
    uncertain: 1,
  });

  await migration.down(dataSource);
  const relation = await sql.unsafe(
    `SELECT to_regclass('public.external_projection_operations') AS relation`,
  );
  assert.equal(relation[0]?.relation, null);
  console.log('external projection disposable PostgreSQL proof passed');
} finally {
  await sql.close();
  resetConfigCache();
  await rm(fixture, { recursive: true, force: true });
}
