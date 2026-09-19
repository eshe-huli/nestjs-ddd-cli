import * as fs from 'fs-extra';
import * as path from 'node:path';
import chalk from 'chalk';
import { ensureDir, fileExists, writeGeneratedFile } from '../utils/file.utils';
import { resolveMigrationOutputPath } from './migration';
import { loadConfig } from '../utils/config.utils';

export interface MigrationDeploymentOptions {
  path?: string;
  appName?: string;
  image?: string;
  databaseSecret?: string;
  databaseUrlKey?: string;
  configMap?: string;
  databaseSslKey?: string;
  databaseSslCaSecret?: string;
  databaseSslCaKey?: string;
  databaseSslInsecureSkipVerify?: boolean;
  imagePullSecret?: string;
  dryRun?: boolean;
}

interface ResolvedMigrationDeploymentOptions {
  basePath: string;
  appName: string;
  image: string;
  databaseSecret: string;
  databaseUrlKey: string;
  configMap?: string;
  databaseSslKey: string;
  databaseSslCaSecret?: string;
  databaseSslCaKey: string;
  databaseSslInsecureSkipVerify: boolean;
  imagePullSecret?: string;
  migrationRuntimeDirectory: string;
  dryRun: boolean;
}

const DNS_LABEL = /^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?$/;
const SECRET_KEY = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const IMMUTABLE_IMAGE = /^[A-Za-z0-9][A-Za-z0-9._/:-]*@sha256:[a-f0-9]{64}$/;

export async function generateMigrationDeployment(
  options: MigrationDeploymentOptions,
): Promise<void> {
  const resolved = await resolveOptions(options);
  const runnerPath = path.join(resolved.basePath, 'src', 'migration-runner.ts');
  const jobPath = path.join(resolved.basePath, 'k8s', 'migration-job.yaml');

  await assertSafeOutput(runnerPath, resolved.dryRun);
  await assertSafeOutput(jobPath, resolved.dryRun);
  if (!resolved.dryRun) {
    await ensureDir(path.dirname(runnerPath));
    await ensureDir(path.dirname(jobPath));
  }

  await writeGeneratedFile(
    runnerPath,
    renderMigrationRunner(resolved.migrationRuntimeDirectory),
    resolved.dryRun,
  );
  await writeGeneratedFile(jobPath, renderMigrationJob(resolved), resolved.dryRun);

  const verb = resolved.dryRun ? 'Would generate' : 'Generated';
  console.log(chalk.green(`  ✓ ${verb} src/migration-runner.ts`));
  console.log(chalk.green(`  ✓ ${verb} k8s/migration-job.yaml`));
}

async function resolveOptions(
  options: MigrationDeploymentOptions,
): Promise<ResolvedMigrationDeploymentOptions> {
  const basePath = path.resolve(options.path ?? process.cwd());
  const packageJsonPath = path.join(basePath, 'package.json');
  const packageJson = (await fs.readJson(packageJsonPath)) as { name?: unknown };
  const appName =
    options.appName ?? (typeof packageJson.name === 'string' ? packageJson.name : undefined);

  if (!appName || !isDnsLabel(appName)) {
    throw new Error('Migration deployment requires a DNS-label-safe --app-name');
  }

  if (!options.image || !IMMUTABLE_IMAGE.test(options.image)) {
    throw new Error('Migration deployment --image must be pinned by sha256 digest');
  }

  const databaseSecret = options.databaseSecret ?? `${appName}-secrets`;
  validateDnsLabel(databaseSecret, '--database-secret');

  const databaseUrlKey = options.databaseUrlKey ?? 'DATABASE_URL';
  validateSecretKey(databaseUrlKey, '--database-url-key');

  const databaseSslKey = options.databaseSslKey ?? 'DATABASE_SSL';
  validateSecretKey(databaseSslKey, '--database-ssl-key');

  if (options.configMap) {
    validateDnsLabel(options.configMap, '--config-map');
  }

  if (options.imagePullSecret) {
    validateDnsLabel(options.imagePullSecret, '--image-pull-secret');
  }

  const databaseSslCaSecret = options.databaseSslCaSecret;
  const databaseSslCaKey = options.databaseSslCaKey ?? 'DATABASE_SSL_CA';
  if (databaseSslCaSecret) {
    validateDnsLabel(databaseSslCaSecret, '--database-ssl-ca-secret');
    validateSecretKey(databaseSslCaKey, '--database-ssl-ca-key');
  } else if (options.databaseSslCaKey) {
    throw new Error('--database-ssl-ca-key requires --database-ssl-ca-secret');
  }

  const databaseSslInsecureSkipVerify = options.databaseSslInsecureSkipVerify ?? false;
  if (databaseSslCaSecret && databaseSslInsecureSkipVerify) {
    throw new Error(
      '--database-ssl-ca-secret cannot be combined with --database-ssl-insecure-skip-verify',
    );
  }
  if ((databaseSslCaSecret || databaseSslInsecureSkipVerify) && !options.configMap) {
    throw new Error(
      '--config-map is required when configuring a database CA or insecure TLS opt-in',
    );
  }

  const config = await loadConfig(basePath);
  const configuredMigrationPath: unknown = config.paths?.migrations;
  if (
    typeof configuredMigrationPath !== 'string' ||
    configuredMigrationPath.trim().length === 0 ||
    /[\0*?{}[\]]/.test(configuredMigrationPath)
  ) {
    throw new Error('.dddrc.json paths.migrations must be a non-empty directory path');
  }

  const migrationSourceDirectory = resolveMigrationOutputPath(
    basePath,
    configuredMigrationPath,
    'src/migrations',
  );
  const migrationRuntimeDirectory = resolveCompiledMigrationRuntimeDirectory(
    basePath,
    migrationSourceDirectory,
  );

  return {
    basePath,
    appName,
    image: options.image,
    databaseSecret,
    databaseUrlKey,
    configMap: options.configMap,
    databaseSslKey,
    databaseSslCaSecret,
    databaseSslCaKey,
    databaseSslInsecureSkipVerify,
    imagePullSecret: options.imagePullSecret,
    migrationRuntimeDirectory,
    dryRun: options.dryRun ?? false,
  };
}

function resolveCompiledMigrationRuntimeDirectory(
  basePath: string,
  migrationSourceDirectory: string,
): string {
  const sourceRoot = findOwningSourceRoot(migrationSourceDirectory);
  if (!sourceRoot) {
    throw new Error('.dddrc.json paths.migrations must be inside a source directory named "src"');
  }

  const compiledMigrationDirectory = path.join(
    path.dirname(sourceRoot),
    'dist',
    path.relative(sourceRoot, migrationSourceDirectory),
  );
  const compiledRunnerDirectory = path.join(basePath, 'dist');
  const relativeRuntimeDirectory = path.relative(
    compiledRunnerDirectory,
    compiledMigrationDirectory,
  );

  return (relativeRuntimeDirectory || '.').split(path.sep).join('/');
}

function findOwningSourceRoot(migrationSourceDirectory: string): string | undefined {
  let current = path.resolve(migrationSourceDirectory);

  while (true) {
    if (path.basename(current) === 'src') {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function isDnsLabel(value: string): boolean {
  return value.length <= 63 && DNS_LABEL.test(value);
}

function validateDnsLabel(value: string, optionName: string): void {
  if (!isDnsLabel(value)) {
    throw new Error(`${optionName} must be a valid Kubernetes DNS label`);
  }
}

function validateSecretKey(value: string, optionName: string): void {
  if (value.length > 253 || !SECRET_KEY.test(value)) {
    throw new Error(`${optionName} must be a valid Kubernetes Secret or ConfigMap key`);
  }
}

async function assertSafeOutput(filePath: string, dryRun: boolean): Promise<void> {
  if (!dryRun && (await fileExists(filePath))) {
    throw new Error(`Refusing to overwrite existing migration deployment file: ${filePath}`);
  }
}

function renderMigrationRunner(migrationRuntimeDirectory: string): string {
  const serializedRuntimeDirectory = JSON.stringify(migrationRuntimeDirectory);

  return `import 'reflect-metadata';
import * as path from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';

export type MigrationEnvironment = Readonly<Record<string, string | undefined>>;

export function createMigrationDataSourceOptions(
  environment: MigrationEnvironment = process.env,
): DataSourceOptions {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const sslEnabled = parseBoolean(environment.DATABASE_SSL ?? 'false', 'DATABASE_SSL');
  const insecureSkipVerify = parseBoolean(
    environment.DATABASE_SSL_INSECURE_SKIP_VERIFY ?? 'false',
    'DATABASE_SSL_INSECURE_SKIP_VERIFY',
  );
  const certificateAuthority = environment.DATABASE_SSL_CA?.trim();

  if (!sslEnabled && (insecureSkipVerify || certificateAuthority)) {
    throw new Error(
      'DATABASE_SSL must be true when DATABASE_SSL_INSECURE_SKIP_VERIFY or DATABASE_SSL_CA is set',
    );
  }
  if (insecureSkipVerify && certificateAuthority) {
    throw new Error(
      'DATABASE_SSL_CA cannot be combined with DATABASE_SSL_INSECURE_SKIP_VERIFY=true',
    );
  }

  const ssl = sslEnabled
    ? {
        rejectUnauthorized: !insecureSkipVerify,
        ...(certificateAuthority ? { ca: certificateAuthority } : {}),
      }
    : false;

  return {
    type: 'postgres',
    url: databaseUrl,
    ssl,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'migrations',
    migrations: [path.resolve(__dirname, ${serializedRuntimeDirectory}, '*.js')],
  };
}

export async function runMigrations(dataSource: DataSource): Promise<void> {
  await dataSource.initialize();
  try {
    await dataSource.runMigrations({ transaction: 'all' });
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

function parseBoolean(value: string, name: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(\`${'${name}'} must be true or false\`);
}

async function main(): Promise<void> {
  const dataSource = new DataSource(createMigrationDataSourceOptions());
  try {
    await runMigrations(dataSource);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown migration failure';
    console.error(\`Migration failed: ${'${message}'}\`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main(); // NOSONAR -- CommonJS executable entrypoints cannot use top-level await.
}
`;
}

function renderMigrationJob(options: ResolvedMigrationDeploymentOptions): string {
  const pullSecret = options.imagePullSecret
    ? `      imagePullSecrets:\n        - name: ${options.imagePullSecret}\n`
    : '';
  const sslSource = options.configMap
    ? `            - name: DATABASE_SSL\n              valueFrom:\n                configMapKeyRef:\n                  name: ${options.configMap}\n                  key: ${options.databaseSslKey}\n`
    : `            - name: DATABASE_SSL\n              value: 'false'\n`;
  const caSource = options.databaseSslCaSecret
    ? `            - name: DATABASE_SSL_CA\n              valueFrom:\n                secretKeyRef:\n                  name: ${options.databaseSslCaSecret}\n                  key: ${options.databaseSslCaKey}\n`
    : '';

  return `apiVersion: batch/v1
kind: Job
metadata:
  name: ${options.appName}-migrate
  labels:
    app: ${options.appName}
    app.kubernetes.io/component: database-migration
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation,HookSucceeded
spec:
  backoffLimit: 2
  activeDeadlineSeconds: 600
  ttlSecondsAfterFinished: 3600
  template:
    metadata:
      labels:
        app: ${options.appName}
        app.kubernetes.io/component: database-migration
    spec:
      automountServiceAccountToken: false
      restartPolicy: Never
${pullSecret}      securityContext:
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: migrate
          image: ${options.image}
          imagePullPolicy: IfNotPresent
          command:
            - node
            - dist/migration-runner.js
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: ${options.databaseSecret}
                  key: ${options.databaseUrlKey}
${sslSource}            - name: DATABASE_SSL_INSECURE_SKIP_VERIFY
              value: '${options.databaseSslInsecureSkipVerify ? 'true' : 'false'}'
${caSource}          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
          resources:
            requests:
              cpu: 10m
              memory: 64Mi
              ephemeral-storage: 16Mi
            limits:
              cpu: 250m
              memory: 256Mi
              ephemeral-storage: 128Mi
`;
}
