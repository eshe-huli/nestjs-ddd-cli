import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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
  constructor(client, transactionActive = false) {
    this.client = client;
    if (transactionActive) this.queryRunner = { isTransactionActive: true };
  }

  async query(statement, parameters = []) {
    return this.client.unsafe(statement, parameters);
  }
}

class SqlDataSource extends SqlExecutor {
  async transaction(operation) {
    return this.client.begin((transaction) => operation(new SqlExecutor(transaction, true)));
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
  const fixtureModules = path.join(fixture, 'node_modules');
  await mkdir(fixtureModules);
  await symlink(
    path.join(repositoryRoot, 'node_modules/@nestjs'),
    path.join(fixtureModules, '@nestjs'),
  );
  const fixtureTypeorm = path.join(fixtureModules, 'typeorm');
  await mkdir(fixtureTypeorm);
  await writeFile(
    path.join(fixtureTypeorm, 'index.js'),
    `'use strict';
class DataSource {}
module.exports = { DataSource };
`,
  );

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
  const enqueue = (input) => dataSource.transaction((manager) => enqueuer.enqueue(manager, input));
  const intent = {
    projectionName: 'idempotency-v1',
    targetKey: 'subject-1',
    operationKind: 'upsert',
    idempotencyKey: 'command-1',
    payload: { displayName: 'Ada', details: { country: 'CI', active: true } },
  };
  await assert.rejects(enqueuer.enqueue(dataSource, intent), /active transaction-bound/);
  const [first, replay] = await Promise.all([
    enqueue(intent),
    enqueue({
      ...intent,
      payload: { details: { active: true, country: 'CI' }, displayName: 'Ada' },
    }),
  ]);
  assert.equal(first.operation.id, replay.operation.id);
  assert.equal(Number(first.created) + Number(replay.created), 1);
  await assert.rejects(
    enqueue({ ...intent, payload: { displayName: 'Grace' } }),
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
  const idempotencyClaim = await store.claimNext('idempotency-v1', 'worker-idempotency', 30, 5);
  assert.ok(idempotencyClaim);
  assert.equal(idempotencyClaim.claimReason, 'fresh');
  assert.equal(idempotencyClaim.reconciliationRequired, false);
  assert.equal(await store.markApplied(idempotencyClaim, 'idempotency-result'), true);

  await Promise.all([
    enqueue({
      ...intent,
      projectionName: 'route-a',
      targetKey: 'shared-target',
      idempotencyKey: 'route-a-command',
    }),
    enqueue({
      ...intent,
      projectionName: 'route-b',
      targetKey: 'shared-target',
      idempotencyKey: 'route-b-command',
    }),
  ]);
  const [routeA, routeB] = await Promise.all([
    store.claimNext('route-a', 'route-worker-a', 30, 5),
    store.claimNext('route-b', 'route-worker-b', 30, 5),
  ]);
  assert.ok(routeA);
  assert.ok(routeB);
  assert.equal(routeA.projectionName, 'route-a');
  assert.equal(routeB.projectionName, 'route-b');
  assert.equal(await store.claimNext('route-a', 'route-worker-cross-check', 30, 5), null);
  assert.equal(await store.markApplied(routeA, 'route-a-result'), true);
  assert.equal(await store.markApplied(routeB, 'route-b-result'), true);

  const firstOrdered = await enqueue({
    ...intent,
    projectionName: 'ordered-v1',
    targetKey: 'ordered-target',
    idempotencyKey: 'ordered-command-1',
    payload: { sequence: 1 },
  });
  const secondOrdered = await enqueue({
    ...intent,
    projectionName: 'ordered-v1',
    targetKey: 'ordered-target',
    idempotencyKey: 'ordered-command-2',
    payload: { sequence: 2 },
  });
  const concurrentOrderedClaims = await Promise.all([
    store.claimNext('ordered-v1', 'ordered-worker-a', 30, 5),
    store.claimNext('ordered-v1', 'ordered-worker-b', 30, 5),
  ]);
  const claimed = concurrentOrderedClaims.find(Boolean);
  assert.ok(claimed);
  assert.equal(claimed.id, firstOrdered.operation.id);
  assert.equal(concurrentOrderedClaims.filter(Boolean).length, 1);
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
  const reclaimed = await store.claimNext('ordered-v1', 'ordered-worker-c', 30, 5);
  assert.ok(reclaimed);
  assert.equal(reclaimed.id, claimed.id);
  assert.equal(reclaimed.claimReason, 'expired_lease_recovery');
  assert.equal(reclaimed.previousStatus, 'processing');
  assert.equal(reclaimed.reconciliationRequired, true);
  assert.notEqual(reclaimed.leaseToken, claimed.leaseToken);
  assert.equal(await store.markApplied(claimed, 'stale-reference'), false);
  await assert.rejects(store.markApplied(reclaimed, '   '), /result reference is invalid/);
  assert.equal(await store.markApplied(reclaimed, 'provider-reference'), true);
  const orderedSecondClaim = await store.claimNext('ordered-v1', 'ordered-worker-d', 30, 5);
  assert.ok(orderedSecondClaim);
  assert.equal(orderedSecondClaim.id, secondOrdered.operation.id);
  assert.equal(await store.markApplied(orderedSecondClaim, 'ordered-second-result'), true);

  await enqueue({
    ...intent,
    projectionName: 'uncertain-v1',
    targetKey: 'uncertain-target',
    idempotencyKey: 'uncertain-command',
  });
  const uncertainInitial = await store.claimNext('uncertain-v1', 'uncertain-worker-a', 30, 5);
  assert.ok(uncertainInitial);
  assert.equal(
    await store.markFailure(uncertainInitial, {
      disposition: 'uncertain',
      errorCode: 'PROVIDER_RESULT_UNKNOWN',
      nextAttemptAt: new Date(Date.now() - 1_000),
    }),
    true,
  );
  const uncertainRecovery = await store.claimNext('uncertain-v1', 'uncertain-worker-b', 30, 5);
  assert.ok(uncertainRecovery);
  assert.equal(uncertainRecovery.claimReason, 'uncertain_recovery');
  assert.equal(uncertainRecovery.previousStatus, 'uncertain');
  assert.equal(uncertainRecovery.previousErrorCode, 'PROVIDER_RESULT_UNKNOWN');
  assert.equal(uncertainRecovery.reconciliationRequired, true);
  assert.equal(await store.markApplied(uncertainRecovery, 'uncertain-reconciled'), true);

  const crashFirst = await enqueue({
    ...intent,
    projectionName: 'crash-limit-v1',
    targetKey: 'crash-target',
    idempotencyKey: 'crash-command-1',
  });
  await enqueue({
    ...intent,
    projectionName: 'crash-limit-v1',
    targetKey: 'crash-target',
    idempotencyKey: 'crash-command-2',
  });
  const crashClaim = await store.claimNext('crash-limit-v1', 'crash-worker-a', 30, 1);
  assert.ok(crashClaim);
  assert.equal(crashClaim.id, crashFirst.operation.id);
  await sql.unsafe(
    `UPDATE external_projection_operations
     SET lease_expires_at = now() - interval '1 second'
     WHERE id = $1`,
    [crashClaim.id],
  );
  assert.equal(await store.claimNext('crash-limit-v1', 'crash-worker-b', 30, 1), null);
  const exhausted = await sql.unsafe(
    `SELECT status, last_error_code
     FROM external_projection_operations
     WHERE id = $1`,
    [crashClaim.id],
  );
  assert.deepEqual(exhausted[0], {
    status: 'blocked',
    last_error_code: 'MAX_ATTEMPTS_EXHAUSTED',
  });
  assert.equal(await store.markApplied(crashClaim, 'stale-crash-result'), false);

  for (const suffix of ['1', '2', '3']) {
    await enqueue({
      ...intent,
      projectionName: 'dispositions-v1',
      targetKey: `disposition-target-${suffix}`,
      idempotencyKey: `disposition-command-${suffix}`,
      payload: { sequence: Number(suffix) },
    });
  }
  const [retryClaim, uncertainClaim] = await Promise.all([
    store.claimNext('dispositions-v1', 'disposition-worker-a', 30, 5),
    store.claimNext('dispositions-v1', 'disposition-worker-b', 30, 5),
  ]);
  assert.ok(retryClaim);
  assert.ok(uncertainClaim);
  assert.notEqual(retryClaim.id, uncertainClaim.id);
  assert.equal(
    await store.markFailure(retryClaim, {
      disposition: 'retry_wait',
      errorCode: 'PROVIDER_UNAVAILABLE',
      nextAttemptAt: new Date(Date.now() - 1_000),
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
  const retryRecovery = await store.claimNext('dispositions-v1', 'disposition-worker-retry', 30, 5);
  assert.ok(retryRecovery);
  assert.equal(retryRecovery.id, retryClaim.id);
  assert.equal(retryRecovery.claimReason, 'retry');
  assert.equal(retryRecovery.reconciliationRequired, false);
  assert.equal(retryRecovery.previousErrorCode, 'PROVIDER_UNAVAILABLE');
  assert.equal(await store.markApplied(retryRecovery, 'retry-result'), true);

  const blockedClaim = await store.claimNext(
    'dispositions-v1',
    'disposition-worker-blocked',
    30,
    5,
  );
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
     WHERE projection_name = 'dispositions-v1'
     GROUP BY status`,
  );
  assert.deepEqual(Object.fromEntries(states.map((row) => [row.status, Number(row.count)])), {
    applied: 1,
    blocked: 1,
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
