import * as fs from 'fs-extra';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as ts from 'typescript';
import { applyOidcBffSessionRecipe } from '../../src/commands/recipes/oidc-bff-session.recipe';

describe('Confidential OIDC BFF session recipe', () => {
  let target: string;
  const clientPath = 'src/shared/oidc-bff/oidc-bff.client.ts';
  beforeEach(async () => {
    target = await fs.mkdtemp(path.join(__dirname, '.oidc-bff-'));
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.remove(target);
  });

  it('previews missing and existing roots without any writes', async () => {
    const absent = path.join(target, 'absent');
    await applyOidcBffSessionRecipe(absent, true);
    expect(await fs.pathExists(absent)).toBe(false);
    await applyOidcBffSessionRecipe(target, true);
    expect(await fs.readdir(target)).toEqual([]);
  });

  it('preserves identical reruns and rejects a later conflict before writing any file', async () => {
    await applyOidcBffSessionRecipe(target);
    const client = path.join(target, clientPath);
    const before = await fs.stat(client);
    await applyOidcBffSessionRecipe(target);
    expect((await fs.stat(client)).mtimeMs).toBe(before.mtimeMs);
    const documentation = path.join(target, 'docs/auth/oidc-bff-session.md');
    await fs.writeFile(documentation, 'owned documentation');
    await fs.remove(client);
    await expect(applyOidcBffSessionRecipe(target)).rejects.toThrow('already differs');
    await expect(applyOidcBffSessionRecipe(target, true)).rejects.toThrow('already differs');
    expect(await fs.pathExists(client)).toBe(false);
    expect(await fs.readFile(documentation, 'utf8')).toBe('owned documentation');
  });

  it.each(['directory', 'dangling', 'root'])(
    'refuses a %s symlink without touching another owner',
    async (kind) => {
      const elsewhere = path.join(target, 'elsewhere');
      await fs.ensureDir(elsewhere);
      let base = target;
      if (kind === 'root') {
        base = path.join(target, 'link');
        await fs.symlink(elsewhere, base);
      } else
        await fs.symlink(
          kind === 'dangling' ? path.join(target, 'absent') : elsewhere,
          path.join(target, 'src'),
        );
      await expect(applyOidcBffSessionRecipe(base)).rejects.toThrow('symlink');
      expect(await fs.readdir(elsewhere)).toEqual([]);
      expect(await fs.pathExists(path.join(target, 'docs'))).toBe(false);
    },
  );

  it('rolls back its files and missing directories after an actual write failure', async () => {
    const realWrite = fs.writeFile;
    let calls = 0;
    const mutableFs = require('fs-extra') as typeof fs;
    jest.spyOn(mutableFs, 'writeFile').mockImplementation((async (
      ...args: Parameters<typeof fs.writeFile>
    ) => {
      calls++;
      if (calls === 2) throw new Error('simulated write failure');
      return realWrite(...args);
    }) as typeof fs.writeFile);
    await expect(applyOidcBffSessionRecipe(target)).rejects.toThrow('simulated write failure');
    expect(await fs.readdir(target)).toEqual([]);
  });

  it.each(['replacement', 'modification'])(
    'preserves a concurrent owner %s during rollback',
    async (change) => {
      const realWrite = fs.writeFile;
      const mutableFs = require('fs-extra') as typeof fs;
      const client = path.join(target, clientPath);
      let calls = 0;
      jest.spyOn(mutableFs, 'writeFile').mockImplementation((async (
        ...args: Parameters<typeof fs.writeFile>
      ) => {
        calls++;
        if (calls === 2) {
          if (change === 'replacement') await fs.remove(client);
          await realWrite(client, 'concurrent owner content');
          throw new Error('later write failure');
        }
        return realWrite(...args);
      }) as typeof fs.writeFile);
      await expect(applyOidcBffSessionRecipe(target)).rejects.toThrow('Recipe rollback conflict');
      expect(await fs.readFile(client, 'utf8')).toBe('concurrent owner content');
      expect(await fs.readdir(path.dirname(client))).toEqual([path.basename(client)]);
      expect(await fs.pathExists(path.join(target, 'docs'))).toBe(false);
    },
  );

  it('registers in the rebuilt CLI and keeps CLI dry-run read-only', async () => {
    const entry = path.resolve(__dirname, '../../dist/index.js');
    const output = execFileSync(
      'bun',
      [entry, 'recipe', 'oidc-bff-session', '--path', target, '--dry-run'],
      { encoding: 'utf8' },
    );
    expect(output).toContain('oidc-bff.client.ts');
    expect(await fs.readdir(target)).toEqual([]);
    const listing = execFileSync('bun', [entry, 'recipe'], { encoding: 'utf8' });
    expect(listing).toContain('oidc-bff-session');
  });

  it('strict-compiles the emitted production API and executes real signed OIDC and storage behavior', async () => {
    await applyOidcBffSessionRecipe(target);
    const sourceDir = path.join(target, 'src/shared/oidc-bff');
    const compilerOptions: ts.CompilerOptions = {
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      esModuleInterop: true,
      skipLibCheck: true,
      strict: true,
      noPropertyAccessFromIndexSignature: true,
      noUncheckedIndexedAccess: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      types: ['node'],
      noEmit: true,
    };
    const caller = path.join(sourceDir, 'caller-contract.ts');
    await fs.writeFile(
      caller,
      `
import { OpaqueSessionStore, type SessionCommands } from './index';
export function configured(commands: SessionCommands, externalEpoch: string) {
  // @ts-expect-error A former caller cannot omit the external restore epoch.
  new OpaqueSessionStore(commands, 'held-client');
  return new OpaqueSessionStore(commands, 'held-client', undefined, {}, {
    restoreEpoch: externalEpoch,
  });
}
`,
    );
    const program = ts.createProgram([path.join(sourceDir, 'index.ts'), caller], compilerOptions);
    expect(
      ts.formatDiagnosticsWithColorAndContext(ts.getPreEmitDiagnostics(program), {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
      }),
    ).toBe('');
    const specifications = (await fs.readdir(sourceDir))
      .filter((file) => file.endsWith('.test.ts'))
      .map((file) => path.join(sourceDir, file));
    const proof = execFileSync('bun', ['test', '--reporter=dots', ...specifications], {
      encoding: 'utf8',
      stdio: 'pipe',
      // Unit verification must not inherit permission to reach an operator's Redis.
      env: { ...process.env, OIDC_BFF_TEST_VALKEY_URL: '' },
    });
    expect(proof).toContain('bun test');
    process.stdout.write(
      'Emitted OIDC BFF consumer behavior passed (Redis integration is a separate opt-in profile)\n',
    );
  }, 30000);
});
