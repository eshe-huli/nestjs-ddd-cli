import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as fs from 'fs-extra';
import * as os from 'node:os';
import * as path from 'node:path';
import * as ts from 'typescript';
import { resetConfigCache } from '../../src/utils/config.utils';
import { applyRecipe } from '../../src/commands/recipe';
import { applyExternalProjectionWorkerRecipe } from '../../src/commands/recipes';

const timestamp = '1790000000000';

describe('external projection worker recipe', () => {
  let root: string;

  beforeEach(async () => {
    resetConfigCache();
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-external-projection-'));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    resetConfigCache();
    await fs.remove(root);
  });

  it('requires one explicit 13-digit migration timestamp before writing', async () => {
    await expect(applyExternalProjectionWorkerRecipe(root, {})).rejects.toThrow(
      'exactly 13 digits',
    );
    await expect(
      applyExternalProjectionWorkerRecipe(root, { migrationTimestamp: 'now' }),
    ).rejects.toThrow('exactly 13 digits');
    expect(await fs.readdir(root)).toEqual([]);
  });

  it('previews every configured target without writing generated directories', async () => {
    await fs.writeJson(path.join(root, '.dddrc.json'), {
      orm: 'typeorm',
      database: 'postgres',
      paths: {
        shared: 'packages/runtime/shared',
        migrations: 'packages/runtime/migrations',
      },
    });
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await applyRecipe('external-projection-worker', {
      path: root,
      dryRun: true,
      installDeps: true,
      migrationTimestamp: timestamp,
    });

    expect(await fs.pathExists(path.join(root, 'packages'))).toBe(false);
    expect(log.mock.calls.flat().join('\n')).toContain(
      'packages/runtime/migrations/1790000000000-CreateExternalProjectionOperations.ts',
    );
    expect(log.mock.calls.flat().join('\n')).toContain(
      'packages/runtime/shared/external-projection-worker/external-projection-enqueuer.ts',
    );
  });

  it('supports only PostgreSQL with TypeORM', async () => {
    await fs.writeJson(path.join(root, '.dddrc.json'), {
      orm: 'prisma',
      database: 'postgres',
    });
    await expect(
      applyExternalProjectionWorkerRecipe(root, { migrationTimestamp: timestamp }),
    ).rejects.toThrow('only PostgreSQL with TypeORM');
    expect(await fs.readdir(root)).toEqual(['.dddrc.json']);
  });

  it('reruns without touching identical files and preflights conflicts before any write', async () => {
    await applyExternalProjectionWorkerRecipe(root, { migrationTimestamp: timestamp });
    const worker = path.join(root, 'src/shared/external-projection-worker');
    const enqueuer = path.join(worker, 'external-projection-enqueuer.ts');
    const docs = path.join(root, 'docs/platform/external-projection-worker.md');
    const before = await fs.stat(enqueuer);

    await applyExternalProjectionWorkerRecipe(root, { migrationTimestamp: timestamp });
    expect((await fs.stat(enqueuer)).mtimeMs).toBe(before.mtimeMs);

    await fs.writeFile(enqueuer, '// application-owned adaptation\n');
    await fs.remove(docs);
    await expect(
      applyExternalProjectionWorkerRecipe(root, { migrationTimestamp: timestamp }),
    ).rejects.toThrow('already differs');
    expect(await fs.pathExists(docs)).toBe(false);
    expect(await fs.readFile(enqueuer, 'utf8')).toBe('// application-owned adaptation\n');
  });

  it('allows concurrent identical generation without partial or overwritten output', async () => {
    await Promise.all([
      applyExternalProjectionWorkerRecipe(root, { migrationTimestamp: timestamp }),
      applyExternalProjectionWorkerRecipe(root, { migrationTimestamp: timestamp }),
    ]);

    const worker = path.join(root, 'src/shared/external-projection-worker');
    expect(await fs.readdir(worker)).toHaveLength(7);
    expect(
      await fs.pathExists(
        path.join(root, 'src/migrations/1790000000000-CreateExternalProjectionOperations.ts'),
      ),
    ).toBe(true);
  });

  it('refuses a second migration identity and symlinked output ancestry', async () => {
    await applyExternalProjectionWorkerRecipe(root, { migrationTimestamp: timestamp });
    await expect(
      applyExternalProjectionWorkerRecipe(root, { migrationTimestamp: '1790000000001' }),
    ).rejects.toThrow('already exists with another timestamp');

    const linkedRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-external-link-'));
    const elsewhere = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-external-elsewhere-'));
    try {
      await fs.ensureDir(path.join(linkedRoot, 'src'));
      await fs.symlink(elsewhere, path.join(linkedRoot, 'src/shared'));
      resetConfigCache();
      await expect(
        applyExternalProjectionWorkerRecipe(linkedRoot, { migrationTimestamp: timestamp }),
      ).rejects.toThrow('symlink');
      expect(await fs.readdir(elsewhere)).toEqual([]);
    } finally {
      await fs.remove(linkedRoot);
      await fs.remove(elsewhere);
    }
  });

  it('strict-typechecks generated runtime and migration code', async () => {
    await applyExternalProjectionWorkerRecipe(root, { migrationTimestamp: timestamp });
    const typesPath = path.join(root, 'generated-dependency-types.d.ts');
    await fs.writeFile(typesPath, generatedDependencyTypes(), 'utf8');
    const generated = (await listTypeScriptFiles(path.join(root, 'src'))).concat(typesPath);
    const program = ts.createProgram({
      rootNames: generated,
      options: {
        esModuleInterop: true,
        experimentalDecorators: true,
        forceConsistentCasingInFileNames: true,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        noEmit: true,
        noPropertyAccessFromIndexSignature: true,
        noUncheckedIndexedAccess: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        skipLibCheck: true,
        strict: true,
        target: ts.ScriptTarget.ES2022,
        typeRoots: [path.resolve(__dirname, '../../node_modules/@types')],
        types: ['node'],
      },
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
      }),
    ).toBe('');
  });

  it('generates canonical hashes and a non-overlapping worker lifecycle', async () => {
    await applyExternalProjectionWorkerRecipe(root, { migrationTimestamp: timestamp });
    const build = path.join(root, 'build');
    const typesPath = path.join(root, 'generated-dependency-types.d.ts');
    await fs.writeFile(typesPath, generatedDependencyTypes(), 'utf8');
    const program = ts.createProgram({
      rootNames: (await listTypeScriptFiles(path.join(root, 'src'))).concat(typesPath),
      options: {
        esModuleInterop: true,
        experimentalDecorators: true,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        outDir: build,
        skipLibCheck: true,
        strict: true,
        target: ts.ScriptTarget.ES2022,
        typeRoots: [path.resolve(__dirname, '../../node_modules/@types')],
        types: ['node'],
      },
    });
    expect(program.emit().emitSkipped).toBe(false);
    await fs.symlink(
      path.resolve(__dirname, '../../node_modules'),
      path.join(root, 'node_modules'),
    );

    const generatedRoot = path.join(build, 'shared/external-projection-worker');
    const canonical = require(path.join(generatedRoot, 'canonical-json.js')) as {
      canonicalizeExternalProjectionJson(value: unknown): { text: string; sha256: string };
    };
    const first = canonical.canonicalizeExternalProjectionJson({ z: 1, a: { b: true } });
    const reordered = canonical.canonicalizeExternalProjectionJson({ a: { b: true }, z: 1 });
    expect(first).toEqual(reordered);
    expect(first.text).toBe('{"a":{"b":true},"z":1}');
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => canonical.canonicalizeExternalProjectionJson(cyclic)).toThrow('cycles');
    expect(() => canonical.canonicalizeExternalProjectionJson('x'.repeat(262_145))).toThrow(
      'byte limit',
    );

    const workerModule = require(path.join(generatedRoot, 'external-projection-worker.js')) as {
      ExternalProjectionWorker: new (
        store: {
          claimNext(
            workerId: string,
            leaseSeconds: number,
          ): Promise<Record<string, unknown> | null>;
          renewLease(claimed: unknown, leaseSeconds: number): Promise<boolean>;
          markApplied(claimed: unknown, resultReference?: string): Promise<boolean>;
          markFailure(claimed: unknown, completion: unknown): Promise<boolean>;
        },
        handler: { execute(operation: unknown): Promise<unknown> },
        options: Record<string, unknown>,
      ) => { runOnce(): Promise<number>; onApplicationShutdown(): Promise<void> };
    };
    let release: ((value: unknown) => void) | undefined;
    const execution = new Promise((resolve) => {
      release = resolve;
    });
    const operation = claimedOperation();
    const store = {
      claimNext: jest
        .fn<(workerId: string, leaseSeconds: number) => Promise<Record<string, unknown> | null>>()
        .mockResolvedValueOnce(operation)
        .mockResolvedValue(null),
      renewLease: jest
        .fn<(claimed: unknown, leaseSeconds: number) => Promise<boolean>>()
        .mockResolvedValue(true),
      markApplied: jest
        .fn<(claimed: unknown, resultReference?: string) => Promise<boolean>>()
        .mockResolvedValue(true),
      markFailure: jest
        .fn<(claimed: unknown, completion: unknown) => Promise<boolean>>()
        .mockResolvedValue(true),
    };
    const handler = {
      execute: jest.fn<() => Promise<unknown>>(async () => execution),
    };
    const worker = new workerModule.ExternalProjectionWorker(store, handler, workerOptions());
    const firstRun = worker.runOnce();
    const overlappingRun = worker.runOnce();
    expect(overlappingRun).toBe(firstRun);
    await new Promise((resolve) => setImmediate(resolve));
    release?.({ disposition: 'retry_wait', errorCode: 'PROVIDER_UNAVAILABLE' });
    await expect(firstRun).resolves.toBe(1);
    expect(handler.execute).toHaveBeenCalledTimes(1);
    expect(store.markApplied).not.toHaveBeenCalled();
    expect(store.markFailure).toHaveBeenCalledWith(operation, {
      disposition: 'blocked',
      errorCode: 'PROVIDER_UNAVAILABLE',
      nextAttemptAt: undefined,
    });
    await worker.onApplicationShutdown();
    await expect(worker.runOnce()).resolves.toBe(0);
  });
});

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory()
        ? listTypeScriptFiles(target)
        : Promise.resolve(entry.name.endsWith('.ts') ? [target] : []);
    }),
  );
  return nested.flat();
}

function workerOptions(): Record<string, unknown> {
  return {
    enabled: true,
    pollIntervalMs: 1_000,
    batchSize: 5,
    leaseSeconds: 30,
    maxAttempts: 5,
    retryBaseMs: 100,
    retryMaxMs: 5_000,
  };
}

function claimedOperation(): Record<string, unknown> {
  const now = new Date();
  return {
    id: '11111111-1111-4111-8111-111111111111',
    projectionName: 'directory-v1',
    targetKey: 'subject-1',
    operationKind: 'upsert',
    idempotencyKey: 'command-1',
    payload: { displayName: 'Ada' },
    payloadHash: 'a'.repeat(64),
    status: 'processing',
    attemptCount: 5,
    leaseOwner: 'worker-1',
    leaseToken: '22222222-2222-4222-8222-222222222222',
    leaseExpiresAt: new Date(now.getTime() + 30_000),
    createdAt: now,
    updatedAt: now,
  };
}

function generatedDependencyTypes(): string {
  return `
declare module "@nestjs/common" {
  export interface Type<T = unknown> extends Function { new (...args: never[]): T }
  export interface DynamicModule { module: Type<unknown>; imports?: unknown[]; providers?: unknown[]; exports?: unknown[] }
  export interface ModuleMetadata { imports?: unknown[] }
  export function Injectable(): ClassDecorator;
  export function Inject(token: unknown): ParameterDecorator;
  export function Module(metadata: unknown): ClassDecorator;
  export interface OnApplicationBootstrap { onApplicationBootstrap(): void | Promise<void> }
  export interface OnApplicationShutdown { onApplicationShutdown(): void | Promise<void> }
  export class Logger { constructor(context?: string); error(message: string): void; warn(message: string): void }
}
declare module "typeorm" {
  export interface EntityManager { query(sql: string, parameters?: unknown[]): Promise<unknown> }
  export interface DataSource {
    query(sql: string, parameters?: unknown[]): Promise<unknown>;
    transaction<T>(operation: (manager: EntityManager) => Promise<T>): Promise<T>;
  }
  export interface QueryRunner { query(sql: string, parameters?: unknown[]): Promise<unknown> }
  export interface MigrationInterface { up(queryRunner: QueryRunner): Promise<void>; down(queryRunner: QueryRunner): Promise<void> }
}
`;
}
