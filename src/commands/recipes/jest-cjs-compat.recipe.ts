import * as path from 'node:path';
import * as fs from 'fs-extra';

const TRANSFORM = '^.+\\.(t|j)s$';
const CONFIG_EXCEPTION = '/node_modules/(?!@nestjs/config(?:/|$))';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Jest-only overrides; production compiler options and dependency versions stay owned. */
export function nestJestCommonJsCompatibility(value: unknown): Record<string, unknown> {
  const config = record(value);
  const transform = record(config?.['transform']);
  const current = transform?.[TRANSFORM];
  const tuple = Array.isArray(current) ? current : [current];
  const options = tuple.length === 1 ? {} : record(tuple[1]);
  if (!config || !transform || tuple[0] !== 'ts-jest' || tuple.length > 2 || !options) {
    throw new Error('Expected an existing ts-jest JavaScript/TypeScript transform');
  }
  const compilerOptions = options['tsconfig'] === undefined ? {} : record(options['tsconfig']);
  if (!compilerOptions || options['useESM'] === true) {
    throw new Error('Refusing to replace an explicit ESM or file-based Jest tsconfig');
  }
  const ignored = config['transformIgnorePatterns'] ?? ['/node_modules/', '\\.pnp\\.[^\\/]+$'];
  if (
    ignored !== undefined &&
    (!Array.isArray(ignored) ||
      ignored.some((entry) => typeof entry !== 'string') ||
      ignored.some(
        (entry) =>
          entry.includes('node_modules') &&
          entry !== CONFIG_EXCEPTION &&
          entry !== '/node_modules/' &&
          entry !== 'node_modules/',
      ))
  ) {
    throw new Error('Refusing to replace a customized node_modules transform policy');
  }
  return {
    ...config,
    transform: {
      ...transform,
      [TRANSFORM]: [
        'ts-jest',
        {
          ...options,
          tsconfig: {
            ...compilerOptions,
            allowJs: true,
            module: 'CommonJS',
            moduleResolution: 'node',
            resolvePackageJsonExports: false,
            resolvePackageJsonImports: false,
          },
        },
      ],
    },
    transformIgnorePatterns: [
      CONFIG_EXCEPTION,
      ...((ignored ?? []) as string[]).filter((entry) => !entry.includes('node_modules')),
    ],
  };
}

export async function applyJestCommonJsCompatibilityRecipe(
  basePath: string,
  dryRun = false,
): Promise<void> {
  const root = path.resolve(basePath);
  const target = path.join(root, 'package.json');
  let cursor = target;
  while (true) {
    const stat = await fs.lstat(cursor);
    if (stat.isSymbolicLink())
      throw new Error(`Refusing symlink Jest configuration target: ${cursor}`);
    if (cursor === target ? !stat.isFile() : !stat.isDirectory()) {
      throw new Error(`Invalid Jest configuration target: ${cursor}`);
    }
    if (cursor === root) break;
    cursor = path.dirname(cursor);
  }
  const before = await fs.readFile(target, 'utf8');
  const packageJson = record(JSON.parse(before));
  if (!packageJson) throw new Error('Expected an object package.json');
  const updated = {
    ...packageJson,
    jest: nestJestCommonJsCompatibility(packageJson['jest']),
  };
  if (JSON.stringify(packageJson) === JSON.stringify(updated)) return;
  if (dryRun) {
    console.log(`Would update Jest-only ts-jest compatibility: ${target}`);
    return;
  }
  if ((await fs.readFile(target, 'utf8')) !== before) {
    throw new Error('Jest configuration changed after preflight; preserving owner changes');
  }
  await fs.writeFile(target, `${JSON.stringify(updated, null, 2)}\n`);
}
