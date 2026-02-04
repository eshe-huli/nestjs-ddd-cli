import * as path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  createNestJSProject,
  installDependencies,
  checkForCliUpdate,
  updatePackageGlobally,
} from '../utils/dependency.utils';
import { writeFile, generateFromTemplate, ensureDir } from '../utils/file.utils';
import { createDefaultConfig } from '../utils/config.utils';

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

        const { shouldUpdate } = await inquirer.prompt<{ shouldUpdate: boolean }>([
          {
            type: 'confirm',
            name: 'shouldUpdate',
            message: 'Would you like to update the CLI before continuing?',
            default: true,
          },
        ]);

        if (shouldUpdate) {
          await updatePackageGlobally('nestjs-ddd-cli');
          console.log(chalk.green('CLI updated successfully! Please run your command again.'));
          process.exit(0);
        }
      }
    }

    // Determine the project directory
    const projectDir = options.path
      ? path.resolve(options.path, projectName)
      : path.resolve(process.cwd(), projectName);

    // Create a new NestJS project
    await createNestJSProject(projectName, {
      directory: options.path,
      skipInstall: options.skipInstall,
    });

    // If withDdd option is enabled, install DDD-related dependencies
    if (options.withDdd) {
      const dependencies = [
        '@nestjs/cqrs',
        '@nestjs/swagger',
        'class-validator',
        'class-transformer',
      ];
      await installDependencies(projectDir, dependencies);

      // Create DDD folder structure
      console.log(chalk.blue('Setting up DDD folder structure...'));

      // Create directories
      await ensureDir(path.join(projectDir, 'src/modules'));
      await ensureDir(path.join(projectDir, 'src/shared'));
      await ensureDir(path.join(projectDir, 'src/migrations'));

      // Create .dddrc.json config file
      console.log(chalk.cyan('  Creating configuration file...'));
      await createDefaultConfig(projectDir);

      // Create AI context files
      console.log(chalk.cyan('  Creating AI context files...'));
      await createAiContextFiles(projectDir, projectName);

      // Create tsconfig paths for module aliases
      await updateTsConfig(projectDir);

      console.log(chalk.green('✅ DDD folder structure set up successfully!'));
    }

    console.log(chalk.green(`\n✅ Project ${projectName} initialized successfully!`));
    console.log(chalk.blue(`\nNext steps:`));
    console.log(chalk.blue(`  1. cd ${projectName}`));
    console.log(chalk.blue(`  2. npm run start:dev`));

    if (options.withDdd) {
      console.log(chalk.blue(`\nTo generate DDD components, use:`));
      console.log(
        chalk.blue(`  ddd scaffold User -m users --fields "name:string email:string:unique"`)
      );
      console.log(chalk.blue(`  ddd generate module <module-name>`));
      console.log(chalk.blue(`  ddd generate entity <entity-name> -m <module-name>`));
      console.log(chalk.blue(`  ddd generate usecase <usecase-name> -m <module-name>`));
    }
  } catch (error) {
    console.error(chalk.red('Error:'), (error as Error).message);
    process.exit(1);
  }
}

async function createAiContextFiles(projectDir: string, projectName: string) {
  const templateData = { projectName };

  // Create CLAUDE.md (AI context file for Claude Code and similar tools)
  const claudeTemplatePath = path.join(__dirname, '../templates/ai-context/CLAUDE.md.hbs');
  const claudeOutputPath = path.join(projectDir, 'CLAUDE.md');
  await generateFromTemplate(claudeTemplatePath, claudeOutputPath, templateData as any);

  // Create conventions.md
  const conventionsTemplatePath = path.join(__dirname, '../templates/ai-context/conventions.md.hbs');
  const conventionsOutputPath = path.join(projectDir, 'docs/conventions.md');
  await ensureDir(path.join(projectDir, 'docs'));
  await generateFromTemplate(conventionsTemplatePath, conventionsOutputPath, templateData as any);
}

async function updateTsConfig(projectDir: string) {
  const tsconfigPath = path.join(projectDir, 'tsconfig.json');

  try {
    const tsconfig = require(tsconfigPath);

    // Add path aliases
    tsconfig.compilerOptions = tsconfig.compilerOptions || {};
    tsconfig.compilerOptions.paths = {
      '@modules/*': ['src/modules/*'],
      '@shared/*': ['src/shared/*'],
      ...(tsconfig.compilerOptions.paths || {}),
    };

    await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  } catch (error) {
    // If we can't update tsconfig, that's okay - continue with the setup
    console.log(
      chalk.yellow('  Note: Could not update tsconfig.json paths. You may need to add them manually.')
    );
  }
}
