import * as fs from 'fs-extra';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as ts from 'typescript';
import { applyBoundedBinaryHttpRecipe } from '../../src/commands/recipes/bounded-binary-http.recipe';

describe('Framework-independent bounded binary and HEAD recipe', () => {
  let target: string;
  const relativeClient = 'src/shared/http/bounded-binary-http.client.ts';
  const relativeDocumentation = 'docs/http/bounded-binary-http.md';
  const templateRoot = path.resolve(__dirname, '../../src/templates/recipes/bounded-binary-http');

  beforeEach(async () => {
    target = await fs.mkdtemp(path.join(__dirname, '.bounded-binary-'));
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.remove(target);
  });

  it('previews absent and existing roots without writes', async () => {
    const absent = path.join(target, 'missing');
    await applyBoundedBinaryHttpRecipe(absent, true);
    expect(await fs.pathExists(absent)).toBe(false);
    await applyBoundedBinaryHttpRecipe(target, true);
    expect(await fs.readdir(target)).toEqual([]);
  });

  it('emits the canonical transport with no framework imports or consumer tests', async () => {
    await applyBoundedBinaryHttpRecipe(target);
    const client = await fs.readFile(path.join(target, relativeClient), 'utf8');
    expect(client).toBe(await fs.readFile(path.join(templateRoot, 'client.ts.hbs'), 'utf8'));
    expect(client).not.toMatch(/\bimport\s|@nestjs|bun:test|\bjest\./);
    expect(await fs.readdir(path.dirname(path.join(target, relativeClient)))).toEqual([
      'bounded-binary-http.client.ts',
    ]);
    expect(await fs.readdir(path.join(target, 'docs/http'))).toEqual(['bounded-binary-http.md']);
  });

  it('preserves matching reruns and all-target conflict preflight', async () => {
    await applyBoundedBinaryHttpRecipe(target);
    const client = path.join(target, relativeClient);
    const before = await fs.stat(client);
    await applyBoundedBinaryHttpRecipe(target);
    expect((await fs.stat(client)).mtimeMs).toBe(before.mtimeMs);
    await fs.writeFile(path.join(target, relativeDocumentation), 'another owner');
    await fs.remove(client);
    await expect(applyBoundedBinaryHttpRecipe(target)).rejects.toThrow('already differs');
    await expect(applyBoundedBinaryHttpRecipe(target, true)).rejects.toThrow('already differs');
    expect(await fs.pathExists(client)).toBe(false);
  });

  it.each(['root', 'src', 'docs'])('refuses a %s symlink without external writes', async (kind) => {
    const elsewhere = path.join(target, 'external');
    await fs.ensureDir(elsewhere);
    const link = path.join(target, kind === 'root' ? 'linked-root' : kind);
    await fs.symlink(elsewhere, link);
    await expect(applyBoundedBinaryHttpRecipe(kind === 'root' ? link : target)).rejects.toThrow(
      'symlink',
    );
    expect(await fs.readdir(elsewhere)).toEqual([]);
    expect(await fs.pathExists(path.join(target, relativeClient))).toBe(false);
  });

  it('rolls back only unchanged owned output after a later write failure', async () => {
    const realWrite = fs.writeFile;
    const mutableFs = require('fs-extra') as typeof fs;
    let calls = 0;
    jest.spyOn(mutableFs, 'writeFile').mockImplementation((async (
      ...args: Parameters<typeof fs.writeFile>
    ) => {
      if (++calls === 2) throw new Error('later failure');
      return realWrite(...args);
    }) as typeof fs.writeFile);
    await expect(applyBoundedBinaryHttpRecipe(target)).rejects.toThrow('later failure');
    expect(await fs.readdir(target)).toEqual([]);
  });

  it('preserves a concurrent successor during rollback', async () => {
    const realWrite = fs.writeFile;
    const mutableFs = require('fs-extra') as typeof fs;
    const client = path.join(target, relativeClient);
    let calls = 0;
    jest.spyOn(mutableFs, 'writeFile').mockImplementation((async (
      ...args: Parameters<typeof fs.writeFile>
    ) => {
      if (++calls === 2) {
        await fs.remove(client);
        await realWrite(client, 'successor');
        throw new Error('later failure');
      }
      return realWrite(...args);
    }) as typeof fs.writeFile);
    await expect(applyBoundedBinaryHttpRecipe(target)).rejects.toThrow('Recipe rollback conflict');
    expect(await fs.readFile(client, 'utf8')).toBe('successor');
  });

  it('registers actual CLI list and dry-run without target mutation', async () => {
    const entry = path.resolve(__dirname, '../../dist/index.js');
    const output = execFileSync(
      'bun',
      [entry, 'recipe', 'bounded-binary-http', '--path', target, '--dry-run'],
      { encoding: 'utf8' },
    );
    expect(output).toContain('bounded-binary-http.client.ts');
    expect(await fs.readdir(target)).toEqual([]);
    expect(execFileSync('bun', [entry, 'recipe'], { encoding: 'utf8' })).toContain(
      'bounded-binary-http',
    );
  });

  it('strict-compiles dependency-free output and proves emitted injected plus real HTTP behavior', async () => {
    await applyBoundedBinaryHttpRecipe(target);
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
    const spec = await fs.readFile(path.join(templateRoot, 'client.spec.ts.hbs'), 'utf8');
    const source = await fs.readFile(client, 'utf8');
    for (const [name, content] of [
      ['bounded-binary-http.client.js', source],
      ['bounded-binary-http.client.spec.js', spec],
    ]) {
      if (!name || content === undefined) throw new Error('Missing proof source');
      await fs.writeFile(
        path.join(sourceDir, name),
        ts.transpileModule(content, {
          compilerOptions,
        }).outputText,
      );
    }
    const proofPath = path.join(target, 'binary-transport-proof.json');
    execFileSync(
      'bun',
      [
        require.resolve('jest/bin/jest'),
        '--runInBand',
        '--runTestsByPath',
        path.join(sourceDir, 'bounded-binary-http.client.spec.js'),
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
    expect(proof.numPassedTests).toBeGreaterThanOrEqual(40);
    expect(proof.testResults.flatMap((suite) => suite.assertionResults)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'bounds an ignored abort and cancels a late response body',
          status: 'passed',
        }),
        expect.objectContaining({
          title: 'does not redrive a real uncertain POST',
          status: 'passed',
        }),
        expect.objectContaining({
          title: 'does not redrive a real uncertain PATCH',
          status: 'passed',
        }),
      ]),
    );
    process.stdout.write(`Binary/HEAD emitted proof: ${proof.numPassedTests} passed\n`);
  }, 30000);
});
