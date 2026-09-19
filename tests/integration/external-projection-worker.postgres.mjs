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
  const workerModule = await import(
    pathToFileURL(path.join(generated, 'external-projection-worker.ts')).href
  );
  const migration = new migrationModule.CreateExternalProjectionOperations1790000000000();
  const dataSource = new SqlDataSource(sql);
  await migration.up(dataSource);

  const enqueuer = new enqueuerModule.ExternalProjectionEnqueuer();
  const enqueue = (input) => dataSource.transaction((manager) => enqueuer.enqueue(manager, input));
  const store = new storeModule.ExternalProjectionStore(dataSource);
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
  assert.equal(first.operation.payload.displayName, 'Ada');
  assert.equal(first.operation.payload.details.active, true);
  assert.equal(first.operation.payload.details.country, 'CI');
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

  const firstRelease = deferred();
  const firstEnqueued = deferred();
  const firstTransaction = dataSource
    .transaction(async (manager) => {
      await manager.query(`SELECT set_config('application_name', $1, true)`, [
        'external-projection-order-a',
      ]);
      const result = await enqueuer.enqueue(manager, {
        ...intent,
        projectionName: 'transaction-order-v1',
        targetKey: 'serialized-target',
        idempotencyKey: 'transaction-order-command-1',
        payload: { sequence: 1 },
      });
      firstEnqueued.resolve(result);
      await firstRelease.promise;
      return result;
    })
    .catch((error) => {
      firstEnqueued.reject(error);
      throw error;
    });
  const firstUncommitted = await firstEnqueued.promise;
  const secondStarted = deferred();
  const secondTransaction = dataSource
    .transaction(async (manager) => {
      await manager.query(`SELECT set_config('application_name', $1, true)`, [
        'external-projection-order-b',
      ]);
      secondStarted.resolve();
      const result = await enqueuer.enqueue(manager, {
        ...intent,
        projectionName: 'transaction-order-v1',
        targetKey: 'serialized-target',
        idempotencyKey: 'transaction-order-command-2',
        payload: { sequence: 2 },
      });
      return result;
    })
    .catch((error) => {
      secondStarted.reject(error);
      throw error;
    });
  try {
    await secondStarted.promise;
    await waitForDatabaseLock(sql, 'external-projection-order-b');
    assert.equal(
      await store.claimNext('transaction-order-v1', 'transaction-order-worker-early', 30, 5),
      null,
    );
  } finally {
    firstRelease.resolve();
  }
  const [firstCommitted, secondCommitted] = await withTimeout(
    Promise.all([firstTransaction, secondTransaction]),
    5_000,
    'same-target enqueue transactions deadlocked',
  );
  assert.equal(firstCommitted.operation.id, firstUncommitted.operation.id);
  assert.notEqual(firstCommitted.operation.id, secondCommitted.operation.id);
  const transactionOrderedFirst = await store.claimNext(
    'transaction-order-v1',
    'transaction-order-worker-a',
    30,
    5,
  );
  assert.ok(transactionOrderedFirst);
  assert.equal(transactionOrderedFirst.id, firstCommitted.operation.id);
  assert.equal(
    await store.markApplied(transactionOrderedFirst, 'transaction-order-result-1'),
    true,
  );
  const transactionOrderedSecond = await store.claimNext(
    'transaction-order-v1',
    'transaction-order-worker-b',
    30,
    5,
  );
  assert.ok(transactionOrderedSecond);
  assert.equal(transactionOrderedSecond.id, secondCommitted.operation.id);
  assert.equal(
    await store.markApplied(transactionOrderedSecond, 'transaction-order-result-2'),
    true,
  );

  const exponentPayload = Array.from({ length: 2_000 }, () => 1e308);
  const exponentOperation = await enqueue({
    ...intent,
    projectionName: 'numeric-expansion-v1',
    targetKey: 'numeric-expansion-target',
    idempotencyKey: 'numeric-expansion-command',
    payload: exponentPayload,
  });
  const exponentStored = await sql.unsafe(
    `SELECT octet_length(payload::text)::int AS rendered_bytes, status
     FROM external_projection_operations
     WHERE id = $1`,
    [exponentOperation.operation.id],
  );
  assert.ok(
    Number(exponentStored[0]?.rendered_bytes) > 524_288,
    `expected PostgreSQL exponent expansion beyond 512 KiB, received ${exponentStored[0]?.rendered_bytes}`,
  );
  assert.equal(exponentStored[0]?.status, 'pending');

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

  let timeoutExecuteCalls = 0;
  let timeoutReconcileCalls = 0;
  let timeoutExternalEffects = 0;
  await enqueue({
    ...intent,
    projectionName: 'effect-timeout-v1',
    targetKey: 'effect-timeout-target',
    idempotencyKey: 'effect-timeout-command',
  });
  const timeoutWorker = new workerModule.ExternalProjectionWorker(
    store,
    {
      async execute() {
        timeoutExecuteCalls += 1;
        timeoutExternalEffects += 1;
        throw new Error('timeout after external effect');
      },
      async reconcile(operation) {
        timeoutReconcileCalls += 1;
        assert.equal(operation.claimReason, 'uncertain_recovery');
        assert.equal(timeoutExternalEffects, 1);
        return { disposition: 'applied', resultReference: 'effect-timeout-readback' };
      },
    },
    workerOptions('effect-timeout-v1'),
  );
  assert.equal(await timeoutWorker.runOnce(), 1);
  const timeoutUncertain = await projectionState(sql, 'effect-timeout-v1');
  assert.deepEqual(timeoutUncertain, {
    attempt_count: 1,
    last_error_code: 'UNEXPECTED_EXECUTION_FAILURE',
    status: 'uncertain',
  });
  await makeProjectionReady(sql, 'effect-timeout-v1');
  assert.equal(await timeoutWorker.runOnce(), 1);
  assert.equal(timeoutExecuteCalls, 1);
  assert.equal(timeoutReconcileCalls, 1);
  assert.equal(timeoutExternalEffects, 1);
  assert.equal((await projectionState(sql, 'effect-timeout-v1')).status, 'applied');
  await timeoutWorker.onApplicationShutdown();

  let finalRenewalExecuteCalls = 0;
  let finalRenewalReconcileCalls = 0;
  let throwFinalRenewal = true;
  await enqueue({
    ...intent,
    projectionName: 'final-renewal-v1',
    targetKey: 'final-renewal-target',
    idempotencyKey: 'final-renewal-command',
  });
  const finalRenewalStore = {
    claimNext: (...arguments_) => store.claimNext(...arguments_),
    async renewLease(...arguments_) {
      if (throwFinalRenewal) {
        throwFinalRenewal = false;
        throw new Error('final renewal transport failure');
      }
      return store.renewLease(...arguments_);
    },
    markApplied: (...arguments_) => store.markApplied(...arguments_),
    markFailure: (...arguments_) => store.markFailure(...arguments_),
  };
  const finalRenewalWorker = new workerModule.ExternalProjectionWorker(
    finalRenewalStore,
    {
      async execute() {
        finalRenewalExecuteCalls += 1;
        return { disposition: 'applied', resultReference: 'final-renewal-effect' };
      },
      async reconcile(operation) {
        finalRenewalReconcileCalls += 1;
        assert.equal(operation.claimReason, 'uncertain_recovery');
        return { disposition: 'applied', resultReference: 'final-renewal-readback' };
      },
    },
    workerOptions('final-renewal-v1'),
  );
  assert.equal(await finalRenewalWorker.runOnce(), 1);
  const finalRenewalUncertain = await projectionState(sql, 'final-renewal-v1');
  assert.deepEqual(finalRenewalUncertain, {
    attempt_count: 1,
    last_error_code: 'UNEXPECTED_EXECUTION_FAILURE',
    status: 'uncertain',
  });
  await makeProjectionReady(sql, 'final-renewal-v1');
  assert.equal(await finalRenewalWorker.runOnce(), 1);
  assert.equal(finalRenewalExecuteCalls, 1);
  assert.equal(finalRenewalReconcileCalls, 1);
  assert.equal((await projectionState(sql, 'final-renewal-v1')).status, 'applied');
  await finalRenewalWorker.onApplicationShutdown();

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
    `SELECT to_regclass('public.external_projection_operations') AS operations,
            to_regclass('public.external_projection_target_heads') AS target_heads`,
  );
  assert.deepEqual(relation[0], { operations: null, target_heads: null });
  console.log('external projection disposable PostgreSQL proof passed');
} finally {
  await sql.close();
  resetConfigCache();
  await rm(fixture, { recursive: true, force: true });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function waitForDatabaseLock(client, applicationName) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const rows = await client.unsafe(
      `SELECT wait_event_type
       FROM pg_stat_activity
       WHERE application_name = $1 AND state = 'active'`,
      [applicationName],
    );
    if (rows.some(({ wait_event_type: waitEventType }) => waitEventType === 'Lock')) return;
    await Bun.sleep(20);
  }
  throw new Error(`${applicationName} did not wait on the target serialization lock`);
}

async function withTimeout(promise, milliseconds, message) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function workerOptions(projectionName) {
  return {
    projectionName,
    enabled: false,
    pollIntervalMs: 1_000,
    batchSize: 1,
    leaseSeconds: 30,
    maxAttempts: 5,
    retryBaseMs: 100,
    retryMaxMs: 5_000,
  };
}

async function makeProjectionReady(client, projectionName) {
  await client.unsafe(
    `UPDATE external_projection_operations
     SET next_attempt_at = now() - interval '1 second'
     WHERE projection_name = $1 AND status = 'uncertain'`,
    [projectionName],
  );
}

async function projectionState(client, projectionName) {
  const rows = await client.unsafe(
    `SELECT attempt_count::int, last_error_code, status
     FROM external_projection_operations
     WHERE projection_name = $1`,
    [projectionName],
  );
  assert.equal(rows.length, 1);
  return rows[0];
}
