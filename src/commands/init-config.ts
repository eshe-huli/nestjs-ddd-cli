import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as readline from 'readline';

export interface InitConfigOptions {
  preset?: string;
  force?: boolean;
}

interface ConfigPreset {
  name: string;
  description: string;
  config: DddConfig;
}

interface DddConfig {
  orm: 'typeorm' | 'prisma';
  database: 'postgres' | 'mysql' | 'sqlite' | 'mongodb';
  features: {
    graphql: boolean;
    swagger: boolean;
    cqrs: boolean;
    eventSourcing: boolean;
  };
  naming: {
    entitySuffix: string;
    repositorySuffix: string;
    serviceSuffix: string;
    controllerSuffix: string;
  };
  paths: {
    modules: string;
    shared: string;
    templates: string;
  };
  testing: {
    framework: 'jest' | 'vitest';
    e2e: boolean;
    factories: boolean;
  };
}

const PRESETS: Record<string, ConfigPreset> = {
  'minimal': {
    name: 'Minimal',
    description: 'Basic DDD structure with TypeORM and REST API',
    config: {
      orm: 'typeorm',
      database: 'postgres',
      features: {
        graphql: false,
        swagger: true,
        cqrs: false,
        eventSourcing: false,
      },
      naming: {
        entitySuffix: '',
        repositorySuffix: 'Repository',
        serviceSuffix: 'Service',
        controllerSuffix: 'Controller',
      },
      paths: {
        modules: 'src/modules',
        shared: 'src/shared',
        templates: '.ddd/templates',
      },
      testing: {
        framework: 'jest',
        e2e: false,
        factories: false,
      },
    },
  },
  'standard': {
    name: 'Standard',
    description: 'Full DDD with CQRS, Swagger, and test factories',
    config: {
      orm: 'typeorm',
      database: 'postgres',
      features: {
        graphql: false,
        swagger: true,
        cqrs: true,
        eventSourcing: false,
      },
      naming: {
        entitySuffix: '',
        repositorySuffix: 'Repository',
        serviceSuffix: 'Service',
        controllerSuffix: 'Controller',
      },
      paths: {
        modules: 'src/modules',
        shared: 'src/shared',
        templates: '.ddd/templates',
      },
      testing: {
        framework: 'jest',
        e2e: true,
        factories: true,
      },
    },
  },
  'enterprise': {
    name: 'Enterprise',
    description: 'Full-featured with GraphQL, CQRS, Event Sourcing',
    config: {
      orm: 'typeorm',
      database: 'postgres',
      features: {
        graphql: true,
        swagger: true,
        cqrs: true,
        eventSourcing: true,
      },
      naming: {
        entitySuffix: '',
        repositorySuffix: 'Repository',
        serviceSuffix: 'Service',
        controllerSuffix: 'Controller',
      },
      paths: {
        modules: 'src/modules',
        shared: 'src/shared',
        templates: '.ddd/templates',
      },
      testing: {
        framework: 'jest',
        e2e: true,
        factories: true,
      },
    },
  },
  'prisma': {
    name: 'Prisma',
    description: 'Prisma ORM with modern TypeScript patterns',
    config: {
      orm: 'prisma',
      database: 'postgres',
      features: {
        graphql: false,
        swagger: true,
        cqrs: true,
        eventSourcing: false,
      },
      naming: {
        entitySuffix: '',
        repositorySuffix: 'Repository',
        serviceSuffix: 'Service',
        controllerSuffix: 'Controller',
      },
      paths: {
        modules: 'src/modules',
        shared: 'src/shared',
        templates: '.ddd/templates',
      },
      testing: {
        framework: 'jest',
        e2e: true,
        factories: true,
      },
    },
  },
  'graphql': {
    name: 'GraphQL First',
    description: 'GraphQL-centric with code-first schema generation',
    config: {
      orm: 'typeorm',
      database: 'postgres',
      features: {
        graphql: true,
        swagger: false,
        cqrs: true,
        eventSourcing: false,
      },
      naming: {
        entitySuffix: '',
        repositorySuffix: 'Repository',
        serviceSuffix: 'Service',
        controllerSuffix: 'Resolver',
      },
      paths: {
        modules: 'src/modules',
        shared: 'src/shared',
        templates: '.ddd/templates',
      },
      testing: {
        framework: 'jest',
        e2e: true,
        factories: true,
      },
    },
  },
};

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function selectOption(
  rl: readline.Interface,
  prompt: string,
  options: string[],
  defaultIndex: number = 0
): Promise<string> {
  console.log(chalk.cyan(`\n${prompt}`));
  options.forEach((opt, i) => {
    const marker = i === defaultIndex ? chalk.green('→') : ' ';
    console.log(`  ${marker} ${i + 1}. ${opt}`);
  });

  const answer = await question(rl, chalk.gray(`Enter choice [${defaultIndex + 1}]: `));
  const index = answer ? parseInt(answer, 10) - 1 : defaultIndex;

  if (index >= 0 && index < options.length) {
    return options[index];
  }
  return options[defaultIndex];
}

async function confirm(rl: readline.Interface, prompt: string, defaultYes: boolean = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await question(rl, chalk.cyan(`${prompt} ${hint}: `));

  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

export async function initConfig(options: InitConfigOptions = {}) {
  const configPath = path.join(process.cwd(), '.dddrc.json');

  if (fs.existsSync(configPath) && !options.force) {
    console.log(chalk.yellow('⚠️  Config file .dddrc.json already exists.'));
    console.log(chalk.gray('  Use --force to overwrite.'));
    return;
  }

  console.log(chalk.bold.blue('\n🔧 NestJS DDD CLI Configuration Wizard\n'));

  // If preset provided, use it directly
  if (options.preset && PRESETS[options.preset]) {
    const preset = PRESETS[options.preset];
    fs.writeFileSync(configPath, JSON.stringify(preset.config, null, 2));
    console.log(chalk.green(`✅ Created .dddrc.json with "${preset.name}" preset`));
    printConfigSummary(preset.config);
    return;
  }

  const rl = createReadlineInterface();

  try {
    // Step 1: Choose preset or custom
    console.log(chalk.bold('Available Presets:\n'));
    Object.entries(PRESETS).forEach(([key, preset]) => {
      console.log(`  ${chalk.cyan(key.padEnd(12))} ${preset.description}`);
    });
    console.log(`  ${chalk.cyan('custom'.padEnd(12))} Configure everything manually`);

    const presetChoice = await question(rl, chalk.yellow('\nChoose preset [standard]: '));
    const selectedPreset = presetChoice || 'standard';

    if (selectedPreset !== 'custom' && PRESETS[selectedPreset]) {
      const preset = PRESETS[selectedPreset];

      // Ask if they want to customize
      const customize = await confirm(rl, 'Customize this preset?', false);

      if (!customize) {
        fs.writeFileSync(configPath, JSON.stringify(preset.config, null, 2));
        console.log(chalk.green(`\n✅ Created .dddrc.json with "${preset.name}" preset`));
        printConfigSummary(preset.config);
        rl.close();
        return;
      }

      // Start with preset as base for customization
      const config = { ...preset.config };
      await customizeConfig(rl, config);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(chalk.green('\n✅ Created .dddrc.json with custom configuration'));
      printConfigSummary(config);
    } else {
      // Full custom configuration
      const config = await buildCustomConfig(rl);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(chalk.green('\n✅ Created .dddrc.json with custom configuration'));
      printConfigSummary(config);
    }
  } finally {
    rl.close();
  }
}

async function customizeConfig(rl: readline.Interface, config: DddConfig): Promise<void> {
  // ORM
  const ormChoice = await selectOption(
    rl,
    'Select ORM:',
    ['typeorm', 'prisma'],
    config.orm === 'prisma' ? 1 : 0
  );
  config.orm = ormChoice as 'typeorm' | 'prisma';

  // Database
  const dbChoice = await selectOption(
    rl,
    'Select Database:',
    ['postgres', 'mysql', 'sqlite', 'mongodb'],
    ['postgres', 'mysql', 'sqlite', 'mongodb'].indexOf(config.database)
  );
  config.database = dbChoice as any;

  // Features
  console.log(chalk.cyan('\nFeatures:'));
  config.features.graphql = await confirm(rl, '  Enable GraphQL?', config.features.graphql);
  config.features.swagger = await confirm(rl, '  Enable Swagger/OpenAPI?', config.features.swagger);
  config.features.cqrs = await confirm(rl, '  Enable CQRS pattern?', config.features.cqrs);
  config.features.eventSourcing = await confirm(rl, '  Enable Event Sourcing?', config.features.eventSourcing);

  // Testing
  console.log(chalk.cyan('\nTesting:'));
  const testFramework = await selectOption(
    rl,
    'Test framework:',
    ['jest', 'vitest'],
    config.testing.framework === 'vitest' ? 1 : 0
  );
  config.testing.framework = testFramework as 'jest' | 'vitest';
  config.testing.e2e = await confirm(rl, '  Generate E2E tests?', config.testing.e2e);
  config.testing.factories = await confirm(rl, '  Generate test factories?', config.testing.factories);
}

async function buildCustomConfig(rl: readline.Interface): Promise<DddConfig> {
  const config: DddConfig = {
    orm: 'typeorm',
    database: 'postgres',
    features: {
      graphql: false,
      swagger: true,
      cqrs: false,
      eventSourcing: false,
    },
    naming: {
      entitySuffix: '',
      repositorySuffix: 'Repository',
      serviceSuffix: 'Service',
      controllerSuffix: 'Controller',
    },
    paths: {
      modules: 'src/modules',
      shared: 'src/shared',
      templates: '.ddd/templates',
    },
    testing: {
      framework: 'jest',
      e2e: false,
      factories: false,
    },
  };

  await customizeConfig(rl, config);

  // Additional custom paths
  console.log(chalk.cyan('\nPaths (press Enter for defaults):'));

  const modulesPath = await question(rl, `  Modules path [${config.paths.modules}]: `);
  if (modulesPath) config.paths.modules = modulesPath;

  const sharedPath = await question(rl, `  Shared path [${config.paths.shared}]: `);
  if (sharedPath) config.paths.shared = sharedPath;

  return config;
}

function printConfigSummary(config: DddConfig): void {
  console.log(chalk.gray('\n─────────────────────────────────────'));
  console.log(chalk.bold('Configuration Summary:\n'));
  console.log(`  ORM:        ${chalk.cyan(config.orm)}`);
  console.log(`  Database:   ${chalk.cyan(config.database)}`);
  console.log(`  GraphQL:    ${config.features.graphql ? chalk.green('✓') : chalk.gray('✗')}`);
  console.log(`  Swagger:    ${config.features.swagger ? chalk.green('✓') : chalk.gray('✗')}`);
  console.log(`  CQRS:       ${config.features.cqrs ? chalk.green('✓') : chalk.gray('✗')}`);
  console.log(`  Testing:    ${chalk.cyan(config.testing.framework)}${config.testing.e2e ? ' + E2E' : ''}`);
  console.log(chalk.gray('─────────────────────────────────────\n'));
}

export function listPresets(): void {
  console.log(chalk.bold.blue('\n📋 Available Configuration Presets\n'));

  Object.entries(PRESETS).forEach(([key, preset]) => {
    console.log(chalk.bold.cyan(`  ${key}`));
    console.log(chalk.gray(`    ${preset.description}`));
    console.log(chalk.gray(`    ORM: ${preset.config.orm}, DB: ${preset.config.database}`));
    const features = Object.entries(preset.config.features)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (features.length > 0) {
      console.log(chalk.gray(`    Features: ${features.join(', ')}`));
    }
    console.log();
  });
}
