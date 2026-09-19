import * as path from 'node:path';
import * as fs from 'fs-extra';
import { readTemplate } from '../../utils/file.utils';

const files = [
  ['verifier.ts.hbs', 'src/shared/auth/oidc-resource-server/oidc-access-token-verifier.ts'],
  [
    'verifier.spec.ts.hbs',
    'src/shared/auth/oidc-resource-server/oidc-access-token-verifier.spec.ts',
  ],
  ['module.ts.hbs', 'src/shared/auth/oidc-resource-server/oidc-resource-server.module.ts'],
  ['index.ts.hbs', 'src/shared/auth/oidc-resource-server/index.ts'],
  ['README.md.hbs', 'docs/auth/oidc-resource-server.md'],
] as const;

async function assertTarget(
  root: string,
  file: { target: string; content: string },
): Promise<void> {
  let cursor = file.target;
  while (cursor !== root) {
    if (await fs.pathExists(cursor)) {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink()) throw new Error(`Refusing symlink recipe target: ${cursor}`);
    }
    cursor = path.dirname(cursor);
  }
  if (
    (await fs.pathExists(file.target)) &&
    (await fs.readFile(file.target, 'utf8')) !== file.content
  ) {
    throw new Error(`OIDC resource recipe target already differs: ${file.target}`);
  }
}

export async function applyOidcResourceServerRecipe(
  basePath: string,
  dryRun = false,
): Promise<void> {
  const root = path.resolve(basePath);
  const templateRoot = path.join(__dirname, '../../templates/recipes/oidc-resource-server');
  const planned = await Promise.all(
    files.map(async ([source, target]) => ({
      target: path.join(root, target),
      content: await readTemplate(path.join(templateRoot, source)),
    })),
  );
  // Check every target before creating any directory or writing any file.
  for (const file of planned) {
    await assertTarget(root, file);
  }
  for (const file of planned) {
    if (dryRun) console.log(`Would generate: ${file.target}`);
    else if (!(await fs.pathExists(file.target))) {
      await fs.ensureDir(path.dirname(file.target));
      await fs.writeFile(file.target, file.content, { flag: 'wx' });
    }
  }
}
