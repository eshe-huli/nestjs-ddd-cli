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
import { applyRecipe, listRecipes } from './commands/recipe';
import { generateShared } from './commands/generate-shared';
import { runDoctor } from './commands/doctor';
import { interactiveScaffold } from './commands/interactive-scaffold';
import { generateFromSchema, createSampleSchema } from './commands/generate-from-schema';
import { generateDeployment } from './commands/generate-deployment';
import { getCurrentPackageVersion, checkForCliUpdate } from './utils/dependency.utils';
import { initConfig, listPresets } from './commands/init-config';
import { runEnhancedDoctor } from './commands/doctor-enhanced';
import { exportOpenApi } from './commands/openapi-export';
import { createMigration, generateMigrationFromEntity } from './commands/migration';
import { generateGraphQLTypes } from './commands/graphql-types';
import { analyzeDependencies } from './commands/dependency-graph';
import { listPlugins, installPluginCommand, uninstallPluginCommand, runPluginCommand, scaffoldPlugin } from './commands/recipe-plugin';
import { debugTemplate } from './commands/template-debug';
import { perf } from './utils/performance.utils';
import { analyzeCode } from './commands/code-analyzer';
import { batchGenerate, createBatchSchema } from './commands/batch-generate';
import { generateTestScaffold } from './commands/test-scaffold';
import { setupMultiDatabase } from './commands/multi-database';
import { generateApiDocs } from './commands/api-docs';
import { initEnvManager, validateEnvCommand } from './commands/env-manager';
import { analyzePerformance } from './commands/perf-analyzer';
import { initMonorepo, addWorkspace } from './commands/monorepo';
import { aiAssist, configureAiAssist } from './commands/ai-assist';
import { diffMigration } from './commands/migration-engine';
import { generateFilterDSL } from './commands/filter-dsl';
import { setupEventSourcingFramework } from './commands/event-sourcing-full';
import { setupTestInfrastructure } from './commands/test-factory-full';
import { generateValueObject, setupValueObjects } from './commands/generate-value-object';
import { generateRepository, setupRepositoryInfrastructure } from './commands/generate-repository';
import { generateDomainService, setupDomainServiceInfrastructure } from './commands/generate-domain-service';
import { generateOrchestrator, setupOrchestratorInfrastructure } from './commands/generate-orchestrator';
import { setupApiVersioning } from './commands/api-versioning';
import { setupRateLimiting } from './commands/rate-limiting';
import { setupAuditLogging } from './commands/audit-logging';
import { setupI18n } from './commands/i18n-setup';
import { setupAggregateValidator } from './commands/aggregate-validator';
import { setupApiContracts } from './commands/api-contracts';
import { setupResiliencePatterns } from './commands/resilience-patterns';
import { setupObservability } from './commands/observability-tracing';
import { setupFeatureFlags } from './commands/feature-flags';
import { setupCachingStrategies } from './commands/caching-strategies';
import { setupSecurityPatterns } from './commands/security-patterns';
import { setupDbOptimization } from './commands/db-optimization';
import { setupDatabaseSeeding } from './commands/database-seeding';
import { setupHealthProbesAdvanced } from './commands/health-probes-advanced';
import { setupMetricsPrometheus } from './commands/metrics-prometheus';
import { setupGraphQLSubscriptions } from './commands/graphql-subscriptions';

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
  .option('-f, --fields <fields>', 'Entity fields (format: "name:type:modifier name2:type2")')
  .option('--skip-orm', 'Skip ORM entity generation')
  .option('--skip-mapper', 'Skip mapper generation')
  .option('--skip-repo', 'Skip repository generation')
  .option('--with-events', 'Include domain events')
  .option('--with-queries', 'Include query handlers')
  .option('--with-graphql', 'Generate GraphQL resolvers and types')
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
  .option('-f, --fields <fields>', 'Entity fields (format: "name:string email:string:unique age:number:optional")')
  .option('-o, --orm <orm>', 'ORM to use (typeorm or prisma)', 'typeorm')
  .option('--with-tests', 'Generate test files alongside the code', false)
  .option('--with-graphql', 'Generate GraphQL resolvers and types', false)
  .option('--dry-run', 'Preview files that would be generated without writing', false)
  .option('--install-deps', 'Install required dependencies', false)
  .action(async (entityName, options) => {
    try {
      await generateAll(entityName, { ...options, complete: true });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Interactive scaffold wizard
program
  .command('wizard')
  .alias('w')
  .description('Interactive scaffold wizard - guided entity and module creation')
  .option('-p, --path <path>', 'Base path for generation', process.cwd())
  .action(async (options) => {
    try {
      await interactiveScaffold(options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Generate from schema file
program
  .command('from-schema <schemaPath>')
  .alias('fs')
  .description('Generate entities from a JSON/YAML schema file')
  .option('-p, --path <path>', 'Base path for generation', process.cwd())
  .option('--with-tests', 'Generate test files', false)
  .option('--install-deps', 'Install required dependencies', false)
  .action(async (schemaPath, options) => {
    try {
      await generateFromSchema(schemaPath, options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Create sample schema file
program
  .command('schema-init [outputPath]')
  .description('Create a sample schema file for reference')
  .option('-p, --path <path>', 'Base path for the file', process.cwd())
  .action(async (outputPath = 'ddd-schema.json', options) => {
    try {
      await createSampleSchema(outputPath, options);
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

// Apply a recipe (common patterns)
program
  .command('recipe [recipeName]')
  .description('Apply a common pattern recipe (auth-jwt, pagination, soft-delete, audit-log, caching)')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('--install-deps', 'Install required dependencies', false)
  .action(async (recipeName, options) => {
    try {
      if (!recipeName) {
        listRecipes();
      } else {
        await applyRecipe(recipeName, options);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Generate shared module
program
  .command('shared')
  .description('Generate shared module with base classes, interceptors, filters, and utilities')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .action(async (options) => {
    try {
      await generateShared(options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Generate deployment configurations
program
  .command('deploy')
  .description('Generate deployment configurations (Docker, CI/CD, Kubernetes)')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('--no-docker', 'Skip Dockerfile generation')
  .option('--no-compose', 'Skip docker-compose.yml generation')
  .option('--ci <type>', 'CI/CD pipeline type (github, gitlab, none)', 'github')
  .option('--kubernetes', 'Generate Kubernetes manifests', false)
  .action(async (options) => {
    try {
      await generateDeployment(options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Health check
program
  .command('doctor')
  .description('Check project health and validate DDD structure')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('--enhanced', 'Run enhanced doctor with DDD pattern checks', false)
  .option('--fix', 'Auto-fix issues where possible', false)
  .option('-v, --verbose', 'Show detailed output', false)
  .action(async (options) => {
    try {
      if (options.enhanced) {
        await runEnhancedDoctor(options.path || process.cwd(), { fix: options.fix, verbose: options.verbose });
      } else {
        await runDoctor(options);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Interactive config wizard
program
  .command('config [action]')
  .description('Initialize or manage .dddrc.json configuration')
  .option('-p, --preset <preset>', 'Use a preset (minimal, standard, enterprise, prisma, graphql)')
  .option('-f, --force', 'Overwrite existing config', false)
  .action(async (action, options) => {
    try {
      if (action === 'list' || action === 'presets') {
        listPresets();
      } else {
        await initConfig({ preset: options.preset, force: options.force });
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// OpenAPI export
program
  .command('openapi')
  .description('Export OpenAPI specification and Postman collection')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-o, --output <file>', 'Output file name', 'openapi.json')
  .option('-f, --format <format>', 'Output format (json, yaml)', 'json')
  .option('--postman', 'Also generate Postman collection', false)
  .option('--title <title>', 'API title')
  .option('--version <version>', 'API version', '1.0.0')
  .action(async (options) => {
    try {
      await exportOpenApi(options.path || process.cwd(), options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Migration generator
program
  .command('migration <action> [name]')
  .description('Generate database migrations (actions: create, generate)')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-m, --module <module>', 'Module name (for generate action)')
  .option('-o, --orm <orm>', 'ORM to use (typeorm, prisma)', 'typeorm')
  .action(async (action, name, options) => {
    try {
      const basePath = options.path || process.cwd();
      if (action === 'create') {
        if (!name) {
          console.error(chalk.red('Migration name is required'));
          process.exit(1);
        }
        await createMigration(basePath, { name, orm: options.orm, path: options.migrationPath });
      } else if (action === 'generate') {
        if (!options.module) {
          console.error(chalk.red('Module name is required (--module)'));
          process.exit(1);
        }
        await generateMigrationFromEntity(basePath, { module: options.module, orm: options.orm });
      } else {
        console.error(chalk.red(`Unknown action: ${action}`));
        console.log(chalk.yellow('Available actions: create, generate'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// GraphQL types generator
program
  .command('graphql-types')
  .description('Generate GraphQL input/output types from entities')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-m, --module <module>', 'Specific module to generate types for')
  .action(async (options) => {
    try {
      await generateGraphQLTypes(options.path || process.cwd(), { module: options.module });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Dependency graph analyzer
program
  .command('deps')
  .description('Analyze module dependencies and detect circular references')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-f, --format <format>', 'Output format (text, json, mermaid, dot)', 'text')
  .option('-o, --output <file>', 'Output file for graph export')
  .option('--circular', 'Show circular dependencies only', false)
  .action(async (options) => {
    try {
      await analyzeDependencies(options.path || process.cwd(), {
        format: options.format,
        output: options.output,
        showCircular: options.circular,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Plugin management
program
  .command('plugin <action> [name]')
  .description('Manage recipe plugins (actions: list, install, uninstall, run, create)')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .action(async (action, name, options) => {
    try {
      const basePath = options.path || process.cwd();
      switch (action) {
        case 'list':
          await listPlugins(basePath);
          break;
        case 'install':
          if (!name) {
            console.error(chalk.red('Plugin source is required'));
            process.exit(1);
          }
          await installPluginCommand(basePath, name);
          break;
        case 'uninstall':
          if (!name) {
            console.error(chalk.red('Plugin name is required'));
            process.exit(1);
          }
          await uninstallPluginCommand(basePath, name);
          break;
        case 'run':
          if (!name) {
            console.error(chalk.red('Plugin name is required'));
            process.exit(1);
          }
          await runPluginCommand(basePath, name);
          break;
        case 'create':
          if (!name) {
            console.error(chalk.red('Plugin name is required'));
            process.exit(1);
          }
          await scaffoldPlugin(basePath, name);
          break;
        default:
          console.error(chalk.red(`Unknown action: ${action}`));
          console.log(chalk.yellow('Available actions: list, install, uninstall, run, create'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Template debugger
program
  .command('template [action]')
  .description('Debug and validate Handlebars templates')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-t, --template <file>', 'Template file to validate/preview')
  .option('-d, --data <file>', 'JSON data file for preview')
  .option('-o, --output <file>', 'Output file for preview result')
  .option('--helpers', 'List available template helpers', false)
  .action(async (action, options) => {
    try {
      await debugTemplate(options.path || process.cwd(), {
        template: options.template,
        data: options.data,
        output: options.output,
        validate: action === 'validate',
        listHelpers: options.helpers || action === 'helpers',
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Code analyzer
program
  .command('analyze')
  .description('Run static code analysis for DDD violations')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-r, --rules <rules>', 'Rules to check (comma-separated)', 'all')
  .option('-o, --output <file>', 'Output file for report')
  .option('-f, --format <format>', 'Output format (text, json, html)', 'text')
  .action(async (options) => {
    try {
      await analyzeCode(options.path || process.cwd(), {
        rules: options.rules === 'all' ? undefined : options.rules.split(','),
        output: options.output,
        format: options.format,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Batch generation
program
  .command('batch <scriptPath>')
  .description('Generate multiple entities from a YAML/JSON script')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('--dry-run', 'Preview without generating files', false)
  .action(async (scriptPath, options) => {
    try {
      await batchGenerate(scriptPath, {
        path: options.path || process.cwd(),
        dryRun: options.dryRun,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Batch script sample
program
  .command('batch-init [outputPath]')
  .description('Create a sample batch generation script')
  .option('-p, --path <path>', 'Base path for the file', process.cwd())
  .action(async (outputPath = 'ddd-batch.yaml', options) => {
    try {
      await createBatchSchema(outputPath, { path: options.path });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Test scaffold generator
program
  .command('test-scaffold <entityName>')
  .description('Generate test scaffolding with factories and fixtures')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-m, --module <module>', 'Module name')
  .option('-t, --type <type>', 'Test type (unit, integration, e2e, all)', 'all')
  .action(async (entityName, options) => {
    try {
      await generateTestScaffold(entityName, {
        path: options.path || process.cwd(),
        module: options.module,
        type: options.type,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Multi-database setup
program
  .command('multi-db')
  .description('Set up multi-database support with connection manager')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-d, --databases <databases>', 'Database names (comma-separated)', 'primary,replica')
  .action(async (options) => {
    try {
      await setupMultiDatabase(options.path || process.cwd(), {
        databases: options.databases.split(','),
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// API documentation generator
program
  .command('api-docs')
  .description('Generate API documentation from source code')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-o, --output <file>', 'Output directory', 'docs/api')
  .option('-f, --format <format>', 'Output format (markdown, html, json)', 'markdown')
  .option('--examples', 'Include example requests', false)
  .option('--group-by-module', 'Group endpoints by module', true)
  .action(async (options) => {
    try {
      await generateApiDocs(options.path || process.cwd(), {
        output: options.output,
        format: options.format,
        includeExamples: options.examples,
        groupByModule: options.groupByModule,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Environment manager
program
  .command('env <action>')
  .description('Manage environment configuration (actions: init, validate)')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .action(async (action, options) => {
    try {
      const basePath = options.path || process.cwd();
      if (action === 'init') {
        await initEnvManager(basePath);
      } else if (action === 'validate') {
        await validateEnvCommand(basePath);
      } else {
        console.error(chalk.red(`Unknown action: ${action}`));
        console.log(chalk.yellow('Available actions: init, validate'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Performance analyzer
program
  .command('perf')
  .description('Analyze code for performance issues (N+1, memory leaks, etc.)')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-o, --output <file>', 'Output file for report')
  .action(async (options) => {
    try {
      await analyzePerformance(options.path || process.cwd(), {
        output: options.output,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Monorepo initialization
program
  .command('monorepo <action> [name]')
  .description('Initialize or manage a monorepo workspace')
  .option('-p, --path <path>', 'Path for the project')
  .option('-m, --package-manager <pm>', 'Package manager (npm, yarn, pnpm)', 'npm')
  .option('-t, --type <type>', 'Workspace type for add action (app, lib)', 'lib')
  .action(async (action, name, options) => {
    try {
      if (action === 'init') {
        if (!name) {
          console.error(chalk.red('Project name is required'));
          process.exit(1);
        }
        await initMonorepo(name, {
          path: options.path,
          packageManager: options.packageManager,
        });
      } else if (action === 'add') {
        if (!name) {
          console.error(chalk.red('Workspace name is required'));
          process.exit(1);
        }
        await addWorkspace(options.path || process.cwd(), options.type, name);
      } else {
        console.error(chalk.red(`Unknown action: ${action}`));
        console.log(chalk.yellow('Available actions: init, add'));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// AI-assisted code generation
program
  .command('ai <action>')
  .description('AI-assisted code generation (actions: usecase, service, test, refactor, explain, config)')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-k, --api-key <key>', 'API key for AI provider')
  .option('-m, --model <model>', 'Model to use')
  .option('--provider <provider>', 'AI provider (anthropic, openai)', 'anthropic')
  .action(async (action, options) => {
    try {
      if (action === 'config') {
        await configureAiAssist(options.path || process.cwd());
      } else {
        await aiAssist(action, {
          path: options.path,
          apiKey: options.apiKey,
          model: options.model,
          provider: options.provider,
        });
      }
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Diff-based migration
program
  .command('migration-diff')
  .description('Generate migration from schema differences')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-o, --orm <orm>', 'ORM to use (typeorm, prisma)', 'typeorm')
  .option('--dry-run', 'Preview without generating files', false)
  .action(async (options) => {
    try {
      await diffMigration(options.path || process.cwd(), {
        orm: options.orm,
        dryRun: options.dryRun,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Filter DSL generator
program
  .command('filter-dsl')
  .description('Generate type-safe filter DSL with specification pattern')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-m, --module <module>', 'Module name')
  .option('-e, --entity <entity>', 'Entity name')
  .action(async (options) => {
    try {
      await generateFilterDSL(options.path || process.cwd(), {
        module: options.module,
        entity: options.entity,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Event sourcing framework
program
  .command('event-sourcing')
  .description('Set up event sourcing infrastructure with aggregates and projections')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('--store <store>', 'Event store type (memory, postgres, mongodb)', 'postgres')
  .option('--snapshot-threshold <threshold>', 'Snapshot threshold', '100')
  .action(async (options) => {
    try {
      await setupEventSourcingFramework(options.path || process.cwd(), {
        eventStore: options.store,
        snapshotThreshold: parseInt(options.snapshotThreshold, 10),
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Test infrastructure
program
  .command('test-infra')
  .description('Generate comprehensive test infrastructure with factories and fixtures')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-o, --orm <orm>', 'ORM type (typeorm, prisma)', 'typeorm')
  .action(async (options) => {
    try {
      await setupTestInfrastructure(options.path || process.cwd(), {
        orm: options.orm,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Value object generator
program
  .command('value-object <name>')
  .description('Generate a value object with validation')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-m, --module <module>', 'Module name')
  .option('-t, --type <type>', 'Value object type (simple, composite, primitive)', 'simple')
  .action(async (name, options) => {
    try {
      await generateValueObject(name, options.path || process.cwd(), {
        module: options.module,
        type: options.type,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Value objects infrastructure
program
  .command('value-objects-infra')
  .description('Set up value objects infrastructure with base classes')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .action(async (options) => {
    try {
      await setupValueObjects(options.path || process.cwd());
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Repository generator
program
  .command('repository <entityName>')
  .description('Generate repository with specification pattern')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-m, --module <module>', 'Module name')
  .option('-o, --orm <orm>', 'ORM type (typeorm, prisma)', 'typeorm')
  .action(async (entityName, options) => {
    try {
      await generateRepository(entityName, options.path || process.cwd(), {
        module: options.module,
        orm: options.orm,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Repository infrastructure
program
  .command('repository-infra')
  .description('Set up repository infrastructure with specification pattern')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .action(async (options) => {
    try {
      await setupRepositoryInfrastructure(options.path || process.cwd());
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Domain service generator
program
  .command('domain-service <name>')
  .description('Generate a domain service for cross-aggregate operations')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-m, --module <module>', 'Module name')
  .option('-t, --type <type>', 'Service type (simple, workflow, policy)', 'simple')
  .action(async (name, options) => {
    try {
      await generateDomainService(name, options.path || process.cwd(), {
        module: options.module,
        type: options.type,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Domain service infrastructure
program
  .command('domain-service-infra')
  .description('Set up domain service infrastructure with saga pattern')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .action(async (options) => {
    try {
      await setupDomainServiceInfrastructure(options.path || process.cwd());
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Orchestrator generator
program
  .command('orchestrator <name>')
  .description('Generate use case orchestrator with transaction management')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-m, --module <module>', 'Module name')
  .option('-t, --type <type>', 'Orchestrator type (command, query, saga)', 'command')
  .action(async (name, options) => {
    try {
      await generateOrchestrator(name, options.path || process.cwd(), {
        module: options.module,
        type: options.type,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// API versioning
program
  .command('api-versioning')
  .description('Set up API versioning with deprecation handling')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-s, --strategy <strategy>', 'Versioning strategy (uri, header, query)', 'uri')
  .option('-v, --version <version>', 'Current API version', '1')
  .action(async (options) => {
    try {
      await setupApiVersioning(options.path || process.cwd(), {
        strategy: options.strategy,
        currentVersion: options.version,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Rate limiting
program
  .command('rate-limiting')
  .description('Set up rate limiting and throttling framework')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-s, --strategy <strategy>', 'Rate limiting strategy (token-bucket, sliding-window, fixed-window)', 'sliding-window')
  .option('--storage <storage>', 'Storage type (memory, redis)', 'memory')
  .action(async (options) => {
    try {
      await setupRateLimiting(options.path || process.cwd(), {
        strategy: options.strategy,
        storage: options.storage,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Audit logging
program
  .command('audit-logging')
  .description('Set up audit logging and compliance framework')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('--storage <storage>', 'Storage type (database, file, elasticsearch)', 'database')
  .action(async (options) => {
    try {
      await setupAuditLogging(options.path || process.cwd(), {
        storage: options.storage,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// i18n setup
program
  .command('i18n')
  .description('Set up internationalization infrastructure')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-d, --default-locale <locale>', 'Default locale', 'en')
  .option('-l, --locales <locales>', 'Supported locales (comma-separated)', 'en,fr,es')
  .action(async (options) => {
    try {
      await setupI18n(options.path || process.cwd(), {
        defaultLocale: options.defaultLocale,
        supportedLocales: options.locales.split(','),
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Aggregate validator
program
  .command('aggregate-validator')
  .description('Set up aggregate validation framework with invariants')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .action(async (options) => {
    try {
      await setupAggregateValidator(options.path || process.cwd());
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// API contracts
program
  .command('api-contracts')
  .description('Set up API contract testing framework')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-f, --format <format>', 'Contract format (openapi, asyncapi)', 'openapi')
  .action(async (options) => {
    try {
      await setupApiContracts(options.path || process.cwd(), {
        format: options.format,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Resilience patterns
program
  .command('resilience')
  .description('Set up resilience patterns (circuit breaker, retry, timeout, fallback)')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('--circuit-breaker', 'Include circuit breaker', true)
  .option('--retry', 'Include retry strategy', true)
  .option('--timeout', 'Include timeout handling', true)
  .option('--fallback', 'Include fallback pattern', true)
  .option('--bulkhead', 'Include bulkhead pattern', true)
  .action(async (options) => {
    try {
      await setupResiliencePatterns(options.path || process.cwd(), {
        includeCircuitBreaker: options.circuitBreaker,
        includeRetry: options.retry,
        includeTimeout: options.timeout,
        includeFallback: options.fallback,
        includeBulkhead: options.bulkhead,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Observability tracing
program
  .command('tracing')
  .description('Set up distributed tracing with OpenTelemetry')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('--provider <provider>', 'Trace provider (jaeger, zipkin, datadog, otlp)', 'otlp')
  .option('--service-name <name>', 'Service name for traces')
  .action(async (options) => {
    try {
      await setupObservability(options.path || process.cwd(), {
        provider: options.provider,
        serviceName: options.serviceName,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Feature flags
program
  .command('feature-flags')
  .description('Set up feature flag management with A/B testing')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('--provider <provider>', 'Flag provider (memory, database, redis, launchdarkly)', 'database')
  .action(async (options) => {
    try {
      await setupFeatureFlags(options.path || process.cwd(), {
        provider: options.provider,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Caching strategies
program
  .command('caching')
  .description('Set up advanced caching strategies (cache-aside, write-through, etc.)')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('--provider <provider>', 'Cache provider (memory, redis, memcached)', 'redis')
  .action(async (options) => {
    try {
      await setupCachingStrategies(options.path || process.cwd(), {
        provider: options.provider,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Security patterns
program
  .command('security')
  .description('Set up comprehensive security patterns (RBAC, ABAC, encryption, OWASP)')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('--rbac', 'Include RBAC (role-based access control)', true)
  .option('--encryption', 'Include encryption service', true)
  .option('--owasp', 'Include OWASP protections', true)
  .action(async (options) => {
    try {
      await setupSecurityPatterns(options.path || process.cwd(), {
        includeRbac: options.rbac,
        includeEncryption: options.encryption,
        includeOwasp: options.owasp,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Database optimization
program
  .command('db-optimize')
  .description('Set up database optimization (DataLoader, query analyzer, connection pool)')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-m, --module <module>', 'Module name', 'shared')
  .option('-o, --orm <orm>', 'ORM type (typeorm, prisma, mikro-orm)', 'typeorm')
  .option('--dataloader', 'Include DataLoader for N+1 prevention', true)
  .option('--analyzer', 'Include query analyzer', true)
  .action(async (options) => {
    try {
      await setupDbOptimization(options.path || process.cwd(), {
        module: options.module,
        orm: options.orm,
        includeDataLoader: options.dataloader,
        includeQueryAnalyzer: options.analyzer,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Database seeding
program
  .command('seeding')
  .description('Set up database seeding infrastructure with fixtures')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-m, --module <module>', 'Module name', 'shared')
  .option('-o, --orm <orm>', 'ORM type (typeorm, prisma, mikro-orm)', 'typeorm')
  .option('-e, --entities <entities>', 'Entity names (comma-separated)')
  .action(async (options) => {
    try {
      await setupDatabaseSeeding(options.path || process.cwd(), {
        module: options.module,
        orm: options.orm,
        entities: options.entities ? options.entities.split(',') : undefined,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Advanced health probes
program
  .command('health-probes')
  .description('Set up advanced health probes for Kubernetes')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-m, --module <module>', 'Module name', 'shared')
  .option('-d, --dependencies <deps>', 'Dependencies to check (comma-separated)', 'database,redis,external-api')
  .option('--k8s', 'Include Kubernetes configuration', true)
  .action(async (options) => {
    try {
      await setupHealthProbesAdvanced(options.path || process.cwd(), {
        module: options.module,
        dependencies: options.dependencies.split(','),
        includeKubernetes: options.k8s,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Prometheus metrics
program
  .command('metrics')
  .description('Set up Prometheus metrics with custom business metrics')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-m, --module <module>', 'Module name', 'shared')
  .option('--default-metrics', 'Include default Node.js metrics', true)
  .option('--custom <metrics>', 'Custom metrics to include (comma-separated)')
  .action(async (options) => {
    try {
      await setupMetricsPrometheus(options.path || process.cwd(), {
        module: options.module,
        includeDefaultMetrics: options.defaultMetrics,
        customMetrics: options.custom ? options.custom.split(',') : undefined,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// GraphQL subscriptions
program
  .command('graphql-subscriptions')
  .description('Set up GraphQL subscriptions with real-time events')
  .option('-p, --path <path>', 'Path to the project', process.cwd())
  .option('-m, --module <module>', 'Module name', 'shared')
  .option('-e, --events <events>', 'Event types (comma-separated)', 'created,updated,deleted')
  .option('--redis', 'Use Redis for distributed pub/sub', true)
  .action(async (options) => {
    try {
      await setupGraphQLSubscriptions(options.path || process.cwd(), {
        module: options.module,
        events: options.events.split(','),
        useRedis: options.redis,
      });
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Performance profiling flag
program.option('--profile', 'Enable performance profiling');

// Enable profiling if requested
if (process.argv.includes('--profile')) {
  perf.enable();
}

program.parse();

// Print performance report if profiling was enabled
if (perf.isEnabled()) {
  perf.printReport();
}