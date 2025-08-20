import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 * Check if a package is installed globally
 */
export async function isPackageInstalledGlobally(packageName: string): Promise<boolean> {
  try {
    await execAsync(`npm list -g ${packageName} --depth=0`);
    return true;
  } catch (error) {
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
export async function isLatestVersion(packageName: string, currentVersion: string): Promise<boolean> {
  try {
    const latestVersion = await getLatestVersion(packageName);
    return currentVersion === latestVersion;
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not check for updates: ${(error as Error).message}`));
    return true; // Assume it's the latest version if we can't check
  }
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

/**
 * Create a new NestJS project
 */
export async function createNestJSProject(projectName: string, options: any = {}): Promise<void> {
  try {
    // Check if @nestjs/cli is installed
    const isInstalled = await isNestJSCliInstalled();
    if (!isInstalled) {
      await installNestJSCli();
    }

    console.log(chalk.blue(`Creating new NestJS project: ${projectName}...`));
    
    // Build the command with options
    let command = `nest new ${projectName} --skip-git --package-manager npm`;
    
    if (options.directory) {
      command += ` --directory ${options.directory}`;
    }
    
    if (options.skipInstall) {
      command += ' --skip-install';
    }
    
    await execAsync(command);
    console.log(chalk.green(`✅ NestJS project ${projectName} created successfully!`));
  } catch (error) {
    throw new Error(`Failed to create NestJS project: ${(error as Error).message}`);
  }
}

/**
 * Install dependencies in a project
 */
export async function installDependencies(projectPath: string, dependencies: string[], dev = false): Promise<void> {
  try {
    const flag = dev ? '--save-dev' : '--save';
    console.log(chalk.blue(`Installing ${dev ? 'dev ' : ''}dependencies: ${dependencies.join(', ')}...`));
    await execAsync(`npm install ${flag} ${dependencies.join(' ')}`, { cwd: projectPath });
    console.log(chalk.green('✅ Dependencies installed successfully!'));
  } catch (error) {
    throw new Error(`Failed to install dependencies: ${(error as Error).message}`);
  }
}

/**
 * Check for outdated dependencies in a project
 */
export async function checkOutdatedDependencies(projectPath: string): Promise<Record<string, { current: string; latest: string; type: string }>> {
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
export async function updateDependencies(projectPath: string, dependencies: string[]): Promise<void> {
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
export async function checkForCliUpdate(): Promise<{ needsUpdate: boolean; latestVersion: string; currentVersion: string }> {
  const currentVersion = getCurrentPackageVersion();
  try {
    const latestVersion = await getLatestVersion('nestjs-ddd-cli');
    const needsUpdate = currentVersion !== latestVersion;
    return { needsUpdate, latestVersion, currentVersion };
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Could not check for CLI updates: ${(error as Error).message}`));
    return { needsUpdate: false, latestVersion: currentVersion, currentVersion };
  }
}