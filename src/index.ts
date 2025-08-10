#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { generateModule } from './commands/generate-module';
import { generateEntity } from './commands/generate-entity';
import { generateUseCase } from './commands/generate-usecase';
import { generateAll } from './commands/generate-all';

const program = new Command();

program
  .name('ddd')
  .description('CLI for generating NestJS DDD boilerplate code')
  .version('2.0.0');

program
  .command('generate <type> <name>')
  .alias('g')
  .description('Generate boilerplate code')
  .option('-m, --module <module>', 'Module name')
  .option('-p, --path <path>', 'Base path for generation', process.cwd())
  .option('--skip-orm', 'Skip ORM entity generation')
  .option('--skip-mapper', 'Skip mapper generation')
  .option('--skip-repo', 'Skip repository generation')
  .option('--with-events', 'Include domain events')
  .option('--with-queries', 'Include query handlers')
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
        case 'all':
          await generateAll(name, options);
          break;
        default:
          console.error(chalk.red(`Unknown type: ${type}`));
          console.log(chalk.yellow('Available types: module, entity, usecase, all'));
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
  .action(async (entityName, options) => {
    try {
      await generateAll(entityName, { ...options, complete: true });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program.parse();