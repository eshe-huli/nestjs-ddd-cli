import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';
import { tmpdir } from 'node:os';
import chalk from 'chalk';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

/**
 * Check if a package is installed globally
 */
export async function isPackageInstalledGlobally(packageName: string): Promise<boolean> {
  try {
    await execAsync(`npm list -g ${packageName} --depth=0`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the latest version of a package from npm
 */
export async function getLatestVersion(packageName: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`npm view ${packageName} version`);
    return stdout.trim();
  } catch (error) {
    throw new Error(`Failed to get latest version of ${packageName}: ${(error as Error).message}`);
  }
}

/**
 * Check if the current version is the latest version
 */
export async function isLatestVersion(
  packageName: string,
  currentVersion: string,
): Promise<boolean> {
  try {
    const latestVersion = await getLatestVersion(packageName);
    return !isNewerVersion(latestVersion, currentVersion);
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not check for updates: ${(error as Error).message}`));
    return true; // Assume it's the latest version if we can't check
  }
}

export function isNewerVersion(candidateVersion: string, currentVersion: string): boolean {
  return compareVersions(candidateVersion, currentVersion) > 0;
}

export function compareVersions(leftVersion: string, rightVersion: string): number {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);

  for (const index of [0, 1, 2] as const) {
    const difference = left.parts[index] - right.parts[index];
    if (difference !== 0) {
      return difference > 0 ? 1 : -1;
    }
  }

  if (left.preRelease === right.preRelease) {
    return 0;
  }
  if (!left.preRelease) {
    return 1;
  }
  if (!right.preRelease) {
    return -1;
  }

  return left.preRelease.localeCompare(right.preRelease);
}

function parseVersion(version: string): { parts: [number, number, number]; preRelease?: string } {
  const normalized = version.trim().replace(/^v/i, '');
  const [core = '', preRelease] = normalized.split('-', 2);
  const rawParts = core
    .split('.')
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10));

  return {
    parts: [versionPart(rawParts, 0), versionPart(rawParts, 1), versionPart(rawParts, 2)],
    preRelease,
  };
}

function versionPart(parts: number[], index: number): number {
  const value = parts[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Update a package globally
 */
export async function updatePackageGlobally(packageName: string): Promise<void> {
  try {
    console.log(chalk.blue(`Updating ${packageName} globally...`));
    await execAsync(`npm install -g ${packageName}@latest`);
    console.log(chalk.green(`✅ ${packageName} updated successfully!`));
  } catch (error) {
    throw new Error(`Failed to update ${packageName}: ${(error as Error).message}`);
  }
}

/**
 * Check if NestJS CLI is installed
 */
export async function isNestJSCliInstalled(): Promise<boolean> {
  return isPackageInstalledGlobally('@nestjs/cli');
}

/**
 * Install NestJS CLI globally
 */
export async function installNestJSCli(): Promise<void> {
  try {
    console.log(chalk.blue('Installing @nestjs/cli globally...'));
    await execAsync('npm install -g @nestjs/cli');
    console.log(chalk.green('✅ @nestjs/cli installed successfully!'));
  } catch (error) {
    throw new Error(`Failed to install @nestjs/cli: ${(error as Error).message}`);
  }
}

export function getNestProjectExecution(
  projectName: string,
  options: {
    directory?: string;
    skipInstall?: boolean;
    packageManager?: 'npm' | 'bun';
    collection?: string;
  } = {},
): { args: string[]; cwd: string } {
  const args = [
    'new',
    projectName,
    '--skip-git',
    '--package-manager',
    options.packageManager ?? 'npm',
  ];
  let cwd = process.cwd();
  if (options.collection) args.push('--collection', options.collection);

  if (options.directory) {
    const targetDirectory = path.resolve(options.directory);
    cwd = path.dirname(targetDirectory);
    args.push('--directory', path.basename(targetDirectory));
  }

  if (options.skipInstall || options.packageManager === 'bun') {
    args.push('--skip-install');
  }

  return { args, cwd };
}

/**
 * Create a new NestJS project
 */
export async function createNestJSProject(
  projectName: string,
  options: {
    directory?: string;
    skipInstall?: boolean;
    packageManager?: 'npm' | 'bun';
    collection?: string;
  } = {},
): Promise<void> {
  try {
    let bunNest: string | undefined;
    if (options.packageManager === 'bun') {
      for (const directory of (process.env['PATH'] ?? '').split(path.delimiter)) {
        if (!directory) continue;
        const executable = path.join(directory, 'nest');
        try {
          await fs.access(executable, fs.constants.X_OK);
          bunNest = await fs.realpath(executable);
          break;
        } catch {
          /* Inspect next existing executable; never install globally. */
        }
      }
      if (!bunNest) throw new Error('Bun init requires an existing Nest CLI executable');
    } else {
      // Existing defaults remain intact; explicit Bun skips npm probes/installation.
      const isInstalled = await isNestJSCliInstalled();
      if (!isInstalled) await installNestJSCli();
    }

    console.log(chalk.blue(`Creating new NestJS project: ${projectName}...`));

    const { args, cwd } = getNestProjectExecution(projectName, options);

    if (options.directory) {
      await fs.ensureDir(cwd);
    }

    // Avoid shell parsing of user-provided project names and paths.
    if (bunNest) {
      // Nest's schematics runner hardcodes `node`. The private invocation shim
      // keeps those children on Bun without changing global PATH or installs.
      const runtimeDirectory = await fs.mkdtemp(path.join(tmpdir(), 'ddd-bun-init-'));
      try {
        let bunRuntime: string | undefined;
        for (const directory of (process.env['PATH'] ?? '').split(path.delimiter)) {
          if (!directory) continue;
          try {
            const candidate = path.join(directory, 'bun');
            await fs.access(candidate, fs.constants.X_OK);
            bunRuntime = await fs.realpath(candidate);
            break;
          } catch {
            /* No global installation. */
          }
        }
        if (!bunRuntime) throw new Error('Bun init requires an existing Bun executable');
        await fs.symlink(bunRuntime, path.join(runtimeDirectory, 'node'));
        await execFileAsync('bun', [bunNest, ...args], {
          cwd,
          env: {
            ...process.env,
            PATH: `${runtimeDirectory}${path.delimiter}${process.env['PATH'] ?? ''}`,
          },
        });
      } finally {
        await fs.remove(runtimeDirectory);
      }
    } else {
      await execFileAsync('nest', args, { cwd });
    }
    if (options.packageManager === 'bun' && !options.skipInstall) {
      await execFileAsync('bun', ['install'], {
        cwd: options.directory ? path.resolve(options.directory) : path.resolve(cwd, projectName),
      });
    }
    console.log(chalk.green(`✅ NestJS project ${projectName} created successfully!`));
  } catch (error) {
    throw new Error(`Failed to create NestJS project: ${(error as Error).message}`);
  }
}

/**
 * Install dependencies in a project
 */
export async function installDependencies(
  projectPath: string,
  dependencies: string[],
  dev = false,
  packageManager: 'npm' | 'bun' = 'npm',
): Promise<void> {
  try {
    const flag = dev ? '--save-dev' : '--save';
    console.log(
      chalk.blue(`Installing ${dev ? 'dev ' : ''}dependencies: ${dependencies.join(', ')}...`),
    );
    if (packageManager === 'bun') {
      await execFileAsync('bun', ['add', ...(dev ? ['--dev'] : []), ...dependencies], {
        cwd: projectPath,
      });
    } else {
      await execAsync(`npm install ${flag} ${dependencies.join(' ')}`, { cwd: projectPath });
    }
    console.log(chalk.green('✅ Dependencies installed successfully!'));
  } catch (error) {
    throw new Error(`Failed to install dependencies: ${(error as Error).message}`);
  }
}

/**
 * Check for outdated dependencies in a project
 */
export async function checkOutdatedDependencies(
  projectPath: string,
): Promise<Record<string, { current: string; latest: string; type: string }>> {
  try {
    const { stdout } = await execAsync('npm outdated --json', { cwd: projectPath });
    return JSON.parse(stdout || '{}');
  } catch (error) {
    // npm outdated returns exit code 1 if there are outdated packages
    if ((error as any).stdout) {
      try {
        return JSON.parse((error as any).stdout);
      } catch {
        return {};
      }
    }
    return {};
  }
}

/**
 * Update dependencies in a project
 */
export async function updateDependencies(
  projectPath: string,
  dependencies: string[],
): Promise<void> {
  try {
    console.log(chalk.blue(`Updating dependencies: ${dependencies.join(', ')}...`));
    await execAsync(`npm update ${dependencies.join(' ')}`, { cwd: projectPath });
    console.log(chalk.green('✅ Dependencies updated successfully!'));
  } catch (error) {
    throw new Error(`Failed to update dependencies: ${(error as Error).message}`);
  }
}

/**
 * Get the current package version from package.json
 */
export function getCurrentPackageVersion(): string {
  try {
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    const packageJson = fs.readJsonSync(packageJsonPath);
    return packageJson.version;
  } catch (error) {
    throw new Error(`Failed to get current package version: ${(error as Error).message}`);
  }
}

/**
 * Check if the CLI needs to be updated
 */
export async function checkForCliUpdate(): Promise<{
  needsUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
}> {
  const currentVersion = getCurrentPackageVersion();
  try {
    const latestVersion = await getLatestVersion('nestjs-ddd-cli');
    const needsUpdate = isNewerVersion(latestVersion, currentVersion);
    return { needsUpdate, latestVersion, currentVersion };
  } catch (error) {
    console.warn(
      chalk.yellow(`Warning: Could not check for CLI updates: ${(error as Error).message}`),
    );
    return { needsUpdate: false, latestVersion: currentVersion, currentVersion };
  }
}
