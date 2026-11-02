import * as path from 'node:path';
import * as fs from 'fs-extra';
import { readTemplate } from '../../utils/file.utils';

const files = [
  ['manifest.ts.hbs', 'src/shared/authorization/platform-parc-catalog/catalog-manifest.ts'],
  ['publisher.ts.hbs', 'src/shared/authorization/platform-parc-catalog/catalog-publisher.ts'],
  ['README.md.hbs', 'docs/platform/parc-catalog.md'],
] as const;

async function assertTarget(file: { target: string; content: string }): Promise<void> {
  let cursor = file.target;
  for (;;) {
    try {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink()) throw new Error(`Refusing symlink recipe target: ${cursor}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  if (
    (await fs.pathExists(file.target)) &&
    (await fs.readFile(file.target, 'utf8')) !== file.content
  ) {
    throw new Error(`PARC catalog recipe target already differs: ${file.target}`);
  }
}

export async function applyPlatformParcCatalogRecipe(
  basePath: string,
  dryRun = false,
): Promise<void> {
  const root = path.resolve(basePath);
  const templateRoot = path.join(__dirname, '../../templates/recipes/platform-parc-catalog');
  const planned = await Promise.all(
    files.map(async ([source, target]) => ({
      target: path.join(root, target),
      content: await readTemplate(path.join(templateRoot, source)),
    })),
  );
  // Check every target before creating any directory or writing any file.
  for (const file of planned) {
    await assertTarget(file);
  }
  for (const file of planned) {
    if (dryRun) console.log(`Would generate: ${file.target}`);
    else if (!(await fs.pathExists(file.target))) {
      await fs.ensureDir(path.dirname(file.target));
      await fs.writeFile(file.target, file.content, { flag: 'wx' });
    }
  }
}
