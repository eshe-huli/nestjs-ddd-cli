import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../utils/file.utils';

export interface MultiDatabaseOptions {
  path?: string;
  databases?: string[];
}

interface DatabaseConfig {
  name: string;
  type: 'postgres' | 'mysql' | 'mongodb' | 'sqlite';
  connectionName: string;
  entities: string[];
}

export async function setupMultiDatabase(basePath: string, options: MultiDatabaseOptions = {}): Promise<void> {
  console.log(chalk.bold.blue('\n🗄️  Setting up Multi-Database Support\n'));

  const sharedPath = path.join(basePath, 'src/shared');
  const dbPath = path.join(sharedPath, 'database');

  await ensureDir(dbPath);
  await ensureDir(path.join(dbPath, 'connections'));
  await ensureDir(path.join(dbPath, 'repositories'));

  // Database configuration types
  const typesContent = `export interface DatabaseConnectionConfig {
  name: string;
  type: 'postgres' | 'mysql' | 'mongodb' | 'sqlite';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  url?: string;
  synchronize?: boolean;
  logging?: boolean;
  entities?: string[];
}

export interface MultiDatabaseConfig {
  default: string;
  connections: Record<string, DatabaseConnectionConfig>;
}

export type ConnectionName = string;

export interface DatabaseHealthStatus {
  name: string;
  connected: boolean;
  latency?: number;
  error?: string;
}
`;
  await writeFile(path.join(dbPath, 'database.types.ts'), typesContent);
  console.log(chalk.green('  ✓ Database types'));

  // Connection manager
  const connectionManagerContent = `import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DatabaseConnectionConfig, DatabaseHealthStatus } from './database.types';

@Injectable()
export class ConnectionManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConnectionManager.name);
  private connections: Map<string, DataSource> = new Map();
  private defaultConnection: string = 'default';

  async onModuleInit() {
    // Connections are lazy-loaded
    this.logger.log('ConnectionManager initialized');
  }

  async onModuleDestroy() {
    await this.closeAll();
  }

  /**
   * Get or create a connection
   */
  async getConnection(name: string = 'default'): Promise<DataSource> {
    if (this.connections.has(name)) {
      const conn = this.connections.get(name)!;
      if (conn.isInitialized) {
        return conn;
      }
    }

    throw new Error(\`Connection "\${name}" not found. Register it first.\`);
  }

  /**
   * Register a new connection
   */
  async registerConnection(config: DatabaseConnectionConfig): Promise<DataSource> {
    if (this.connections.has(config.name)) {
      return this.connections.get(config.name)!;
    }

    const options = this.buildDataSourceOptions(config);
    const dataSource = new DataSource(options);

    await dataSource.initialize();
    this.connections.set(config.name, dataSource);

    this.logger.log(\`Connected to database: \${config.name} (\${config.type})\`);
    return dataSource;
  }

  /**
   * Close a specific connection
   */
  async closeConnection(name: string): Promise<void> {
    const conn = this.connections.get(name);
    if (conn?.isInitialized) {
      await conn.destroy();
      this.connections.delete(name);
      this.logger.log(\`Closed connection: \${name}\`);
    }
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    for (const [name, conn] of this.connections) {
      if (conn.isInitialized) {
        await conn.destroy();
        this.logger.log(\`Closed connection: \${name}\`);
      }
    }
    this.connections.clear();
  }

  /**
   * Check health of all connections
   */
  async healthCheck(): Promise<DatabaseHealthStatus[]> {
    const statuses: DatabaseHealthStatus[] = [];

    for (const [name, conn] of this.connections) {
      const status: DatabaseHealthStatus = { name, connected: false };

      try {
        const start = Date.now();
        await conn.query('SELECT 1');
        status.connected = true;
        status.latency = Date.now() - start;
      } catch (error) {
        status.error = (error as Error).message;
      }

      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Get list of registered connections
   */
  getConnectionNames(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Set default connection
   */
  setDefaultConnection(name: string): void {
    if (!this.connections.has(name)) {
      throw new Error(\`Connection "\${name}" not found\`);
    }
    this.defaultConnection = name;
  }

  private buildDataSourceOptions(config: DatabaseConnectionConfig): DataSourceOptions {
    const base: Partial<DataSourceOptions> = {
      synchronize: config.synchronize ?? false,
      logging: config.logging ?? false,
    };

    switch (config.type) {
      case 'postgres':
        return {
          ...base,
          type: 'postgres',
          host: config.host || 'localhost',
          port: config.port || 5432,
          username: config.username,
          password: config.password,
          database: config.database,
          entities: config.entities || [],
        } as DataSourceOptions;

      case 'mysql':
        return {
          ...base,
          type: 'mysql',
          host: config.host || 'localhost',
          port: config.port || 3306,
          username: config.username,
          password: config.password,
          database: config.database,
          entities: config.entities || [],
        } as DataSourceOptions;

      case 'mongodb':
        return {
          ...base,
          type: 'mongodb',
          url: config.url || \`mongodb://\${config.host}:\${config.port}/\${config.database}\`,
          useNewUrlParser: true,
          useUnifiedTopology: true,
          entities: config.entities || [],
        } as DataSourceOptions;

      case 'sqlite':
        return {
          ...base,
          type: 'sqlite',
          database: config.database || ':memory:',
          entities: config.entities || [],
        } as DataSourceOptions;

      default:
        throw new Error(\`Unsupported database type: \${config.type}\`);
    }
  }
}
`;
  await writeFile(path.join(dbPath, 'connections/connection-manager.ts'), connectionManagerContent);
  console.log(chalk.green('  ✓ Connection manager'));

  // Multi-database repository base
  const multiRepoContent = `import { DataSource, Repository, EntityTarget, ObjectLiteral } from 'typeorm';
import { ConnectionManager } from '../connections/connection-manager';

/**
 * Base repository that can work with multiple database connections
 */
export abstract class MultiDatabaseRepository<T extends ObjectLiteral> {
  protected connectionManager: ConnectionManager;
  protected connectionName: string;
  protected entity: EntityTarget<T>;

  constructor(
    connectionManager: ConnectionManager,
    entity: EntityTarget<T>,
    connectionName: string = 'default'
  ) {
    this.connectionManager = connectionManager;
    this.entity = entity;
    this.connectionName = connectionName;
  }

  /**
   * Get TypeORM repository for the entity
   */
  protected async getRepository(): Promise<Repository<T>> {
    const connection = await this.connectionManager.getConnection(this.connectionName);
    return connection.getRepository(this.entity);
  }

  /**
   * Get raw data source
   */
  protected async getDataSource(): Promise<DataSource> {
    return this.connectionManager.getConnection(this.connectionName);
  }

  /**
   * Switch to a different connection
   */
  useConnection(connectionName: string): this {
    this.connectionName = connectionName;
    return this;
  }

  /**
   * Execute within a transaction
   */
  async withTransaction<R>(work: (repo: Repository<T>) => Promise<R>): Promise<R> {
    const dataSource = await this.getDataSource();
    return dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(this.entity);
      return work(repo);
    });
  }

  // Standard CRUD operations
  async findAll(): Promise<T[]> {
    const repo = await this.getRepository();
    return repo.find();
  }

  async findById(id: string | number): Promise<T | null> {
    const repo = await this.getRepository();
    return repo.findOne({ where: { id } as any });
  }

  async create(data: Partial<T>): Promise<T> {
    const repo = await this.getRepository();
    const entity = repo.create(data as any);
    return repo.save(entity);
  }

  async update(id: string | number, data: Partial<T>): Promise<T | null> {
    const repo = await this.getRepository();
    await repo.update(id, data as any);
    return this.findById(id);
  }

  async delete(id: string | number): Promise<void> {
    const repo = await this.getRepository();
    await repo.delete(id);
  }
}
`;
  await writeFile(path.join(dbPath, 'repositories/multi-database.repository.ts'), multiRepoContent);
  console.log(chalk.green('  ✓ Multi-database repository base'));

  // Database decorator
  const decoratorContent = `import { Inject } from '@nestjs/common';

export const CONNECTION_NAME = 'DATABASE_CONNECTION_NAME';

/**
 * Decorator to specify which database connection to use
 */
export function UseConnection(connectionName: string): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(CONNECTION_NAME, connectionName, target);
  };
}

/**
 * Decorator to inject a specific database connection
 */
export function InjectConnection(connectionName: string = 'default') {
  return Inject(\`DATABASE_CONNECTION_\${connectionName.toUpperCase()}\`);
}
`;
  await writeFile(path.join(dbPath, 'decorators.ts'), decoratorContent);
  console.log(chalk.green('  ✓ Database decorators'));

  // Database module
  const moduleContent = `import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConnectionManager } from './connections/connection-manager';
import { MultiDatabaseConfig, DatabaseConnectionConfig } from './database.types';

@Global()
@Module({})
export class MultiDatabaseModule {
  static forRoot(config: MultiDatabaseConfig): DynamicModule {
    const connectionProviders = Object.entries(config.connections).map(([name, connConfig]) => ({
      provide: \`DATABASE_CONNECTION_\${name.toUpperCase()}\`,
      useFactory: async (manager: ConnectionManager) => {
        return manager.registerConnection({ ...connConfig, name });
      },
      inject: [ConnectionManager],
    }));

    return {
      module: MultiDatabaseModule,
      providers: [
        ConnectionManager,
        ...connectionProviders,
        {
          provide: 'MULTI_DATABASE_CONFIG',
          useValue: config,
        },
      ],
      exports: [ConnectionManager, ...connectionProviders.map(p => p.provide)],
    };
  }

  static forFeature(connectionName: string = 'default'): DynamicModule {
    return {
      module: MultiDatabaseModule,
      providers: [
        {
          provide: 'CURRENT_CONNECTION',
          useFactory: (manager: ConnectionManager) => manager.getConnection(connectionName),
          inject: [ConnectionManager],
        },
      ],
      exports: ['CURRENT_CONNECTION'],
    };
  }
}
`;
  await writeFile(path.join(dbPath, 'multi-database.module.ts'), moduleContent);
  console.log(chalk.green('  ✓ Multi-database module'));

  // Index exports
  await writeFile(path.join(dbPath, 'index.ts'), `export * from './database.types';
export * from './connections/connection-manager';
export * from './repositories/multi-database.repository';
export * from './decorators';
export * from './multi-database.module';
`);

  await writeFile(path.join(dbPath, 'connections/index.ts'), `export * from './connection-manager';
`);

  await writeFile(path.join(dbPath, 'repositories/index.ts'), `export * from './multi-database.repository';
`);

  console.log(chalk.green('\n✅ Multi-database support configured!'));
  console.log(chalk.gray('\nUsage example:'));
  console.log(chalk.cyan(`
  // In app.module.ts
  MultiDatabaseModule.forRoot({
    default: 'primary',
    connections: {
      primary: { type: 'postgres', host: 'localhost', ... },
      analytics: { type: 'mysql', host: 'analytics-db', ... },
      cache: { type: 'mongodb', url: 'mongodb://...', ... },
    },
  })
  `));
}
