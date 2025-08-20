#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { generateModule } from './commands/generate-module';
import { generateEntity } from './commands/generate-entity';
import { generateUseCase } from './commands/generate-usecase';
import { generateService } from './commands/generate-service';
import { generateEvent } from './commands/generate-event';
import { generateQuery } from './commands/generate-query';
import { generateAll } from './commands/generate-all';
import { initProject } from './commands/init-project';
import { updateCli } from './commands/update-cli';
import { updateDeps } from './commands/update-deps';
import { getCurrentPackageVersion, checkForCliUpdate } from './utils/dependency.utils';

const program = new Command();

program
  .name('ddd')
  .description('CLI for generating NestJS DDD boilerplate code')
  .version(getCurrentPackageVersion());

// Check for updates on every run
(async () => {
  try {
    const { needsUpdate, latestVersion, currentVersion } = await checkForCliUpdate();
    if (needsUpdate) {
      console.log(
        chalk.yellow(
          `You are using nestjs-ddd-cli version ${currentVersion}, but version ${latestVersion} is available.`
        )
      );
      console.log(chalk.yellow(`Run 'ddd update' to update to the latest version.`));
    }
  } catch (error) {
    // Silently ignore update check errors
  }
})();

program
  .command('generate <type> <name>')
  .alias('g')
  .description('Generate boilerplate code (types: module, entity, usecase, service, event, query, all)')
  .option('-m, --module <module>', 'Module name')
  .option('-p, --path <path>', 'Base path for generation', process.cwd())
  .option('--skip-orm', 'Skip ORM entity generation')
  .option('--skip-mapper', 'Skip mapper generation')
  .option('--skip-repo', 'Skip repository generation')
  .option('--with-events', 'Include domain events')
  .option('--with-queries', 'Include query handlers')
  .option('--install-deps', 'Install required dependencies', false)
  .action(async (type, name, options) => {
    try {
      switch (type.toLowerCase()) {
        case 'module':
          await generateModule(name, options);
          break;
        case 'entity':
          await generateEntity(name, options);
          break;
        case 'usecase':
        case 'use-case':
          await generateUseCase(name, options);
          break;
        case 'service':
          await generateService(name, options);
          break;
        case 'event':
          await generateEvent(name, options);
          break;
        case 'query':
          await generateQuery(name, options);
          break;
        case 'all':
          await generateAll(name, options);
          break;
        default:
          console.error(chalk.red(`Unknown type: ${type}`));
          console.log(chalk.yellow('Available types: module, entity, usecase, service, event, query, all'));
          process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('scaffold <entityName>')
  .alias('s')
  .description('Generate complete CRUD scaffolding for an entity')
  .option('-m, --module <module>', 'Module name (will be created if not exists)')
  .option('-p, --path <path>', 'Base path for generation', process.cwd())
  .option('--install-deps', 'Install required dependencies', false)
  .action(async (entityName, options) => {
    try {
      await generateAll(entityName, { ...options, complete: true });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Initialize a new NestJS project with DDD structure
program
  .command('init <projectName>')
  .description('Initialize a new NestJS project with DDD structure')
  .option('-p, --path <path>', 'Path where the project will be created')
  .option('--skip-install', 'Skip dependency installation')
  .option('--skip-update', 'Skip CLI update check')
  .option('--with-ddd', 'Set up DDD folder structure and install required dependencies', true)
  .action(async (projectName, options) => {
    try {
      await initProject(projectName, options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Update the CLI to the latest version
program
  .command('update')
  .description('Update the CLI to the latest version')
  .option('-f, --force', 'Force update even if already on latest version')
  .action(async (options) => {
    try {
      await updateCli(options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Update project dependencies
program
  .command('update-deps')
  .description('Check and update project dependencies')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-a, --all', 'Update all outdated dependencies without prompting')
  .action(async (options) => {
    try {
      await updateDeps(options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program.parse();