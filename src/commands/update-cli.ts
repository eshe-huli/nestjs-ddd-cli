import chalk from 'chalk';
import {
  checkForCliUpdate,
  updatePackageGlobally,
} from '../utils/dependency.utils';

export interface UpdateCliOptions {
  force?: boolean;
}

export async function updateCli(options: UpdateCliOptions = {}) {
  try {
    console.log(chalk.blue('Checking for CLI updates...'));
    
    const { needsUpdate, latestVersion, currentVersion } = await checkForCliUpdate();
    
    if (needsUpdate || options.force) {
      console.log(
        chalk.yellow(
          `You are using nestjs-ddd-cli version ${currentVersion}, updating to version ${latestVersion}...`
        )
      );
      
      await updatePackageGlobally('nestjs-ddd-cli');
      console.log(chalk.green('✅ CLI updated successfully!'));
    } else {
      console.log(chalk.green(`✅ You are already using the latest version (${currentVersion})!`));
    }
  } catch (error) {
    console.error(chalk.red('Error:'), (error as Error).message);
    process.exit(1);
  }
}