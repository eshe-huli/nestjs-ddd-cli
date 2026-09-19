import * as fs from 'fs-extra';
import * as os from 'node:os';
import * as path from 'node:path';
import ts from 'typescript';
import { parse } from 'yaml';
import { resetConfigCache } from '../utils/config.utils';
import { generateMigrationDeployment } from './generate-migration-deployment';

interface GeneratedMigrationOptions {
  migrations: string[];
  ssl: false | { rejectUnauthorized: boolean; ca?: string };
}

interface GeneratedRunnerModule {
  createMigrationDataSourceOptions(
    environment: Readonly<Record<string, string | undefined>>,
  ): GeneratedMigrationOptions;
  runMigrations(dataSource: {
    isInitialized: boolean;
    initialize(): Promise<void>;
    runMigrations(options: { transaction: 'all' }): Promise<void>;
    destroy(): Promise<void>;
  }): Promise<void>;
}

async function compileAndLoadRunner(projectPath: string): Promise<GeneratedRunnerModule> {
  const runnerPath = path.join(projectPath, 'src/migration-runner.ts');
  const declarationsPath = path.join(projectPath, 'generated-runtime-types.d.ts');
  const outputPath = path.join(projectPath, 'dist');

  await fs.writeFile(
    declarationsPath,
    `declare module 'reflect-metadata';
declare module 'typeorm' {
  export interface DataSourceOptions {
    migrations?: string[];
    ssl?: false | { rejectUnauthorized: boolean; ca?: string };
    [key: string]: unknown;
  }

  export class DataSource {
    constructor(options: DataSourceOptions);
    isInitialized: boolean;
    initialize(): Promise<void>;
    runMigrations(options: { transaction: 'all' }): Promise<void>;
    destroy(): Promise<void>;
  }
}
`,
    'utf8',
  );

  const program = ts.createProgram({
    rootNames: [declarationsPath, runnerPath],
    options: {
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      noEmitOnError: true,
      outDir: outputPath,
      rootDir: path.join(projectPath, 'src'),
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2020,
      typeRoots: [path.resolve(__dirname, '../../node_modules/@types')],
      types: ['node'],
    },
  });
  const emitResult = program.emit();
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine));

  expect(diagnostics).toEqual([]);

  await fs.outputFile(
    path.join(projectPath, 'node_modules/typeorm/index.js'),
    'class DataSource {}\nmodule.exports = { DataSource };\n',
    'utf8',
  );
  await fs.outputFile(path.join(projectPath, 'node_modules/reflect-metadata/index.js'), '', 'utf8');

  return require(path.join(outputPath, 'migration-runner.js')) as GeneratedRunnerModule;
}

describe('generateMigrationDeployment', () => {
  let projectPath: string;

  beforeEach(async () => {
    resetConfigCache();
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-migration-deployment-'));
    await fs.writeJson(path.join(projectPath, 'package.json'), { name: 'identity-api' });
  });

  afterEach(async () => {
    resetConfigCache();
    await fs.remove(projectPath);
  });

  it('generates a loadable secure runner and a valid immutable-image PreSync Job', async () => {
    const digest = 'a'.repeat(64);

    await generateMigrationDeployment({
      path: projectPath,
      image: `registry.example/identity-api@sha256:${digest}`,
      databaseSecret: 'identity-api-secrets',
      configMap: 'identity-api-config',
      imagePullSecret: 'registry-pull',
    });

    const runner = await compileAndLoadRunner(projectPath);
    const migrationOptions = runner.createMigrationDataSourceOptions({
      DATABASE_URL: 'postgres://localhost/identity',
      DATABASE_SSL: 'true',
    });
    const job = parse(
      await fs.readFile(path.join(projectPath, 'k8s/migration-job.yaml'), 'utf8'),
    ) as Record<string, unknown>;
    const canonicalProjectPath = await fs.realpath(projectPath);

    expect(migrationOptions.migrations).toEqual([
      path.join(canonicalProjectPath, 'dist/migrations/*.js'),
    ]);
    expect(migrationOptions.ssl).toEqual({ rejectUnauthorized: true });
    const migrationCalls: string[] = [];
    const dataSource = {
      isInitialized: false,
      async initialize(): Promise<void> {
        this.isInitialized = true;
        migrationCalls.push('initialize');
      },
      async runMigrations(options: { transaction: 'all' }): Promise<void> {
        migrationCalls.push(`run:${options.transaction}`);
      },
      async destroy(): Promise<void> {
        this.isInitialized = false;
        migrationCalls.push('destroy');
      },
    };
    await runner.runMigrations(dataSource);
    expect(migrationCalls).toEqual(['initialize', 'run:all', 'destroy']);
    expect(job).toMatchObject({
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: 'identity-api-migrate',
        annotations: {
          'argocd.argoproj.io/hook': 'PreSync',
          'argocd.argoproj.io/hook-delete-policy': 'BeforeHookCreation,HookSucceeded',
        },
      },
      spec: {
        template: {
          spec: {
            automountServiceAccountToken: false,
            restartPolicy: 'Never',
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 1001,
              runAsGroup: 1001,
              seccompProfile: { type: 'RuntimeDefault' },
            },
            imagePullSecrets: [{ name: 'registry-pull' }],
            containers: [
              {
                name: 'migrate',
                image: `registry.example/identity-api@sha256:${digest}`,
                command: ['node', 'dist/migration-runner.js'],
                env: expect.arrayContaining([
                  {
                    name: 'DATABASE_URL',
                    valueFrom: {
                      secretKeyRef: { name: 'identity-api-secrets', key: 'DATABASE_URL' },
                    },
                  },
                  {
                    name: 'DATABASE_SSL',
                    valueFrom: {
                      configMapKeyRef: { name: 'identity-api-config', key: 'DATABASE_SSL' },
                    },
                  },
                  { name: 'DATABASE_SSL_INSECURE_SKIP_VERIFY', value: 'false' },
                ]),
              },
            ],
          },
        },
      },
    });
  });

  it('uses the configured compiled migration directory inside an application', async () => {
    await fs.writeJson(path.join(projectPath, '.dddrc.json'), {
      paths: { migrations: 'src/database/migrations' },
    });

    await generateMigrationDeployment({
      path: projectPath,
      image: `registry.example/identity-api@sha256:${'b'.repeat(64)}`,
    });

    const runner = await compileAndLoadRunner(projectPath);
    const options = runner.createMigrationDataSourceOptions({
      DATABASE_URL: 'postgres://localhost/identity',
    });
    const canonicalProjectPath = await fs.realpath(projectPath);

    expect(options.migrations).toEqual([
      path.join(canonicalProjectPath, 'dist/database/migrations/*.js'),
    ]);
  });

  it('uses the owning package dist directory for monorepo-shared migrations', async () => {
    const workspacePath = projectPath;
    const appPath = path.join(workspacePath, 'apps/identity-api');
    await fs.ensureDir(path.join(workspacePath, '.git'));
    await fs.ensureDir(path.join(workspacePath, 'packages/identity-storage/src/migrations'));
    await fs.ensureDir(appPath);
    await fs.writeJson(path.join(appPath, 'package.json'), { name: 'identity-api' });
    await fs.writeJson(path.join(appPath, '.dddrc.json'), {
      paths: { migrations: '../../packages/identity-storage/src/migrations' },
    });

    await generateMigrationDeployment({
      path: appPath,
      image: `registry.example/identity-api@sha256:${'c'.repeat(64)}`,
    });

    const runner = await compileAndLoadRunner(appPath);
    const options = runner.createMigrationDataSourceOptions({
      DATABASE_URL: 'postgres://localhost/identity',
    });
    const canonicalWorkspacePath = await fs.realpath(workspacePath);

    expect(options.migrations).toEqual([
      path.join(canonicalWorkspacePath, 'packages/identity-storage/dist/migrations/*.js'),
    ]);
  });

  it('keeps TLS verification on, supports a trusted CA, and gates insecure TLS explicitly', async () => {
    await generateMigrationDeployment({
      path: projectPath,
      image: `registry.example/identity-api@sha256:${'d'.repeat(64)}`,
      configMap: 'identity-api-config',
      databaseSslCaSecret: 'identity-database-ca',
    });

    const runner = await compileAndLoadRunner(projectPath);
    const databaseUrl = 'postgres://localhost/identity';

    expect(
      runner.createMigrationDataSourceOptions({
        DATABASE_URL: databaseUrl,
        DATABASE_SSL: 'true',
        DATABASE_SSL_CA: 'trusted-ca-pem',
      }).ssl,
    ).toEqual({ rejectUnauthorized: true, ca: 'trusted-ca-pem' });
    expect(
      runner.createMigrationDataSourceOptions({
        DATABASE_URL: databaseUrl,
        DATABASE_SSL: 'true',
        DATABASE_SSL_INSECURE_SKIP_VERIFY: 'true',
      }).ssl,
    ).toEqual({ rejectUnauthorized: false });
    expect(() =>
      runner.createMigrationDataSourceOptions({
        DATABASE_URL: databaseUrl,
        DATABASE_SSL: 'false',
        DATABASE_SSL_INSECURE_SKIP_VERIFY: 'true',
      }),
    ).toThrow('DATABASE_SSL must be true');
    expect(() =>
      runner.createMigrationDataSourceOptions({
        DATABASE_URL: databaseUrl,
        DATABASE_SSL: 'true',
        DATABASE_SSL_CA: 'trusted-ca-pem',
        DATABASE_SSL_INSECURE_SKIP_VERIFY: 'true',
      }),
    ).toThrow('cannot be combined');

    const job = parse(
      await fs.readFile(path.join(projectPath, 'k8s/migration-job.yaml'), 'utf8'),
    ) as {
      spec: { template: { spec: { containers: Array<{ env: unknown[] }> } } };
    };
    expect(job.spec.template.spec.containers[0]?.env).toEqual(
      expect.arrayContaining([
        {
          name: 'DATABASE_SSL_CA',
          valueFrom: {
            secretKeyRef: { name: 'identity-database-ca', key: 'DATABASE_SSL_CA' },
          },
        },
      ]),
    );
  });

  it('requires an explicit coherent opt-in before generating insecure database TLS', async () => {
    const image = `registry.example/identity-api@sha256:${'3'.repeat(64)}`;

    await expect(
      generateMigrationDeployment({
        path: projectPath,
        image,
        databaseSslInsecureSkipVerify: true,
      }),
    ).rejects.toThrow('--config-map is required');
    await expect(
      generateMigrationDeployment({
        path: projectPath,
        image,
        configMap: 'identity-api-config',
        databaseSslCaSecret: 'identity-database-ca',
        databaseSslInsecureSkipVerify: true,
      }),
    ).rejects.toThrow('cannot be combined');

    await generateMigrationDeployment({
      path: projectPath,
      image,
      configMap: 'identity-api-config',
      databaseSslInsecureSkipVerify: true,
    });
    const job = parse(
      await fs.readFile(path.join(projectPath, 'k8s/migration-job.yaml'), 'utf8'),
    ) as {
      spec: { template: { spec: { containers: Array<{ env: unknown[] }> } } };
    };

    expect(job.spec.template.spec.containers[0]?.env).toEqual(
      expect.arrayContaining([{ name: 'DATABASE_SSL_INSECURE_SKIP_VERIFY', value: 'true' }]),
    );
  });

  it('rejects invalid or unbuildable configured migration paths', async () => {
    await fs.writeJson(path.join(projectPath, '.dddrc.json'), {
      paths: { migrations: 'migrations' },
    });
    await expect(
      generateMigrationDeployment({
        path: projectPath,
        image: `registry.example/identity-api@sha256:${'e'.repeat(64)}`,
      }),
    ).rejects.toThrow('must be inside a source directory named "src"');

    resetConfigCache();
    await fs.writeJson(path.join(projectPath, '.dddrc.json'), {
      paths: { migrations: '' },
    });
    await expect(
      generateMigrationDeployment({
        path: projectPath,
        image: `registry.example/identity-api@sha256:${'f'.repeat(64)}`,
      }),
    ).rejects.toThrow('must be a non-empty directory path');
  });

  it('rejects a mutable image tag', async () => {
    await expect(
      generateMigrationDeployment({
        path: projectPath,
        image: 'registry.example/identity-api:staging',
      }),
    ).rejects.toThrow('must be pinned by sha256 digest');
  });

  it('does not overwrite an existing migration gate', async () => {
    const options = {
      path: projectPath,
      image: `registry.example/identity-api@sha256:${'1'.repeat(64)}`,
    };

    await generateMigrationDeployment(options);

    await expect(generateMigrationDeployment(options)).rejects.toThrow('Refusing to overwrite');
  });

  it('keeps dry-run non-mutating', async () => {
    await generateMigrationDeployment({
      path: projectPath,
      image: `registry.example/identity-api@sha256:${'2'.repeat(64)}`,
      dryRun: true,
    });

    await expect(fs.pathExists(path.join(projectPath, 'src/migration-runner.ts'))).resolves.toBe(
      false,
    );
    await expect(fs.pathExists(path.join(projectPath, 'k8s/migration-job.yaml'))).resolves.toBe(
      false,
    );
    await expect(fs.pathExists(path.join(projectPath, 'src'))).resolves.toBe(false);
    await expect(fs.pathExists(path.join(projectPath, 'k8s'))).resolves.toBe(false);
  });
});
