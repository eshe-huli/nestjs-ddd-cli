import * as fs from 'fs-extra';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as ts from 'typescript';
import { applyBoundedJsonHttpRecipe } from '../../src/commands/recipes/bounded-json-http.recipe';

describe('Framework-independent bounded JSON HTTP recipe', () => {
  let target: string;
  const relativeClient = 'src/shared/auth/oauth2-token-introspection/bounded-json-http.client.ts';
  const relativeDocumentation = 'docs/auth/bounded-json-http.md';
  const templateRoot = path.resolve(__dirname, '../../src/templates/recipes');

  beforeEach(async () => {
    target = await fs.mkdtemp(path.join(__dirname, '.bounded-http-'));
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.remove(target);
  });

  it('previews absent and existing roots without writes', async () => {
    const absent = path.join(target, 'missing');
    await applyBoundedJsonHttpRecipe(absent, true);
    expect(await fs.pathExists(absent)).toBe(false);
    await applyBoundedJsonHttpRecipe(target, true);
    expect(await fs.readdir(target)).toEqual([]);
  });

  it('emits the unchanged transport without framework imports, module or test globals', async () => {
    await applyBoundedJsonHttpRecipe(target);
    const client = await fs.readFile(path.join(target, relativeClient), 'utf8');
    expect(client).toBe(
      await fs.readFile(
        path.join(templateRoot, 'oauth2-token-introspection/http-client.ts.hbs'),
        'utf8',
      ),
    );
    expect(client).not.toMatch(/\bimport\s|@nestjs|bun:test|\bjest\./);
    expect(await fs.readdir(path.dirname(path.join(target, relativeClient)))).toEqual([
      'bounded-json-http.client.ts',
    ]);
    expect(await fs.readdir(path.join(target, 'docs/auth'))).toEqual(['bounded-json-http.md']);
  });

  it('preserves matching reruns and preflights the whole plan before creating a missing client', async () => {
    await applyBoundedJsonHttpRecipe(target);
    const client = path.join(target, relativeClient);
    const before = await fs.stat(client);
    await applyBoundedJsonHttpRecipe(target);
    expect((await fs.stat(client)).mtimeMs).toBe(before.mtimeMs);
    const documentation = path.join(target, relativeDocumentation);
    await fs.writeFile(documentation, 'another owner');
    await fs.remove(client);
    await expect(applyBoundedJsonHttpRecipe(target)).rejects.toThrow('already differs');
    await expect(applyBoundedJsonHttpRecipe(target, true)).rejects.toThrow('already differs');
    expect(await fs.pathExists(client)).toBe(false);
    expect(await fs.readFile(documentation, 'utf8')).toBe('another owner');
  });

  it.each(['root', 'src', 'docs'])('refuses a %s symlink without external writes', async (kind) => {
    const elsewhere = path.join(target, 'external');
    await fs.ensureDir(elsewhere);
    const link = path.join(target, kind === 'root' ? 'linked-root' : kind);
    await fs.symlink(elsewhere, link);
    await expect(applyBoundedJsonHttpRecipe(kind === 'root' ? link : target)).rejects.toThrow(
      'symlink',
    );
    expect(await fs.readdir(elsewhere)).toEqual([]);
    expect(await fs.pathExists(path.join(target, relativeClient))).toBe(false);
  });

  it('rolls back owned files after a later write failure', async () => {
    const realWrite = fs.writeFile;
    const mutableFs = require('fs-extra') as typeof fs;
    let calls = 0;
    jest.spyOn(mutableFs, 'writeFile').mockImplementation((async (
      ...args: Parameters<typeof fs.writeFile>
    ) => {
      if (++calls === 2) throw new Error('later write failure');
      return realWrite(...args);
    }) as typeof fs.writeFile);
    await expect(applyBoundedJsonHttpRecipe(target)).rejects.toThrow('later write failure');
    expect(await fs.readdir(target)).toEqual([]);
  });

  it.each(['replacement', 'modification'])(
    'preserves a concurrent owner %s during rollback',
    async (change) => {
      const realWrite = fs.writeFile;
      const mutableFs = require('fs-extra') as typeof fs;
      const client = path.join(target, relativeClient);
      let calls = 0;
      jest.spyOn(mutableFs, 'writeFile').mockImplementation((async (
        ...args: Parameters<typeof fs.writeFile>
      ) => {
        if (++calls === 2) {
          if (change === 'replacement') await fs.remove(client);
          await realWrite(client, 'successor owner');
          throw new Error('later write failure');
        }
        return realWrite(...args);
      }) as typeof fs.writeFile);
      await expect(applyBoundedJsonHttpRecipe(target)).rejects.toThrow('Recipe rollback conflict');
      expect(await fs.readFile(client, 'utf8')).toBe('successor owner');
      expect(await fs.pathExists(path.join(target, 'docs'))).toBe(false);
    },
  );

  it('registers CLI dry-run and keeps the target empty', async () => {
    const entry = path.resolve(__dirname, '../../dist/index.js');
    const output = execFileSync(
      'bun',
      [entry, 'recipe', 'bounded-json-http', '--path', target, '--dry-run'],
      { encoding: 'utf8' },
    );
    expect(output).toContain('bounded-json-http.client.ts');
    expect(await fs.readdir(target)).toEqual([]);
    expect(execFileSync('bun', [entry, 'recipe'], { encoding: 'utf8' })).toContain(
      'bounded-json-http',
    );
  });

  it('strict-compiles without framework types and executes the shared transport contract', async () => {
    await applyBoundedJsonHttpRecipe(target);
    const client = path.join(target, relativeClient);
    const sourceDir = path.dirname(client);
    const compilerOptions: ts.CompilerOptions = {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      skipLibCheck: true,
      strict: true,
      noPropertyAccessFromIndexSignature: true,
      noUncheckedIndexedAccess: true,
      noUnusedLocals: true,
      types: [],
    };
    const program = ts.createProgram([client], compilerOptions);
    expect(
      ts.formatDiagnosticsWithColorAndContext(ts.getPreEmitDiagnostics(program), {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
      }),
    ).toBe('');
    // Consumer proof is temporary; the recipe itself emits no framework test imports.
    const spec = await fs.readFile(
      path.join(templateRoot, 'oauth2-token-introspection/http-client.spec.ts.hbs'),
      'utf8',
    );
    for (const [name, source] of [
      ['bounded-json-http.client.js', await fs.readFile(client, 'utf8')],
      ['bounded-json-http.client.spec.js', spec],
    ]) {
      await fs.writeFile(
        path.join(sourceDir, name!),
        ts.transpileModule(source!, { compilerOptions }).outputText,
      );
    }
    const proofPath = path.join(target, 'transport-proof.json');
    execFileSync(
      'bun',
      [
        require.resolve('jest/bin/jest'),
        '--runInBand',
        '--runTestsByPath',
        path.join(sourceDir, 'bounded-json-http.client.spec.js'),
        '--json',
        '--outputFile',
        proofPath,
        '--config',
        JSON.stringify({
          rootDir: sourceDir,
          testEnvironment: 'node',
          testEnvironmentOptions: { globalsCleanup: 'off' },
          testMatch: ['**/*.spec.js'],
        }),
      ],
      { encoding: 'utf8', stdio: 'pipe' },
    );
    const proof = (await fs.readJson(proofPath)) as {
      success: boolean;
      numPassedTests: number;
      numFailedTests: number;
      testResults: { assertionResults: { title: string; status: string }[] }[];
    };
    expect(proof.success).toBe(true);
    expect(proof.numFailedTests).toBe(0);
    const assertions = proof.testResults.flatMap((suite) => suite.assertionResults);
    expect(assertions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'PUTs one immutable JSON decision with an encoded bounded challenge query',
          status: 'passed',
        }),
        expect.objectContaining({
          title:
            'bounds the whole PUT transport and stream deadline even when the provider ignores abort',
          status: 'passed',
        }),
      ]),
    );
    process.stdout.write(`Transport-only consumer proof: ${proof.numPassedTests} passed\n`);
  }, 30000);
});
