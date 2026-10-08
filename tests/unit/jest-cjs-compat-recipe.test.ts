import * as fs from 'fs-extra';
import * as path from 'node:path';
import * as os from 'node:os';
import * as ts from 'typescript';
import {
  applyJestCommonJsCompatibilityRecipe,
  nestJestCommonJsCompatibility,
} from '../../src/commands/recipes/jest-cjs-compat.recipe';

describe('Nest Jest CommonJS compatibility recipe', () => {
  let target: string;
  const original = {
    name: 'fixture',
    scripts: { test: 'jest', build: 'nest build' },
    dependencies: { '@nestjs/config': '^12.0.0' },
    jest: {
      rootDir: 'src',
      testEnvironment: 'node',
      transform: { '^.+\\.(t|j)s$': 'ts-jest' },
      moduleNameMapper: { '^@modules/(.*)$': '<rootDir>/modules/$1' },
    },
  };
  beforeEach(async () => {
    target = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-jest-compat-'));
    await fs.writeJson(path.join(target, 'package.json'), original);
    await fs.writeJson(path.join(target, 'tsconfig.json'), {
      compilerOptions: {
        module: 'nodenext',
        moduleResolution: 'nodenext',
        resolvePackageJsonExports: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    });
  });
  afterEach(async () => {
    await fs.remove(target);
  });
  it('dry-run preserves every byte and repeated application does not rewrite the owner file', async () => {
    const packagePath = path.join(target, 'package.json');
    const before = await fs.readFile(packagePath, 'utf8');
    await applyJestCommonJsCompatibilityRecipe(target, true);
    expect(await fs.readFile(packagePath, 'utf8')).toBe(before);
    const compiler = await fs.readFile(path.join(target, 'tsconfig.json'), 'utf8');
    await applyJestCommonJsCompatibilityRecipe(target);
    const updated = await fs.readJson(packagePath);
    expect(updated.scripts).toEqual(original.scripts);
    expect(updated.dependencies).toEqual(original.dependencies);
    expect(updated.jest.moduleNameMapper).toEqual(original.jest.moduleNameMapper);
    expect(await fs.readFile(path.join(target, 'tsconfig.json'), 'utf8')).toBe(compiler);
    const stat = await fs.stat(packagePath);
    await applyJestCommonJsCompatibilityRecipe(target);
    expect((await fs.stat(packagePath)).mtimeMs).toBe(stat.mtimeMs);
  });
  it('preserves existing diagnostic/decorator options and excludes all other dependency transforms', () => {
    const transformed = nestJestCommonJsCompatibility({
      ...original.jest,
      transform: {
        '^.+\\.(t|j)s$': [
          'ts-jest',
          {
            diagnostics: true,
            tsconfig: { experimentalDecorators: true, emitDecoratorMetadata: true, strict: true },
          },
        ],
      },
      transformIgnorePatterns: ['/node_modules/', '\\.pnp\\.[^\\/]+$'],
    });
    const tuple = (
      transformed['transform'] as Record<
        string,
        [string, { diagnostics: boolean; tsconfig: Record<string, unknown> }]
      >
    )['^.+\\.(t|j)s$'];
    if (!tuple) throw new Error('Expected the preserved ts-jest transform');
    const options = tuple[1];
    expect(options.diagnostics).toBe(true);
    expect(options.tsconfig['experimentalDecorators']).toBe(true);
    expect(options.tsconfig['emitDecoratorMetadata']).toBe(true);
    const pattern = (transformed['transformIgnorePatterns'] as string[])[0];
    if (!pattern) throw new Error('Expected a dependency exclusion policy');
    const ignore = new RegExp(pattern);
    expect(ignore.test('/project/node_modules/@nestjs/config/dist/index.js')).toBe(false);
    expect(ignore.test('/project/node_modules/@nestjs/config-other/dist/index.js')).toBe(true);
    expect(ignore.test('/project/node_modules/other/index.js')).toBe(true);
    const converted = ts.convertCompilerOptionsFromJson(options.tsconfig, target);
    expect(converted.errors).toEqual([]);
    const output = ts.transpileModule("export * from './config.service.js';", {
      compilerOptions: converted.options,
      fileName: '/project/node_modules/@nestjs/config/dist/index.js',
    }).outputText;
    expect(output).toContain('require("./config.service.js")');
    expect(output).not.toMatch(/\bexport\s+\*/);
  });
  it.each([
    { ...original.jest, transform: { '^.+\\.(t|j)s$': 'babel-jest' } },
    { ...original.jest, transform: { '^.+\\.(t|j)s$': ['ts-jest', { useESM: true }] } },
    { ...original.jest, transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: './owned.json' }] } },
    { ...original.jest, transformIgnorePatterns: ['/node_modules/(?!custom/)'] },
  ])('refuses incompatible owner configuration before mutation', async (jestConfig) => {
    const packagePath = path.join(target, 'package.json');
    await fs.writeJson(packagePath, { ...original, jest: jestConfig });
    const before = await fs.readFile(packagePath, 'utf8');
    await expect(applyJestCommonJsCompatibilityRecipe(target)).rejects.toThrow(/Expected|Refusing/);
    expect(await fs.readFile(packagePath, 'utf8')).toBe(before);
  });
  it('refuses symlinked configuration', async () => {
    const packagePath = path.join(target, 'package.json');
    const owned = path.join(target, 'owned.json');
    await fs.move(packagePath, owned);
    await fs.symlink(owned, packagePath);
    await expect(applyJestCommonJsCompatibilityRecipe(target)).rejects.toThrow('symlink');
    expect(await fs.readJson(owned)).toEqual(original);
  });
});
