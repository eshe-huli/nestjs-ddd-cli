import * as fs from 'fs-extra';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as ts from 'typescript';
import { applyOidcResourceServerRecipe } from '../../src/commands/recipes/oidc-resource-server.recipe';

describe('OIDC resource-server recipe', () => {
  let target: string;
  beforeEach(async () => {
    target = await fs.mkdtemp(path.join(__dirname, '.oidc-resource-'));
  });
  afterEach(async () => {
    await fs.remove(target);
  });
  it('dry-run makes no directories even for a missing output root', async () => {
    const absent = path.join(target, 'absent');
    await applyOidcResourceServerRecipe(absent, true);
    expect(await fs.pathExists(absent)).toBe(false);
  });
  it('repeats identically and refuses a conflict before writing other files', async () => {
    await applyOidcResourceServerRecipe(target);
    const file = path.join(
      target,
      'src/shared/auth/oidc-resource-server/oidc-access-token-verifier.ts',
    );
    const before = await fs.stat(file);
    await applyOidcResourceServerRecipe(target);
    expect((await fs.stat(file)).mtimeMs).toBe(before.mtimeMs);
    await fs.writeFile(file, 'owned custom implementation');
    const docs = path.join(target, 'docs/auth/oidc-resource-server.md');
    await fs.remove(docs);
    await expect(applyOidcResourceServerRecipe(target)).rejects.toThrow('already differs');
    expect(await fs.pathExists(docs)).toBe(false);
    expect(await fs.readFile(file, 'utf8')).toBe('owned custom implementation');
  });
  it('does not traverse a symlinked output directory', async () => {
    const elsewhere = path.join(target, 'elsewhere');
    await fs.ensureDir(elsewhere);
    await fs.symlink(elsewhere, path.join(target, 'src'));
    await expect(applyOidcResourceServerRecipe(target)).rejects.toThrow('symlink');
    expect(await fs.readdir(elsewhere)).toEqual([]);
  });
  it('executes real crypto against generated CommonJS verifier and module', async () => {
    await applyOidcResourceServerRecipe(target);
    const sourceDir = path.join(target, 'src/shared/auth/oidc-resource-server');
    for (const file of await fs.readdir(sourceDir)) {
      const source = await fs.readFile(path.join(sourceDir, file), 'utf8');
      const compiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
        },
      });
      await fs.writeFile(path.join(sourceDir, file.replace(/\.ts$/, '.js')), compiled.outputText);
      await fs.remove(path.join(sourceDir, file));
    }
    const result = execFileSync(
      'bun',
      [path.join(__dirname, '../fixtures/oidc-resource-crypto.cjs'), sourceDir],
      { encoding: 'utf8' },
    );
    expect(result).toContain('crypto cases passed:');
  });
});
