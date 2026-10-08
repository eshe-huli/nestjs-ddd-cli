import * as path from 'node:path';
import * as fs from 'fs-extra';
import { readTemplate } from '../../utils/file.utils';

const files = [
  [
    'client.ts.hbs',
    'src/shared/auth/oauth2-token-introspection/oauth2-token-introspection.client.ts',
  ],
  [
    'client.spec.ts.hbs',
    'src/shared/auth/oauth2-token-introspection/oauth2-token-introspection.client.spec.ts',
  ],
  [
    'module.ts.hbs',
    'src/shared/auth/oauth2-token-introspection/oauth2-token-introspection.module.ts',
  ],
  ['index.ts.hbs', 'src/shared/auth/oauth2-token-introspection/index.ts'],
  ['README.md.hbs', 'docs/auth/oauth2-token-introspection.md'],
] as const;

async function statOrAbsent(target: string): Promise<fs.Stats | undefined> {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function assertTarget(root: string, target: string, content: string): Promise<void> {
  let cursor = target;
  while (true) {
    const stat = await statOrAbsent(cursor);
    if (stat?.isSymbolicLink()) throw new Error(`Refusing symlink recipe target: ${cursor}`);
    if (stat && cursor !== target && !stat.isDirectory()) {
      throw new Error(`Recipe parent is not a directory: ${cursor}`);
    }
    if (cursor === root) break;
    cursor = path.dirname(cursor);
  }
  const stat = await statOrAbsent(target);
  if (stat && (!stat.isFile() || (await fs.readFile(target, 'utf8')) !== content)) {
    throw new Error(`OAuth2 introspection recipe target already differs: ${target}`);
  }
}

export async function applyOAuth2TokenIntrospectionRecipe(
  basePath: string,
  dryRun = false,
): Promise<void> {
  const root = path.resolve(basePath);
  const templateRoot = path.join(__dirname, '../../templates/recipes/oauth2-token-introspection');
  const planned = await Promise.all(
    files.map(async ([source, destination]) => ({
      target: path.join(root, destination),
      content: await readTemplate(path.join(templateRoot, source)),
    })),
  );
  // Preflight the entire plan, including dangling symlinks, before any writes.
  for (const file of planned) await assertTarget(root, file.target, file.content);
  if (dryRun) {
    for (const file of planned) console.log(`Would generate: ${file.target}`);
    return;
  }
  const createdFiles: Array<{
    target: string;
    stat: fs.Stats;
    expectedContent: string;
  }> = [];
  const createdDirectories = new Set<string>();
  try {
    for (const file of planned) {
      await assertTarget(root, file.target, file.content);
      if (await statOrAbsent(file.target)) continue;
      let cursor = path.dirname(file.target);
      while (!(await statOrAbsent(cursor))) {
        createdDirectories.add(cursor);
        cursor = path.dirname(cursor);
      }
      await fs.ensureDir(path.dirname(file.target));
      // Exclusive creation preserves a concurrently-created owner file.
      const descriptor = await fs.open(file.target, 'wx');
      const receipt = {
        target: file.target,
        stat: await fs.fstat(descriptor),
        expectedContent: '',
      };
      createdFiles.push(receipt);
      try {
        await fs.writeFile(descriptor, file.content);
        receipt.expectedContent = file.content;
        receipt.stat = await fs.fstat(descriptor);
      } finally {
        await fs.close(descriptor);
      }
    }
  } catch (error) {
    const rollbackConflicts: string[] = [];
    for (const receipt of createdFiles.reverse()) {
      const current = await statOrAbsent(receipt.target);
      if (!current) continue;
      // A successor inode, changed bytes or changed timestamps belongs to its owner.
      // Preserve it and report incomplete rollback rather than delete user work.
      if (
        !current.isFile() ||
        current.dev !== receipt.stat.dev ||
        current.ino !== receipt.stat.ino ||
        current.mtimeMs !== receipt.stat.mtimeMs ||
        current.ctimeMs !== receipt.stat.ctimeMs ||
        (await fs.readFile(receipt.target, 'utf8')) !== receipt.expectedContent
      ) {
        rollbackConflicts.push(receipt.target);
        continue;
      }
      await fs.remove(receipt.target);
    }
    for (const directory of [...createdDirectories].sort((a, b) => b.length - a.length)) {
      try {
        await fs.rmdir(directory);
      } catch (cleanupError) {
        if (!['ENOENT', 'ENOTEMPTY'].includes((cleanupError as NodeJS.ErrnoException).code ?? '')) {
          throw new Error('Recipe write and rollback failed');
        }
      }
    }
    if (rollbackConflicts.length) {
      throw new Error(
        `Recipe rollback conflict: preserved modified or replaced targets: ${rollbackConflicts.join(', ')}`,
      );
    }
    throw error;
  }
}
