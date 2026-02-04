import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { toPascalCase, toCamelCase, toKebabCase } from '../utils/naming.utils';

export interface DatabaseSeedingOptions {
  module?: string;
  orm?: 'typeorm' | 'prisma' | 'mikro-orm';
  entities?: string[];
}

export async function setupDatabaseSeeding(
  basePath: string,
  options: DatabaseSeedingOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n🌱 Setting up Database Seeding Infrastructure\n'));

  const moduleName = options.module || 'shared';
  const pascalName = toPascalCase(moduleName);
  const camelName = toCamelCase(moduleName);
  const kebabName = toKebabCase(moduleName);
  const orm = options.orm || 'typeorm';
  const entities = options.entities || [moduleName];

  const baseDir = path.join(basePath, 'src', kebabName, 'infrastructure', 'seeding');
  fs.mkdirSync(baseDir, { recursive: true });

  // Seed runner
  const seedRunnerContent = `import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
${orm === 'typeorm' ? "import { DataSource, EntityManager } from 'typeorm';" : ''}
${orm === 'prisma' ? "import { PrismaService } from '../prisma/prisma.service';" : ''}

interface SeedConfig {
  name: string;
  priority: number;
  environments: string[];
  dependencies?: string[];
}

interface SeederClass {
  config: SeedConfig;
  run(context: SeedContext): Promise<void>;
  shouldRun?(context: SeedContext): Promise<boolean>;
  rollback?(context: SeedContext): Promise<void>;
}

export interface SeedContext {
  environment: string;
  ${orm === 'typeorm' ? 'entityManager: EntityManager;' : ''}
  ${orm === 'prisma' ? 'prisma: PrismaService;' : ''}
  logger: Logger;
  data: Map<string, any>;
}

/**
 * Database seeding runner with dependency resolution and environment support
 */
@Injectable()
export class SeedRunner implements OnModuleInit {
  private readonly logger = new Logger(SeedRunner.name);
  private readonly seeders: SeederClass[] = [];
  private readonly executedSeeders: Set<string> = new Set();

  constructor(
    ${orm === 'typeorm' ? 'private readonly dataSource: DataSource,' : ''}
    ${orm === 'prisma' ? 'private readonly prisma: PrismaService,' : ''}
  ) {}

  async onModuleInit(): Promise<void> {
    const shouldSeed = process.env.RUN_SEEDS === 'true';
    if (shouldSeed) {
      await this.runAll();
    }
  }

  /**
   * Register a seeder
   */
  register(seeder: SeederClass): void {
    this.seeders.push(seeder);
    this.sortSeeders();
  }

  /**
   * Sort seeders by priority and dependencies
   */
  private sortSeeders(): void {
    this.seeders.sort((a, b) => {
      // Check dependencies first
      if (a.config.dependencies?.includes(b.config.name)) {
        return 1;
      }
      if (b.config.dependencies?.includes(a.config.name)) {
        return -1;
      }
      // Then sort by priority
      return a.config.priority - b.config.priority;
    });
  }

  /**
   * Run all registered seeders
   */
  async runAll(environment?: string): Promise<void> {
    const env = environment || process.env.NODE_ENV || 'development';
    this.logger.log(\`Running seeders for environment: \${env}\`);

    const context = await this.createContext(env);

    for (const seeder of this.seeders) {
      await this.runSeeder(seeder, context);
    }

    this.logger.log('All seeders completed');
  }

  /**
   * Run a specific seeder
   */
  async runSeeder(seeder: SeederClass, context: SeedContext): Promise<void> {
    const { config } = seeder;

    // Check if already executed
    if (this.executedSeeders.has(config.name)) {
      return;
    }

    // Check environment
    if (!config.environments.includes(context.environment) && !config.environments.includes('*')) {
      this.logger.debug(\`Skipping \${config.name} - not for \${context.environment}\`);
      return;
    }

    // Run dependencies first
    if (config.dependencies) {
      for (const depName of config.dependencies) {
        const depSeeder = this.seeders.find((s) => s.config.name === depName);
        if (depSeeder && !this.executedSeeders.has(depName)) {
          await this.runSeeder(depSeeder, context);
        }
      }
    }

    // Check if should run
    if (seeder.shouldRun) {
      const should = await seeder.shouldRun(context);
      if (!should) {
        this.logger.debug(\`Skipping \${config.name} - shouldRun returned false\`);
        return;
      }
    }

    // Run the seeder
    try {
      this.logger.log(\`Running seeder: \${config.name}\`);
      await seeder.run(context);
      this.executedSeeders.add(config.name);
      this.logger.log(\`Completed seeder: \${config.name}\`);
    } catch (error) {
      this.logger.error(\`Seeder \${config.name} failed: \${error}\`);
      throw error;
    }
  }

  /**
   * Rollback all seeders
   */
  async rollbackAll(environment?: string): Promise<void> {
    const env = environment || process.env.NODE_ENV || 'development';
    this.logger.log(\`Rolling back seeders for environment: \${env}\`);

    const context = await this.createContext(env);

    // Rollback in reverse order
    const reversedSeeders = [...this.seeders].reverse();

    for (const seeder of reversedSeeders) {
      if (seeder.rollback && this.executedSeeders.has(seeder.config.name)) {
        try {
          this.logger.log(\`Rolling back seeder: \${seeder.config.name}\`);
          await seeder.rollback(context);
          this.executedSeeders.delete(seeder.config.name);
        } catch (error) {
          this.logger.error(\`Rollback failed for \${seeder.config.name}: \${error}\`);
        }
      }
    }
  }

  /**
   * Create seed context
   */
  private async createContext(environment: string): Promise<SeedContext> {
    return {
      environment,
      ${orm === 'typeorm' ? 'entityManager: this.dataSource.manager,' : ''}
      ${orm === 'prisma' ? 'prisma: this.prisma,' : ''}
      logger: this.logger,
      data: new Map(),
    };
  }

  /**
   * Reset execution state
   */
  reset(): void {
    this.executedSeeders.clear();
  }
}
`;
  fs.writeFileSync(path.join(baseDir, 'seed-runner.ts'), seedRunnerContent);

  // Fixture factory
  const fixtureFactoryContent = `import { faker } from '@faker-js/faker';

type FactoryFunction<T> = (overrides?: Partial<T>) => T;
type AsyncFactoryFunction<T> = (overrides?: Partial<T>) => Promise<T>;

interface FactoryDefinition<T> {
  default: () => T;
  states?: Record<string, Partial<T> | ((base: T) => Partial<T>)>;
}

/**
 * Type-safe fixture factory for generating test and seed data
 */
export class FixtureFactory {
  private static factories: Map<string, FactoryDefinition<any>> = new Map();
  private static sequences: Map<string, number> = new Map();

  /**
   * Define a factory for an entity
   */
  static define<T>(name: string, definition: FactoryDefinition<T>): void {
    this.factories.set(name, definition);
  }

  /**
   * Create a single instance
   */
  static create<T>(name: string, overrides?: Partial<T>, state?: string): T {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(\`Factory "\${name}" not defined\`);
    }

    let instance = factory.default();

    // Apply state if specified
    if (state && factory.states?.[state]) {
      const stateValue = factory.states[state];
      const stateOverrides = typeof stateValue === 'function'
        ? stateValue(instance)
        : stateValue;
      instance = { ...instance, ...stateOverrides };
    }

    // Apply overrides
    if (overrides) {
      instance = { ...instance, ...overrides };
    }

    return instance;
  }

  /**
   * Create multiple instances
   */
  static createMany<T>(name: string, count: number, overrides?: Partial<T>, state?: string): T[] {
    return Array.from({ length: count }, () => this.create<T>(name, overrides, state));
  }

  /**
   * Get next value in a sequence
   */
  static sequence(name: string): number {
    const current = this.sequences.get(name) || 0;
    const next = current + 1;
    this.sequences.set(name, next);
    return next;
  }

  /**
   * Reset all sequences
   */
  static resetSequences(): void {
    this.sequences.clear();
  }

  /**
   * Reset specific sequence
   */
  static resetSequence(name: string): void {
    this.sequences.delete(name);
  }
}

// ===============================
// Example Factory Definitions
// ===============================

${entities.map(entity => {
  const pascal = toPascalCase(entity);
  const camel = toCamelCase(entity);
  return `
/**
 * ${pascal} factory definition
 */
FixtureFactory.define<{
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}>('${camel}', {
  default: () => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    isActive: true,
  }),
  states: {
    inactive: { isActive: false },
    recent: (base) => ({
      createdAt: faker.date.recent({ days: 7 }),
      updatedAt: new Date(),
    }),
  },
});`;
}).join('\n')}

// ===============================
// Builder Pattern Factory
// ===============================

/**
 * Fluent builder for creating test fixtures
 */
export class FixtureBuilder<T> {
  private overrides: Partial<T> = {};
  private state?: string;
  private traits: string[] = [];

  constructor(private readonly factoryName: string) {}

  /**
   * Set specific field value
   */
  with<K extends keyof T>(key: K, value: T[K]): this {
    this.overrides[key] = value;
    return this;
  }

  /**
   * Apply a predefined state
   */
  withState(state: string): this {
    this.state = state;
    return this;
  }

  /**
   * Apply multiple overrides
   */
  withOverrides(overrides: Partial<T>): this {
    this.overrides = { ...this.overrides, ...overrides };
    return this;
  }

  /**
   * Build single instance
   */
  build(): T {
    return FixtureFactory.create<T>(this.factoryName, this.overrides, this.state);
  }

  /**
   * Build multiple instances
   */
  buildMany(count: number): T[] {
    return Array.from({ length: count }, () => this.build());
  }
}

/**
 * Create a builder for a factory
 */
export function fixture<T>(name: string): FixtureBuilder<T> {
  return new FixtureBuilder<T>(name);
}

// ===============================
// Seed Data Helpers
// ===============================

/**
 * Generate realistic seed data for common scenarios
 */
export const SeedDataGenerators = {
  /**
   * Generate users with various roles
   */
  users(count: number, roleDistribution: Record<string, number> = { user: 0.8, admin: 0.15, superadmin: 0.05 }) {
    const users: any[] = [];
    const roles = Object.entries(roleDistribution);

    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      let cumulative = 0;
      let selectedRole = roles[0][0];

      for (const [role, probability] of roles) {
        cumulative += probability;
        if (rand <= cumulative) {
          selectedRole = role;
          break;
        }
      }

      users.push({
        id: faker.string.uuid(),
        email: faker.internet.email(),
        name: faker.person.fullName(),
        role: selectedRole,
        createdAt: faker.date.past({ years: 2 }),
      });
    }

    return users;
  },

  /**
   * Generate time-series data
   */
  timeSeries(
    startDate: Date,
    endDate: Date,
    intervalMs: number,
    valueGenerator: () => number,
  ) {
    const data: { timestamp: Date; value: number }[] = [];
    let current = new Date(startDate);

    while (current <= endDate) {
      data.push({
        timestamp: new Date(current),
        value: valueGenerator(),
      });
      current = new Date(current.getTime() + intervalMs);
    }

    return data;
  },

  /**
   * Generate hierarchical data (e.g., categories, org structure)
   */
  hierarchy<T extends { id: string; parentId: string | null }>(
    depth: number,
    childrenPerNode: number,
    nodeGenerator: (level: number, parentId: string | null) => Omit<T, 'id' | 'parentId'>,
  ): T[] {
    const nodes: T[] = [];

    function generateLevel(level: number, parentId: string | null): void {
      if (level >= depth) return;

      const count = level === 0 ? Math.ceil(childrenPerNode / 2) : childrenPerNode;

      for (let i = 0; i < count; i++) {
        const id = faker.string.uuid();
        const node = {
          id,
          parentId,
          ...nodeGenerator(level, parentId),
        } as T;

        nodes.push(node);
        generateLevel(level + 1, id);
      }
    }

    generateLevel(0, null);
    return nodes;
  },
};
`;
  fs.writeFileSync(path.join(baseDir, 'fixture-factory.ts'), fixtureFactoryContent);

  // Example seeder
  const exampleSeederContent = `import { Injectable } from '@nestjs/common';
import { SeedRunner, SeedContext } from './seed-runner';
import { FixtureFactory, SeedDataGenerators } from './fixture-factory';

/**
 * Example seeder for ${pascalName}
 */
@Injectable()
export class ${pascalName}Seeder {
  static readonly config = {
    name: '${camelName}Seeder',
    priority: 10,
    environments: ['development', 'test', 'staging'],
    dependencies: [], // Add dependencies here
  };

  constructor(private readonly seedRunner: SeedRunner) {
    this.seedRunner.register(this);
  }

  /**
   * Check if seeder should run
   */
  async shouldRun(context: SeedContext): Promise<boolean> {
    // Example: Check if data already exists
    // const count = await context.entityManager.count(${pascalName}Entity);
    // return count === 0;
    return true;
  }

  /**
   * Run the seeder
   */
  async run(context: SeedContext): Promise<void> {
    context.logger.log('Seeding ${pascalName} data...');

    // Generate seed data
    const items = FixtureFactory.createMany('${camelName}', 50);

    // Insert data
    // await context.entityManager.save(${pascalName}Entity, items);

    // Store reference for dependent seeders
    context.data.set('${camelName}Ids', items.map(i => i.id));

    context.logger.log(\`Seeded \${items.length} ${camelName} records\`);
  }

  /**
   * Rollback the seeder
   */
  async rollback(context: SeedContext): Promise<void> {
    context.logger.log('Rolling back ${pascalName} data...');

    // Delete seeded data
    // await context.entityManager.delete(${pascalName}Entity, {});

    context.data.delete('${camelName}Ids');
  }
}

/**
 * Reference data seeder (static/lookup data)
 */
@Injectable()
export class ReferenceDataSeeder {
  static readonly config = {
    name: 'referenceDataSeeder',
    priority: 1, // Run first
    environments: ['*'], // All environments
  };

  constructor(private readonly seedRunner: SeedRunner) {
    this.seedRunner.register(this);
  }

  async run(context: SeedContext): Promise<void> {
    context.logger.log('Seeding reference data...');

    // Example: Seed status types, categories, etc.
    const statuses = [
      { code: 'ACTIVE', name: 'Active', order: 1 },
      { code: 'INACTIVE', name: 'Inactive', order: 2 },
      { code: 'PENDING', name: 'Pending', order: 3 },
      { code: 'ARCHIVED', name: 'Archived', order: 4 },
    ];

    // await context.entityManager.upsert(StatusEntity, statuses, ['code']);

    context.data.set('statuses', statuses);
  }
}
`;
  fs.writeFileSync(path.join(baseDir, `${kebabName}.seeder.ts`), exampleSeederContent);

  console.log(chalk.green(`  ✓ Created seed runner`));
  console.log(chalk.green(`  ✓ Created fixture factory`));
  console.log(chalk.green(`  ✓ Created ${kebabName}.seeder.ts`));

  console.log(chalk.bold.green(`\n✅ Database seeding setup complete for ${pascalName}`));
  console.log(chalk.cyan(`Generated files in: ${baseDir}`));
  console.log(chalk.gray('  - seed-runner.ts (Seeder orchestration)'));
  console.log(chalk.gray('  - fixture-factory.ts (Test data generation)'));
  console.log(chalk.gray(`  - ${kebabName}.seeder.ts (Example seeder)`));
}
