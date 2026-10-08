import * as fs from 'fs-extra';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as ts from 'typescript';
import { applyOAuth2TokenIntrospectionRecipe } from '../../src/commands/recipes/oauth2-token-introspection.recipe';

describe('OAuth2 token introspection recipe', () => {
  let target: string;
  const clientPath =
    'src/shared/auth/oauth2-token-introspection/oauth2-token-introspection.client.ts';
  beforeEach(async () => {
    target = await fs.mkdtemp(path.join(__dirname, '.introspection-'));
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.remove(target);
  });

  it('previews missing and existing roots without any writes', async () => {
    const absent = path.join(target, 'absent');
    await applyOAuth2TokenIntrospectionRecipe(absent, true);
    expect(await fs.pathExists(absent)).toBe(false);
    await applyOAuth2TokenIntrospectionRecipe(target, true);
    expect(await fs.readdir(target)).toEqual([]);
  });

  it('preserves identical reruns and rejects a later conflict before writing any file', async () => {
    await applyOAuth2TokenIntrospectionRecipe(target);
    const client = path.join(target, clientPath);
    const before = await fs.stat(client);
    await applyOAuth2TokenIntrospectionRecipe(target);
    expect((await fs.stat(client)).mtimeMs).toBe(before.mtimeMs);
    const documentation = path.join(target, 'docs/auth/oauth2-token-introspection.md');
    await fs.writeFile(documentation, 'owned documentation');
    await fs.remove(client);
    await expect(applyOAuth2TokenIntrospectionRecipe(target)).rejects.toThrow('already differs');
    await expect(applyOAuth2TokenIntrospectionRecipe(target, true)).rejects.toThrow(
      'already differs',
    );
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
      await expect(applyOAuth2TokenIntrospectionRecipe(base)).rejects.toThrow('symlink');
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
    await expect(applyOAuth2TokenIntrospectionRecipe(target)).rejects.toThrow(
      'simulated write failure',
    );
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
      await expect(applyOAuth2TokenIntrospectionRecipe(target)).rejects.toThrow(
        'Recipe rollback conflict',
      );
      expect(await fs.readFile(client, 'utf8')).toBe('concurrent owner content');
      expect(await fs.readdir(path.dirname(client))).toEqual([path.basename(client)]);
      expect(await fs.pathExists(path.join(target, 'docs'))).toBe(false);
    },
  );

  it('registers in the rebuilt CLI and keeps CLI dry-run read-only', async () => {
    const entry = path.resolve(__dirname, '../../dist/index.js');
    const output = execFileSync(
      'bun',
      [entry, 'recipe', 'oauth2-token-introspection', '--path', target, '--dry-run'],
      { encoding: 'utf8' },
    );
    expect(output).toContain('oauth2-token-introspection.client.ts');
    expect(await fs.readdir(target)).toEqual([]);
    const listing = execFileSync('bun', [entry, 'recipe'], { encoding: 'utf8' });
    expect(listing).toContain('oauth2-token-introspection');
  });

  it('strict-compiles generated output and executes the emitted consumer behavior spec', async () => {
    await applyOAuth2TokenIntrospectionRecipe(target);
    const sourceDir = path.join(target, 'src/shared/auth/oauth2-token-introspection');
    const files = (await fs.readdir(sourceDir)).filter((file) => file.endsWith('.ts'));
    const compilerOptions: ts.CompilerOptions = {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      esModuleInterop: true,
      skipLibCheck: true,
      strict: true,
      noPropertyAccessFromIndexSignature: true,
      noUncheckedIndexedAccess: true,
      noUnusedLocals: true,
      types: ['node', 'jest'],
    };
    const program = ts.createProgram(
      files.map((file) => path.join(sourceDir, file)),
      compilerOptions,
    );
    expect(
      ts.formatDiagnosticsWithColorAndContext(ts.getPreEmitDiagnostics(program), {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
      }),
    ).toBe('');
    for (const file of files) {
      const source = await fs.readFile(path.join(sourceDir, file), 'utf8');
      await fs.writeFile(
        path.join(sourceDir, file.replace(/\.ts$/, '.js')),
        ts.transpileModule(source, { compilerOptions }).outputText,
      );
    }
    const specifications = [
      'oauth2-token-introspection.client.spec.js',
      'bounded-json-http.client.spec.js',
    ].map((file) => path.join(sourceDir, file));
    execFileSync(
      'bun',
      [
        require.resolve('jest/bin/jest'),
        '--runInBand',
        '--runTestsByPath',
        ...specifications,
        '--json',
        '--outputFile',
        path.join(target, 'consumer-proof.json'),
        '--config',
        JSON.stringify({
          rootDir: sourceDir,
          testEnvironment: 'node',
          // Jest 30 global GC traverses Bun Web Stream getters incorrectly.
          testEnvironmentOptions: { globalsCleanup: 'off' },
          testMatch: ['**/*.spec.js'],
          verbose: false,
        }),
      ],
      { encoding: 'utf8', stdio: 'pipe' },
    );
    const proof = (await fs.readJson(path.join(target, 'consumer-proof.json'))) as {
      success: boolean;
      numPassedTests: number;
      numFailedTests: number;
      numTotalTestSuites: number;
    };
    expect(proof.success).toBe(true);
    expect(proof.numFailedTests).toBe(0);
    expect(proof.numTotalTestSuites).toBe(2);
    process.stdout.write(
      `Generated consumer proof: ${proof.numPassedTests} passed in ${proof.numTotalTestSuites} suites\n`,
    );
  }, 30000);
});
