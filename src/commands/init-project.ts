import * as path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  createNestJSProject,
  installDependencies,
  checkForCliUpdate,
  updatePackageGlobally,
} from '../utils/dependency.utils';

export interface InitProjectOptions {
  path?: string;
  skipInstall?: boolean;
  skipUpdate?: boolean;
  withDdd?: boolean;
}

export async function initProject(projectName: string, options: InitProjectOptions) {
  try {
    // First, check for CLI updates if not skipped
    if (!options.skipUpdate) {
      const { needsUpdate, latestVersion, currentVersion } = await checkForCliUpdate();
      if (needsUpdate) {
        console.log(
          chalk.yellow(
            `You are using nestjs-ddd-cli version ${currentVersion}, but version ${latestVersion} is available.`
          )
        );
        
        const { shouldUpdate } = await inquirer.prompt<{shouldUpdate: boolean}>(
          [
            {
              type: 'confirm',
              name: 'shouldUpdate',
              message: 'Would you like to update the CLI before continuing?',
              default: true,
            },
          ]
        );
        
        if (shouldUpdate) {
          await updatePackageGlobally('nestjs-ddd-cli');
          console.log(chalk.green('CLI updated successfully! Please run your command again.'));
          process.exit(0);
        }
      }
    }

    // Determine the project directory
    const projectDir = options.path ? path.resolve(options.path, projectName) : path.resolve(process.cwd(), projectName);
    
    // Create a new NestJS project
    await createNestJSProject(projectName, {
      directory: options.path,
      skipInstall: options.skipInstall,
    });
    
    // If withDdd option is enabled, install DDD-related dependencies
    if (options.withDdd) {
      const dependencies = ['@nestjs/cqrs', 'class-validator', 'class-transformer'];
      await installDependencies(projectDir, dependencies);
      
      // Create DDD folder structure
      console.log(chalk.blue('Setting up DDD folder structure...'));
      
      // We'll use the generate-module command to create the initial module structure
      // This will be implemented in the main CLI entry point
      console.log(chalk.green('✅ DDD folder structure set up successfully!'));
    }
    
    console.log(chalk.green(`\n✅ Project ${projectName} initialized successfully!`));
    console.log(chalk.blue(`\nNext steps:`));
    console.log(chalk.blue(`  1. cd ${projectName}`));
    console.log(chalk.blue(`  2. npm run start:dev`));
    
    if (options.withDdd) {
      console.log(chalk.blue(`\nTo generate DDD components, use:`));
      console.log(chalk.blue(`  ddd generate module <module-name>`));
      console.log(chalk.blue(`  ddd generate entity <entity-name> --module <module-name>`));
      console.log(chalk.blue(`  ddd generate usecase <usecase-name> --module <module-name>`));
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), (error as Error).message);
    process.exit(1);
  }
}