import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs-extra';
import { loadConfig } from '../../utils/config.utils';
import { readTemplate } from '../../utils/file.utils';

export interface ExternalProjectionWorkerRecipeOptions {
  dryRun?: boolean;
  migrationTimestamp?: string;
}

interface PlannedFile {
  target: string;
  content: string;
}

const recipeFiles = [
  ['canonical-json.ts.hbs', 'canonical-json.ts'],
  ['types.ts.hbs', 'external-projection-worker.types.ts'],
  ['enqueuer.ts.hbs', 'external-projection-enqueuer.ts'],
  ['store.ts.hbs', 'external-projection-store.ts'],
  ['worker.ts.hbs', 'external-projection-worker.ts'],
  ['module.ts.hbs', 'external-projection-worker.module.ts'],
  ['index.ts.hbs', 'index.ts'],
] as const;

const migrationSuffix = 'CreateExternalProjectionOperations.ts';

function requiredTimestamp(value: string | undefined): string {
  if (!value || !/^\d{13}$/.test(value)) {
    throw new Error(
      'external-projection-worker requires --migration-timestamp with exactly 13 digits',
    );
  }
  return value;
}

function resolveOwnedPath(root: string, configuredPath: string, label: string): string {
  const resolved = path.resolve(root, configuredPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Configured ${label} path must stay inside the project root`);
  }
  return resolved;
}

async function assertNoSymlink(root: string, target: string): Promise<void> {
  let cursor = target;
  while (true) {
    if (await fs.pathExists(cursor)) {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink()) {
        throw new Error(`Refusing symlink recipe target: ${cursor}`);
      }
    }
    if (cursor === root) return;
    const parent = path.dirname(cursor);
    if (parent === cursor || path.relative(root, parent).startsWith('..')) {
      throw new Error(`Recipe target escapes project root: ${target}`);
    }
    cursor = parent;
  }
}

async function assertTarget(root: string, file: PlannedFile): Promise<void> {
  await assertNoSymlink(root, file.target);
  if (
    (await fs.pathExists(file.target)) &&
    (await fs.readFile(file.target, 'utf8')) !== file.content
  ) {
    throw new Error(`External projection recipe target already differs: ${file.target}`);
  }
}

function renderMigration(template: string, timestamp: string): string {
  return template.split('MIGRATIONTIMESTAMPPLACEHOLDER').join(timestamp);
}

async function writeExclusive(root: string, file: PlannedFile): Promise<void> {
  if (await fs.pathExists(file.target)) {
    if ((await fs.readFile(file.target, 'utf8')) !== file.content) {
      throw new Error(
        `External projection recipe target changed during generation: ${file.target}`,
      );
    }
    return;
  }
  await assertNoSymlink(root, file.target);
  await fs.ensureDir(path.dirname(file.target));
  const temporary = `${file.target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, file.content, { flag: 'wx' });
    await fs.link(temporary, file.target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if ((await fs.readFile(file.target, 'utf8')) !== file.content) {
      throw new Error(
        `External projection recipe target changed during generation: ${file.target}`,
      );
    }
  } finally {
    await fs.remove(temporary);
  }
}

async function assertSingleMigration(
  root: string,
  migrationsPath: string,
  expectedTarget: string,
): Promise<void> {
  await assertNoSymlink(root, migrationsPath);
  if (!(await fs.pathExists(migrationsPath))) return;
  const existing = (await fs.readdir(migrationsPath))
    .filter((entry) => /^\d{13}-CreateExternalProjectionOperations\.ts$/.test(entry))
    .map((entry) => path.join(migrationsPath, entry));
  if (existing.some((entry) => entry !== expectedTarget)) {
    throw new Error(
      `External projection migration already exists with another timestamp: ${existing.join(', ')}`,
    );
  }
}

export async function applyExternalProjectionWorkerRecipe(
  basePath: string,
  options: ExternalProjectionWorkerRecipeOptions,
): Promise<void> {
  const timestamp = requiredTimestamp(options.migrationTimestamp);
  const root = path.resolve(basePath);
  const config = await loadConfig(root);
  if (config.orm !== 'typeorm' || config.database !== 'postgres') {
    throw new Error('external-projection-worker supports only PostgreSQL with TypeORM');
  }

  const sharedPath = resolveOwnedPath(root, config.paths.shared, 'shared');
  const migrationsPath = resolveOwnedPath(root, config.paths.migrations, 'migrations');
  const workerPath = path.join(sharedPath, 'external-projection-worker');
  const migrationTarget = path.join(migrationsPath, `${timestamp}-${migrationSuffix}`);
  const templateRoot = path.join(__dirname, '../../templates/recipes/external-projection-worker');

  const recipeOutputs: PlannedFile[] = await Promise.all(
    recipeFiles.map(async ([source, target]) => ({
      target: path.join(workerPath, target),
      content: await readTemplate(path.join(templateRoot, source)),
    })),
  );
  const [migrationTemplate, documentationTemplate] = await Promise.all([
    readTemplate(path.join(templateRoot, 'migration.ts.hbs')),
    readTemplate(path.join(templateRoot, 'README.md.hbs')),
  ]);
  const planned: PlannedFile[] = [
    ...recipeOutputs,
    {
      target: migrationTarget,
      content: renderMigration(migrationTemplate, timestamp),
    },
    {
      target: path.join(root, 'docs/platform/external-projection-worker.md'),
      content: documentationTemplate,
    },
  ];

  if (new Set(planned.map(({ target }) => target)).size !== planned.length) {
    throw new Error('External projection recipe resolved duplicate output targets');
  }
  await assertSingleMigration(root, migrationsPath, migrationTarget);
  for (const file of planned) await assertTarget(root, file);

  if (options.dryRun) {
    for (const file of planned) console.log(`Would generate: ${file.target}`);
    return;
  }

  for (const file of planned) await writeExclusive(root, file);
}
