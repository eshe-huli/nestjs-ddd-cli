/**
 * Enhanced Test Fixtures & Factories
 * Complete test infrastructure generation
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../utils/file.utils';

export interface TestInfrastructureOptions {
  path?: string;
  orm?: 'typeorm' | 'prisma';
}

export async function setupTestInfrastructure(
  basePath: string,
  options: TestInfrastructureOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n🧪 Setting up Test Infrastructure\n'));

  const testPath = path.join(basePath, 'src/shared/testing');
  await ensureDir(testPath);
  await ensureDir(path.join(testPath, 'factories'));
  await ensureDir(path.join(testPath, 'fixtures'));
  await ensureDir(path.join(testPath, 'mocks'));
  await ensureDir(path.join(testPath, 'utils'));

  // Generate base factory
  await generateBaseFactory(testPath);

  // Generate factory builder
  await generateFactoryBuilder(testPath);

  // Generate fixture loader
  await generateFixtureLoader(testPath);

  // Generate mock repository
  await generateMockRepository(testPath);

  // Generate database seeder
  await generateDatabaseSeeder(testPath, options);

  // Generate test module builder
  await generateTestModuleBuilder(testPath);

  // Generate test utils
  await generateTestUtils(testPath);

  // Generate sample factories
  await generateSampleFactories(testPath);

  // Generate index
  await writeFile(path.join(testPath, 'index.ts'), `export * from './factories/base.factory';
export * from './factories/factory.builder';
export * from './fixtures/fixture.loader';
export * from './mocks/mock.repository';
export * from './utils/database.seeder';
export * from './utils/test-module.builder';
export * from './utils/test.utils';
`);

  console.log(chalk.green('\n✅ Test Infrastructure set up!'));
}

async function generateBaseFactory(testPath: string): Promise<void> {
  const content = `import { faker } from '@faker-js/faker';

/**
 * Base factory class for generating test data
 */
export abstract class BaseFactory<T, CreateInput = Partial<T>> {
  protected abstract getDefaults(): T;

  /**
   * Create a single instance
   */
  create(overrides?: CreateInput): T {
    return {
      ...this.getDefaults(),
      ...overrides,
    } as T;
  }

  /**
   * Create multiple instances
   */
  createMany(count: number, overrides?: CreateInput): T[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create with specific traits
   */
  with(traits: Partial<T>): this {
    const original = this.getDefaults.bind(this);
    this.getDefaults = () => ({ ...original(), ...traits });
    return this;
  }

  /**
   * Create a builder for fluent interface
   */
  builder(): FactoryBuilder<T> {
    return new FactoryBuilder<T>(this);
  }
}

/**
 * Factory builder for fluent creation
 */
export class FactoryBuilder<T> {
  private traits: Partial<T> = {};
  private afterCreate: Array<(entity: T) => T | Promise<T>> = [];

  constructor(private factory: BaseFactory<T>) {}

  with(traits: Partial<T>): this {
    this.traits = { ...this.traits, ...traits };
    return this;
  }

  afterCreating(callback: (entity: T) => T | Promise<T>): this {
    this.afterCreate.push(callback);
    return this;
  }

  async create(): Promise<T> {
    let entity = this.factory.create(this.traits as any);
    for (const callback of this.afterCreate) {
      entity = await callback(entity);
    }
    return entity;
  }

  async createMany(count: number): Promise<T[]> {
    const entities: T[] = [];
    for (let i = 0; i < count; i++) {
      entities.push(await this.create());
    }
    return entities;
  }
}

/**
 * Faker helpers for common fields
 */
export const FakerHelpers = {
  id: () => faker.string.uuid(),
  email: () => faker.internet.email(),
  password: () => faker.internet.password({ length: 12 }),
  firstName: () => faker.person.firstName(),
  lastName: () => faker.person.lastName(),
  fullName: () => faker.person.fullName(),
  username: () => faker.internet.username(),
  phone: () => faker.phone.number(),
  address: () => faker.location.streetAddress(),
  city: () => faker.location.city(),
  country: () => faker.location.country(),
  zipCode: () => faker.location.zipCode(),
  url: () => faker.internet.url(),
  imageUrl: () => faker.image.url(),
  avatarUrl: () => faker.image.avatar(),
  paragraph: () => faker.lorem.paragraph(),
  sentence: () => faker.lorem.sentence(),
  word: () => faker.lorem.word(),
  date: () => faker.date.past(),
  futureDate: () => faker.date.future(),
  recentDate: () => faker.date.recent(),
  price: () => faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
  quantity: () => faker.number.int({ min: 1, max: 100 }),
  boolean: () => faker.datatype.boolean(),
  pick: <T>(arr: T[]) => faker.helpers.arrayElement(arr),
  json: () => ({ key: faker.lorem.word(), value: faker.lorem.word() }),
};

/**
 * Type-safe factory creator
 */
export function defineFactory<T>(defaults: () => T): BaseFactory<T> {
  return new (class extends BaseFactory<T> {
    protected getDefaults(): T {
      return defaults();
    }
  })();
}
`;

  await writeFile(path.join(testPath, 'factories/base.factory.ts'), content);
  console.log(chalk.green('  ✓ Base factory'));
}

async function generateFactoryBuilder(testPath: string): Promise<void> {
  const content = `import { faker } from '@faker-js/faker';

/**
 * Advanced factory builder with sequences and states
 */
export class AdvancedFactoryBuilder<T> {
  private defaults: () => T;
  private traits: Map<string, Partial<T>> = new Map();
  private sequences: Map<keyof T, Generator<any>> = new Map();
  private afterCreateHooks: Array<(entity: T) => T | Promise<T>> = [];
  private afterBuildHooks: Array<(entity: T) => T> = [];
  private currentTraits: string[] = [];
  private overrides: Partial<T> = {};

  constructor(defaults: () => T) {
    this.defaults = defaults;
  }

  /**
   * Define a named trait (state)
   */
  trait(name: string, attributes: Partial<T>): this {
    this.traits.set(name, attributes);
    return this;
  }

  /**
   * Define a sequence for a field
   */
  sequence<K extends keyof T>(field: K, generator: () => Generator<T[K]>): this {
    this.sequences.set(field, generator());
    return this;
  }

  /**
   * Add after-build hook (synchronous)
   */
  afterBuild(callback: (entity: T) => T): this {
    this.afterBuildHooks.push(callback);
    return this;
  }

  /**
   * Add after-create hook (can be async)
   */
  afterCreate(callback: (entity: T) => T | Promise<T>): this {
    this.afterCreateHooks.push(callback);
    return this;
  }

  /**
   * Use a trait
   */
  use(...traitNames: string[]): AdvancedFactoryBuilder<T> {
    const builder = this.clone();
    builder.currentTraits = [...this.currentTraits, ...traitNames];
    return builder;
  }

  /**
   * Override specific attributes
   */
  with(attrs: Partial<T>): AdvancedFactoryBuilder<T> {
    const builder = this.clone();
    builder.overrides = { ...this.overrides, ...attrs };
    return builder;
  }

  /**
   * Build an entity (synchronous, no hooks)
   */
  build(): T {
    let entity = this.defaults();

    // Apply sequences
    for (const [field, generator] of this.sequences) {
      (entity as any)[field] = generator.next().value;
    }

    // Apply traits
    for (const traitName of this.currentTraits) {
      const trait = this.traits.get(traitName);
      if (trait) {
        entity = { ...entity, ...trait };
      }
    }

    // Apply overrides
    entity = { ...entity, ...this.overrides };

    // Run after-build hooks
    for (const hook of this.afterBuildHooks) {
      entity = hook(entity);
    }

    return entity;
  }

  /**
   * Build multiple entities
   */
  buildMany(count: number): T[] {
    return Array.from({ length: count }, () => this.build());
  }

  /**
   * Create an entity (runs after-create hooks)
   */
  async create(): Promise<T> {
    let entity = this.build();

    for (const hook of this.afterCreateHooks) {
      entity = await hook(entity);
    }

    return entity;
  }

  /**
   * Create multiple entities
   */
  async createMany(count: number): Promise<T[]> {
    const entities: T[] = [];
    for (let i = 0; i < count; i++) {
      entities.push(await this.create());
    }
    return entities;
  }

  /**
   * Clone the builder
   */
  private clone(): AdvancedFactoryBuilder<T> {
    const builder = new AdvancedFactoryBuilder(this.defaults);
    builder.traits = new Map(this.traits);
    builder.sequences = new Map(this.sequences);
    builder.afterCreateHooks = [...this.afterCreateHooks];
    builder.afterBuildHooks = [...this.afterBuildHooks];
    builder.currentTraits = [...this.currentTraits];
    builder.overrides = { ...this.overrides };
    return builder;
  }
}

/**
 * Create an advanced factory
 */
export function factory<T>(defaults: () => T): AdvancedFactoryBuilder<T> {
  return new AdvancedFactoryBuilder(defaults);
}

/**
 * Sequence generator helpers
 */
export const sequences = {
  /**
   * Auto-incrementing number
   */
  *autoIncrement(start: number = 1): Generator<number> {
    let current = start;
    while (true) {
      yield current++;
    }
  },

  /**
   * Unique email with counter
   */
  *uniqueEmail(domain: string = 'test.com'): Generator<string> {
    let counter = 1;
    while (true) {
      yield \`user\${counter++}@\${domain}\`;
    }
  },

  /**
   * Unique username
   */
  *uniqueUsername(prefix: string = 'user'): Generator<string> {
    let counter = 1;
    while (true) {
      yield \`\${prefix}\${counter++}\`;
    }
  },

  /**
   * Cycle through values
   */
  *cycle<T>(values: T[]): Generator<T> {
    let index = 0;
    while (true) {
      yield values[index % values.length];
      index++;
    }
  },

  /**
   * Random from array
   */
  *randomFrom<T>(values: T[]): Generator<T> {
    while (true) {
      yield faker.helpers.arrayElement(values);
    }
  },
};
`;

  await writeFile(path.join(testPath, 'factories/factory.builder.ts'), content);
  console.log(chalk.green('  ✓ Factory builder'));
}

async function generateFixtureLoader(testPath: string): Promise<void> {
  const content = `import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export interface Fixture<T = any> {
  name: string;
  entity: string;
  data: T[];
}

/**
 * Load and manage test fixtures
 */
export class FixtureLoader {
  private fixtures: Map<string, Fixture> = new Map();
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(process.cwd(), 'test/fixtures');
  }

  /**
   * Load a fixture file (JSON or YAML)
   */
  load<T = any>(name: string): Fixture<T> {
    if (this.fixtures.has(name)) {
      return this.fixtures.get(name)! as Fixture<T>;
    }

    const jsonPath = path.join(this.basePath, \`\${name}.json\`);
    const yamlPath = path.join(this.basePath, \`\${name}.yaml\`);
    const ymlPath = path.join(this.basePath, \`\${name}.yml\`);

    let data: any;

    if (fs.existsSync(jsonPath)) {
      data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    } else if (fs.existsSync(yamlPath)) {
      data = yaml.parse(fs.readFileSync(yamlPath, 'utf-8'));
    } else if (fs.existsSync(ymlPath)) {
      data = yaml.parse(fs.readFileSync(ymlPath, 'utf-8'));
    } else {
      throw new Error(\`Fixture not found: \${name}\`);
    }

    const fixture: Fixture<T> = {
      name,
      entity: data.entity || name,
      data: Array.isArray(data) ? data : data.data || [],
    };

    this.fixtures.set(name, fixture);
    return fixture;
  }

  /**
   * Load all fixtures from directory
   */
  loadAll(): Map<string, Fixture> {
    if (!fs.existsSync(this.basePath)) {
      return this.fixtures;
    }

    const files = fs.readdirSync(this.basePath);

    for (const file of files) {
      const ext = path.extname(file);
      if (['.json', '.yaml', '.yml'].includes(ext)) {
        const name = path.basename(file, ext);
        this.load(name);
      }
    }

    return this.fixtures;
  }

  /**
   * Get fixture data by name
   */
  get<T = any>(name: string): T[] {
    return this.load<T>(name).data;
  }

  /**
   * Get first item from fixture
   */
  first<T = any>(name: string): T | undefined {
    return this.get<T>(name)[0];
  }

  /**
   * Get random item from fixture
   */
  random<T = any>(name: string): T | undefined {
    const data = this.get<T>(name);
    return data[Math.floor(Math.random() * data.length)];
  }

  /**
   * Get item by index
   */
  at<T = any>(name: string, index: number): T | undefined {
    return this.get<T>(name)[index];
  }

  /**
   * Filter fixture data
   */
  filter<T = any>(name: string, predicate: (item: T) => boolean): T[] {
    return this.get<T>(name).filter(predicate);
  }

  /**
   * Find item in fixture
   */
  find<T = any>(name: string, predicate: (item: T) => boolean): T | undefined {
    return this.get<T>(name).find(predicate);
  }

  /**
   * Clear cached fixtures
   */
  clear(): void {
    this.fixtures.clear();
  }

  /**
   * Create fixtures from factory
   */
  static createFixture<T>(
    name: string,
    entity: string,
    factory: () => T,
    count: number = 10
  ): Fixture<T> {
    return {
      name,
      entity,
      data: Array.from({ length: count }, factory),
    };
  }

  /**
   * Save fixture to file
   */
  async save<T>(name: string, fixture: Fixture<T>, format: 'json' | 'yaml' = 'json'): Promise<void> {
    const filePath = path.join(this.basePath, \`\${name}.\${format}\`);

    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }

    const content = format === 'json'
      ? JSON.stringify(fixture, null, 2)
      : yaml.stringify(fixture);

    fs.writeFileSync(filePath, content);
  }
}

/**
 * Create a fixture loader
 */
export function createFixtureLoader(basePath?: string): FixtureLoader {
  return new FixtureLoader(basePath);
}

/**
 * Fixture reference for lazy loading
 */
export class FixtureRef<T = any> {
  constructor(
    private loader: FixtureLoader,
    private name: string,
    private selector?: (data: T[]) => T
  ) {}

  get(): T | undefined {
    const data = this.loader.get<T>(this.name);
    return this.selector ? this.selector(data) : data[0];
  }

  all(): T[] {
    return this.loader.get<T>(this.name);
  }
}
`;

  await writeFile(path.join(testPath, 'fixtures/fixture.loader.ts'), content);
  console.log(chalk.green('  ✓ Fixture loader'));
}

async function generateMockRepository(testPath: string): Promise<void> {
  const content = `/**
 * Mock Repository Implementation
 * For testing without database
 */

export interface IMockRepository<T extends { id: string | number }> {
  findAll(): Promise<T[]>;
  findById(id: string | number): Promise<T | null>;
  findOne(where: Partial<T>): Promise<T | null>;
  findMany(where: Partial<T>): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string | number, data: Partial<T>): Promise<T | null>;
  delete(id: string | number): Promise<void>;
  clear(): void;
  seed(data: T[]): void;
}

/**
 * In-memory mock repository
 */
export class MockRepository<T extends { id: string | number }> implements IMockRepository<T> {
  private data: Map<string | number, T> = new Map();
  private idGenerator: () => string | number;

  constructor(
    private options: {
      idGenerator?: () => string | number;
      initialData?: T[];
    } = {}
  ) {
    this.idGenerator = options.idGenerator || (() => \`mock_\${Date.now()}_\${Math.random().toString(36).slice(2, 9)}\`);

    if (options.initialData) {
      this.seed(options.initialData);
    }
  }

  async findAll(): Promise<T[]> {
    return Array.from(this.data.values());
  }

  async findById(id: string | number): Promise<T | null> {
    return this.data.get(id) || null;
  }

  async findOne(where: Partial<T>): Promise<T | null> {
    const all = Array.from(this.data.values());
    return all.find(item => this.matches(item, where)) || null;
  }

  async findMany(where: Partial<T>): Promise<T[]> {
    const all = Array.from(this.data.values());
    return all.filter(item => this.matches(item, where));
  }

  async create(data: Partial<T>): Promise<T> {
    const id = data.id || this.idGenerator();
    const entity = { ...data, id } as T;
    this.data.set(id, entity);
    return entity;
  }

  async update(id: string | number, data: Partial<T>): Promise<T | null> {
    const existing = this.data.get(id);
    if (!existing) return null;

    const updated = { ...existing, ...data, id };
    this.data.set(id, updated);
    return updated;
  }

  async delete(id: string | number): Promise<void> {
    this.data.delete(id);
  }

  clear(): void {
    this.data.clear();
  }

  seed(data: T[]): void {
    for (const item of data) {
      this.data.set(item.id, item);
    }
  }

  // For testing
  getAll(): T[] {
    return Array.from(this.data.values());
  }

  count(): number {
    return this.data.size;
  }

  private matches(item: T, where: Partial<T>): boolean {
    return Object.entries(where).every(([key, value]) => {
      return (item as any)[key] === value;
    });
  }
}

/**
 * Create a type-safe mock repository
 */
export function createMockRepository<T extends { id: string | number }>(
  options?: {
    idGenerator?: () => string | number;
    initialData?: T[];
  }
): MockRepository<T> {
  return new MockRepository<T>(options);
}

/**
 * Jest mock helpers for repositories
 */
export function createJestMockRepository<T extends { id: string | number }>(): {
  findAll: jest.Mock<Promise<T[]>>;
  findById: jest.Mock<Promise<T | null>>;
  findOne: jest.Mock<Promise<T | null>>;
  findMany: jest.Mock<Promise<T[]>>;
  create: jest.Mock<Promise<T>>;
  update: jest.Mock<Promise<T | null>>;
  delete: jest.Mock<Promise<void>>;
  save: jest.Mock<Promise<T>>;
  remove: jest.Mock<Promise<void>>;
} {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    findOne: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    delete: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Mock query builder for TypeORM
 */
export class MockQueryBuilder<T> {
  private data: T[] = [];
  private conditions: any[] = [];
  private orderByFields: any[] = [];
  private skipCount = 0;
  private takeCount = 0;
  private selectedFields: string[] = [];
  private relations: string[] = [];

  constructor(initialData: T[] = []) {
    this.data = [...initialData];
  }

  select(selection: string | string[]): this {
    this.selectedFields = Array.isArray(selection) ? selection : [selection];
    return this;
  }

  where(condition: string, params?: Record<string, any>): this {
    this.conditions.push({ condition, params });
    return this;
  }

  andWhere(condition: string, params?: Record<string, any>): this {
    return this.where(condition, params);
  }

  orWhere(condition: string, params?: Record<string, any>): this {
    return this.where(condition, params);
  }

  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByFields.push({ field, direction });
    return this;
  }

  addOrderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    return this.orderBy(field, direction);
  }

  skip(count: number): this {
    this.skipCount = count;
    return this;
  }

  take(count: number): this {
    this.takeCount = count;
    return this;
  }

  leftJoinAndSelect(relation: string, alias: string): this {
    this.relations.push(relation);
    return this;
  }

  async getMany(): Promise<T[]> {
    let result = [...this.data];

    if (this.skipCount > 0) {
      result = result.slice(this.skipCount);
    }

    if (this.takeCount > 0) {
      result = result.slice(0, this.takeCount);
    }

    return result;
  }

  async getOne(): Promise<T | null> {
    return this.data[0] || null;
  }

  async getManyAndCount(): Promise<[T[], number]> {
    const data = await this.getMany();
    return [data, this.data.length];
  }

  async getCount(): Promise<number> {
    return this.data.length;
  }

  setData(data: T[]): this {
    this.data = data;
    return this;
  }
}

export function createMockQueryBuilder<T>(data: T[] = []): MockQueryBuilder<T> {
  return new MockQueryBuilder(data);
}
`;

  await writeFile(path.join(testPath, 'mocks/mock.repository.ts'), content);
  console.log(chalk.green('  ✓ Mock repository'));
}

async function generateDatabaseSeeder(testPath: string, options: TestInfrastructureOptions): Promise<void> {
  const content = `import { DataSource, EntityTarget, Repository } from 'typeorm';

export interface SeederOptions {
  truncate?: boolean;
  order?: string[];
}

export type SeederFactory<T> = () => T | T[] | Promise<T | T[]>;

export interface SeederDefinition<T = any> {
  entity: EntityTarget<T>;
  factory: SeederFactory<T>;
  count?: number;
  dependencies?: EntityTarget<any>[];
}

/**
 * Database seeder for test setup
 */
export class DatabaseSeeder {
  private seeders: Map<EntityTarget<any>, SeederDefinition> = new Map();
  private seededData: Map<EntityTarget<any>, any[]> = new Map();

  constructor(private dataSource: DataSource) {}

  /**
   * Register a seeder
   */
  register<T>(definition: SeederDefinition<T>): this {
    this.seeders.set(definition.entity, definition);
    return this;
  }

  /**
   * Run all seeders
   */
  async seed(options: SeederOptions = {}): Promise<void> {
    const order = options.order || this.getSeederOrder();

    if (options.truncate) {
      await this.truncateAll(order);
    }

    for (const entity of order) {
      const seeder = this.seeders.get(entity);
      if (seeder) {
        await this.runSeeder(seeder);
      }
    }
  }

  /**
   * Run a single seeder
   */
  private async runSeeder<T>(definition: SeederDefinition<T>): Promise<void> {
    const repository = this.dataSource.getRepository(definition.entity);
    const count = definition.count || 1;
    const data: T[] = [];

    for (let i = 0; i < count; i++) {
      const result = await definition.factory();
      const items = Array.isArray(result) ? result : [result];
      data.push(...items);
    }

    const saved = await repository.save(data as any);
    this.seededData.set(definition.entity, Array.isArray(saved) ? saved : [saved]);
  }

  /**
   * Get seeded data for an entity
   */
  getSeeded<T>(entity: EntityTarget<T>): T[] {
    return this.seededData.get(entity) || [];
  }

  /**
   * Get first seeded item
   */
  getFirst<T>(entity: EntityTarget<T>): T | undefined {
    return this.getSeeded(entity)[0];
  }

  /**
   * Truncate all tables
   */
  async truncateAll(order: EntityTarget<any>[]): Promise<void> {
    // Reverse order for truncation to handle foreign keys
    const reversed = [...order].reverse();

    for (const entity of reversed) {
      const repository = this.dataSource.getRepository(entity);
      const tableName = repository.metadata.tableName;

      try {
        await this.dataSource.query(\`TRUNCATE TABLE "\${tableName}" CASCADE\`);
      } catch {
        // SQLite doesn't support TRUNCATE
        await repository.clear();
      }
    }
  }

  /**
   * Clean up seeded data
   */
  async cleanup(): Promise<void> {
    const order = this.getSeederOrder().reverse();

    for (const entity of order) {
      const data = this.seededData.get(entity);
      if (data && data.length > 0) {
        const repository = this.dataSource.getRepository(entity);
        await repository.remove(data);
      }
    }

    this.seededData.clear();
  }

  /**
   * Get seeder order based on dependencies
   */
  private getSeederOrder(): EntityTarget<any>[] {
    const ordered: EntityTarget<any>[] = [];
    const visited = new Set<EntityTarget<any>>();

    const visit = (entity: EntityTarget<any>) => {
      if (visited.has(entity)) return;
      visited.add(entity);

      const seeder = this.seeders.get(entity);
      if (seeder?.dependencies) {
        for (const dep of seeder.dependencies) {
          visit(dep);
        }
      }

      ordered.push(entity);
    };

    for (const entity of this.seeders.keys()) {
      visit(entity);
    }

    return ordered;
  }
}

/**
 * Create a database seeder
 */
export function createSeeder(dataSource: DataSource): DatabaseSeeder {
  return new DatabaseSeeder(dataSource);
}

/**
 * Test database helper
 */
export class TestDatabase {
  private dataSource: DataSource | null = null;

  async connect(options?: any): Promise<DataSource> {
    this.dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      dropSchema: true,
      logging: false,
      entities: options?.entities || [],
      ...options,
    });

    await this.dataSource.initialize();
    return this.dataSource;
  }

  async disconnect(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      await this.dataSource.destroy();
    }
  }

  async reset(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      await this.dataSource.synchronize(true);
    }
  }

  getDataSource(): DataSource {
    if (!this.dataSource) {
      throw new Error('Database not connected');
    }
    return this.dataSource;
  }

  getRepository<T>(entity: EntityTarget<T>): Repository<T> {
    return this.getDataSource().getRepository(entity);
  }
}

export const testDb = new TestDatabase();
`;

  await writeFile(path.join(testPath, 'utils/database.seeder.ts'), content);
  console.log(chalk.green('  ✓ Database seeder'));
}

async function generateTestModuleBuilder(testPath: string): Promise<void> {
  const content = `import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { Type, Provider, ModuleMetadata, DynamicModule } from '@nestjs/common';

/**
 * Fluent builder for test modules
 */
export class TestModuleBuilder {
  private imports: any[] = [];
  private providers: Provider[] = [];
  private controllers: Type<any>[] = [];
  private exports: any[] = [];
  private overrides: Map<Type<any> | string | symbol, any> = new Map();

  /**
   * Add imports
   */
  withImports(...modules: any[]): this {
    this.imports.push(...modules);
    return this;
  }

  /**
   * Add providers
   */
  withProviders(...providers: Provider[]): this {
    this.providers.push(...providers);
    return this;
  }

  /**
   * Add controllers
   */
  withControllers(...controllers: Type<any>[]): this {
    this.controllers.push(...controllers);
    return this;
  }

  /**
   * Add exports
   */
  withExports(...exports: any[]): this {
    this.exports.push(...exports);
    return this;
  }

  /**
   * Override a provider
   */
  override<T>(token: Type<T> | string | symbol, mock: any): this {
    this.overrides.set(token as any, mock);
    return this;
  }

  /**
   * Override with a value
   */
  overrideValue<T>(token: Type<T> | string | symbol, value: T): this {
    return this.override(token, { useValue: value });
  }

  /**
   * Override with a factory
   */
  overrideFactory<T>(
    token: Type<T> | string | symbol,
    factory: (...args: any[]) => T,
    inject?: any[]
  ): this {
    return this.override(token, { useFactory: factory, inject });
  }

  /**
   * Override with a class
   */
  overrideClass<T>(token: Type<T> | string | symbol, mockClass: Type<T>): this {
    return this.override(token, { useClass: mockClass });
  }

  /**
   * Mock a provider with jest mocks
   */
  mock<T>(token: Type<T>): this {
    const mockProvider = this.createAutoMock(token);
    return this.override(token, { useValue: mockProvider });
  }

  /**
   * Build the test module
   */
  async compile(): Promise<TestingModule> {
    let builder = Test.createTestingModule({
      imports: this.imports,
      providers: this.providers,
      controllers: this.controllers,
      exports: this.exports,
    });

    // Apply overrides
    for (const [token, mock] of this.overrides) {
      if (mock.useValue !== undefined) {
        builder = builder.overrideProvider(token as any).useValue(mock.useValue);
      } else if (mock.useFactory !== undefined) {
        builder = builder.overrideProvider(token as any).useFactory({
          factory: mock.useFactory,
          inject: mock.inject,
        });
      } else if (mock.useClass !== undefined) {
        builder = builder.overrideProvider(token as any).useClass(mock.useClass);
      }
    }

    return builder.compile();
  }

  /**
   * Create auto-mock for a class
   */
  private createAutoMock<T>(classType: Type<T>): Record<string, jest.Mock> {
    const mock: Record<string, jest.Mock> = {};
    const prototype = classType.prototype;

    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== 'constructor' && typeof prototype[name] === 'function'
    );

    for (const methodName of methodNames) {
      mock[methodName] = jest.fn();
    }

    return mock;
  }

  /**
   * Create a new builder
   */
  static create(): TestModuleBuilder {
    return new TestModuleBuilder();
  }
}

/**
 * Helper to create test module
 */
export function testModule(): TestModuleBuilder {
  return TestModuleBuilder.create();
}

/**
 * Quick compile a module for testing
 */
export async function compileTestModule(metadata: ModuleMetadata): Promise<TestingModule> {
  return Test.createTestingModule(metadata).compile();
}

/**
 * Test context with common utilities
 */
export interface TestContext<T = any> {
  module: TestingModule;
  service: T;
  cleanup: () => Promise<void>;
}

/**
 * Create a test context for a service
 */
export async function createTestContext<T>(
  serviceClass: Type<T>,
  options: {
    imports?: any[];
    providers?: Provider[];
    mocks?: Map<Type<any>, any>;
  } = {}
): Promise<TestContext<T>> {
  const builder = testModule()
    .withImports(...(options.imports || []))
    .withProviders(serviceClass, ...(options.providers || []));

  if (options.mocks) {
    for (const [token, mock] of options.mocks) {
      builder.override(token, { useValue: mock });
    }
  }

  const module = await builder.compile();
  const service = module.get<T>(serviceClass);

  return {
    module,
    service,
    cleanup: async () => {
      await module.close();
    },
  };
}
`;

  await writeFile(path.join(testPath, 'utils/test-module.builder.ts'), content);
  console.log(chalk.green('  ✓ Test module builder'));
}

async function generateTestUtils(testPath: string): Promise<void> {
  const content = `/**
 * Common test utilities
 */

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await delay(interval);
  }

  throw new Error('waitFor timeout exceeded');
}

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function until it succeeds
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delay?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, delay: delayMs = 100 } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await delay(delayMs * attempt);
      }
    }
  }

  throw lastError;
}

/**
 * Assert that a function throws
 */
export async function expectThrows(
  fn: () => Promise<any>,
  errorType?: new (...args: any[]) => Error
): Promise<Error> {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    if (errorType && !(error instanceof errorType)) {
      throw new Error(\`Expected \${errorType.name} but got \${(error as Error).constructor.name}\`);
    }
    return error as Error;
  }
}

/**
 * Assert async function rejects
 */
export async function expectRejects<T = Error>(
  promise: Promise<any>,
  errorType?: new (...args: any[]) => T
): Promise<T> {
  try {
    await promise;
    throw new Error('Expected promise to reject');
  } catch (error) {
    if (errorType && !(error instanceof errorType)) {
      throw new Error(\`Expected \${errorType.name} but got \${(error as Error).constructor.name}\`);
    }
    return error as T;
  }
}

/**
 * Create a spy on a method
 */
export function spyOn<T extends object, K extends keyof T>(
  obj: T,
  method: K
): jest.SpyInstance {
  return jest.spyOn(obj, method as any);
}

/**
 * Create a mock function with typed return
 */
export function mockFn<T>(): jest.Mock<T> {
  return jest.fn();
}

/**
 * Create a mock that resolves to a value
 */
export function mockResolve<T>(value: T): jest.Mock<Promise<T>> {
  return jest.fn().mockResolvedValue(value);
}

/**
 * Create a mock that rejects with an error
 */
export function mockReject(error: Error): jest.Mock<Promise<never>> {
  return jest.fn().mockRejectedValue(error);
}

/**
 * Reset all mocks
 */
export function resetMocks(...mocks: jest.Mock[]): void {
  mocks.forEach((mock) => mock.mockReset());
}

/**
 * Clear all mocks
 */
export function clearMocks(...mocks: jest.Mock[]): void {
  mocks.forEach((mock) => mock.mockClear());
}

/**
 * Assert object shape
 */
export function expectShape<T extends object>(
  actual: T,
  expected: Partial<T>
): void {
  for (const [key, value] of Object.entries(expected)) {
    expect((actual as any)[key]).toEqual(value);
  }
}

/**
 * Create a partial match for expect
 */
export function partialMatch<T>(expected: Partial<T>): T {
  return expect.objectContaining(expected);
}

/**
 * Random data generators for tests
 */
export const random = {
  string: (length = 10) =>
    Math.random().toString(36).substring(2, 2 + length),
  number: (min = 0, max = 100) =>
    Math.floor(Math.random() * (max - min + 1)) + min,
  boolean: () => Math.random() > 0.5,
  email: () => \`test_\${Date.now()}_\${Math.random().toString(36).slice(2, 7)}@test.com\`,
  uuid: () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }),
  date: () => new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
  pick: <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)],
};

/**
 * Test timing utilities
 */
export class TestTimer {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): this {
    this.startTime = Date.now();
    return this;
  }

  stop(): this {
    this.endTime = Date.now();
    return this;
  }

  get elapsed(): number {
    return (this.endTime || Date.now()) - this.startTime;
  }

  assertWithin(maxMs: number): void {
    if (this.elapsed > maxMs) {
      throw new Error(\`Expected to complete within \${maxMs}ms but took \${this.elapsed}ms\`);
    }
  }
}

export function timer(): TestTimer {
  return new TestTimer().start();
}
`;

  await writeFile(path.join(testPath, 'utils/test.utils.ts'), content);
  console.log(chalk.green('  ✓ Test utilities'));
}

async function generateSampleFactories(testPath: string): Promise<void> {
  const content = `/**
 * Sample factories demonstrating usage
 */

import { faker } from '@faker-js/faker';
import { BaseFactory, FakerHelpers, defineFactory } from './base.factory';
import { factory, sequences } from './factory.builder';

/**
 * Example: User entity interface
 */
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
}

/**
 * Example: Class-based factory
 */
export class UserFactory extends BaseFactory<User> {
  protected getDefaults(): User {
    return {
      id: FakerHelpers.id(),
      email: FakerHelpers.email(),
      firstName: FakerHelpers.firstName(),
      lastName: FakerHelpers.lastName(),
      isActive: true,
      role: 'user',
      createdAt: new Date(),
    };
  }
}

/**
 * Example: Function-based factory using defineFactory
 */
export const userFactory = defineFactory<User>(() => ({
  id: FakerHelpers.id(),
  email: FakerHelpers.email(),
  firstName: FakerHelpers.firstName(),
  lastName: FakerHelpers.lastName(),
  isActive: true,
  role: 'user',
  createdAt: new Date(),
}));

/**
 * Example: Advanced factory with traits and sequences
 */
export const advancedUserFactory = factory<User>(() => ({
  id: FakerHelpers.id(),
  email: FakerHelpers.email(),
  firstName: FakerHelpers.firstName(),
  lastName: FakerHelpers.lastName(),
  isActive: true,
  role: 'user',
  createdAt: new Date(),
}))
  // Define traits
  .trait('admin', { role: 'admin', isActive: true })
  .trait('inactive', { isActive: false })
  .trait('guest', { role: 'guest' })

  // Define sequences
  .sequence('email', sequences.uniqueEmail)

  // After build hook
  .afterBuild((user) => ({
    ...user,
    email: user.email.toLowerCase(),
  }));

/**
 * Usage examples:
 *
 * // Basic usage
 * const user = new UserFactory().create();
 * const users = new UserFactory().createMany(5);
 *
 * // With overrides
 * const admin = new UserFactory().create({ role: 'admin' });
 *
 * // Using defineFactory
 * const user = userFactory.create();
 *
 * // Using advanced factory with traits
 * const adminUser = advancedUserFactory.use('admin').build();
 * const inactiveGuest = advancedUserFactory.use('inactive', 'guest').build();
 *
 * // With custom overrides
 * const customUser = advancedUserFactory
 *   .use('admin')
 *   .with({ firstName: 'John' })
 *   .build();
 */
`;

  await writeFile(path.join(testPath, 'factories/examples.ts'), content);
  console.log(chalk.green('  ✓ Sample factories'));
}
