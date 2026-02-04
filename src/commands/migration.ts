import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../utils/file.utils';

export interface MigrationOptions {
  name: string;
  orm?: 'typeorm' | 'prisma';
  path?: string;
}

export interface GenerateMigrationOptions {
  module: string;
  orm?: 'typeorm' | 'prisma';
  path?: string;
}

interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  primary: boolean;
  unique: boolean;
  default?: string;
  references?: {
    table: string;
    column: string;
  };
}

interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  indexes: Array<{ columns: string[]; unique: boolean }>;
}

export async function createMigration(basePath: string, options: MigrationOptions): Promise<void> {
  const orm = options.orm || 'typeorm';
  const timestamp = Date.now();
  const migrationName = options.name.replace(/[^a-zA-Z0-9]/g, '_');

  console.log(chalk.bold.blue(`\n📦 Creating ${orm} migration: ${migrationName}\n`));

  if (orm === 'typeorm') {
    await createTypeOrmMigration(basePath, migrationName, timestamp, options.path);
  } else {
    await createPrismaMigration(basePath, migrationName, timestamp, options.path);
  }
}

async function createTypeOrmMigration(
  basePath: string,
  name: string,
  timestamp: number,
  customPath?: string
): Promise<void> {
  const migrationsPath = customPath || path.join(basePath, 'src/database/migrations');
  await ensureDir(migrationsPath);

  const className = `${toPascalCase(name)}${timestamp}`;
  const fileName = `${timestamp}-${name}.ts`;

  const content = `import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class ${className} implements MigrationInterface {
  name = '${className}';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TODO: Add your migration logic here
    // Examples:

    // Create table
    // await queryRunner.createTable(
    //   new Table({
    //     name: "example",
    //     columns: [
    //       { name: "id", type: "uuid", isPrimary: true, generationStrategy: "uuid", default: "uuid_generate_v4()" },
    //       { name: "name", type: "varchar", length: "255" },
    //       { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
    //       { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
    //     ],
    //   }),
    //   true
    // );

    // Add column
    // await queryRunner.query(\`ALTER TABLE "example" ADD COLUMN "new_column" varchar(255)\`);

    // Create index
    // await queryRunner.createIndex("example", new TableIndex({ columnNames: ["name"] }));

    // Add foreign key
    // await queryRunner.createForeignKey(
    //   "example",
    //   new TableForeignKey({
    //     columnNames: ["user_id"],
    //     referencedColumnNames: ["id"],
    //     referencedTableName: "users",
    //     onDelete: "CASCADE",
    //   })
    // );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // TODO: Add your rollback logic here (reverse of up)
    // await queryRunner.dropTable("example");
  }
}
`;

  await writeFile(path.join(migrationsPath, fileName), content);
  console.log(chalk.green(`✓ Created migration: ${fileName}`));
  console.log(chalk.gray(`  Path: ${migrationsPath}`));
}

async function createPrismaMigration(
  basePath: string,
  name: string,
  timestamp: number,
  customPath?: string
): Promise<void> {
  const migrationsPath = customPath || path.join(basePath, 'prisma/migrations');
  const migrationDir = path.join(migrationsPath, `${timestamp}_${name}`);

  await ensureDir(migrationDir);

  const content = `-- Migration: ${name}
-- Created at: ${new Date(timestamp).toISOString()}

-- TODO: Add your SQL migration here
-- Examples:

-- Create table
-- CREATE TABLE "example" (
--   "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   "name" VARCHAR(255) NOT NULL,
--   "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );

-- Add column
-- ALTER TABLE "example" ADD COLUMN "new_column" VARCHAR(255);

-- Create index
-- CREATE INDEX "example_name_idx" ON "example"("name");

-- Add foreign key
-- ALTER TABLE "example"
--   ADD CONSTRAINT "example_user_id_fkey"
--   FOREIGN KEY ("user_id") REFERENCES "users"("id")
--   ON DELETE CASCADE;
`;

  await writeFile(path.join(migrationDir, 'migration.sql'), content);
  console.log(chalk.green(`✓ Created Prisma migration: ${timestamp}_${name}`));
  console.log(chalk.gray(`  Path: ${migrationDir}`));
}

export async function generateMigrationFromEntity(
  basePath: string,
  options: GenerateMigrationOptions
): Promise<void> {
  const orm = options.orm || 'typeorm';
  const modulePath = path.join(basePath, 'src/modules', options.module);

  if (!fs.existsSync(modulePath)) {
    console.log(chalk.red(`❌ Module "${options.module}" not found.`));
    return;
  }

  console.log(chalk.bold.blue(`\n📦 Generating migration from ${options.module} entities...\n`));

  // Find entity files
  const entityFiles = findEntityFiles(modulePath);

  if (entityFiles.length === 0) {
    console.log(chalk.yellow('⚠️  No entity files found in module.'));
    return;
  }

  // Parse entities
  const tables: TableDefinition[] = [];

  for (const file of entityFiles) {
    const table = parseEntityFile(file);
    if (table) {
      tables.push(table);
    }
  }

  if (tables.length === 0) {
    console.log(chalk.yellow('⚠️  No valid entities found.'));
    return;
  }

  // Generate migration
  const timestamp = Date.now();
  const migrationName = `create_${options.module}_tables`;

  if (orm === 'typeorm') {
    await generateTypeOrmMigration(basePath, tables, migrationName, timestamp);
  } else {
    await generatePrismaMigration(basePath, tables, migrationName, timestamp);
  }
}

function findEntityFiles(modulePath: string): string[] {
  const files: string[] = [];

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.name.endsWith('.entity.ts')) {
        files.push(fullPath);
      }
    }
  }

  scan(modulePath);
  return files;
}

function parseEntityFile(filePath: string): TableDefinition | null {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Extract table name
  const tableMatch = content.match(/@Entity\(\s*['"]?([^'")\s]+)?['"]?\s*\)/);
  const className = content.match(/export\s+class\s+(\w+)/);

  if (!className) return null;

  const tableName = tableMatch?.[1] || toSnakeCase(className[1].replace(/Entity$/, ''));

  const columns: ColumnDefinition[] = [];
  const indexes: Array<{ columns: string[]; unique: boolean }> = [];

  // Parse columns
  const columnRegex = /@(?:PrimaryGeneratedColumn|PrimaryColumn|Column|CreateDateColumn|UpdateDateColumn|DeleteDateColumn)\s*\(([^)]*)\)\s*(\w+)(?:\?)?:\s*(\w+)/g;

  let match;
  while ((match = columnRegex.exec(content)) !== null) {
    const decorator = match[0];
    const options = match[1];
    const propName = match[2];
    const propType = match[3];

    const column: ColumnDefinition = {
      name: toSnakeCase(propName),
      type: mapTypeToSql(propType, options),
      nullable: options.includes('nullable: true') || decorator.includes('?:'),
      primary: decorator.includes('Primary'),
      unique: options.includes('unique: true'),
    };

    if (options.includes('default:')) {
      const defaultMatch = options.match(/default:\s*['"]?([^'",}]+)['"]?/);
      if (defaultMatch) {
        column.default = defaultMatch[1];
      }
    }

    columns.push(column);
  }

  // Parse relations for foreign keys
  const relationRegex = /@(?:ManyToOne|OneToOne)\s*\([^)]*\)\s*(?:@JoinColumn\(\s*\{[^}]*name:\s*['"](\w+)['"][^}]*\}\s*\))?\s*(\w+)/g;

  while ((match = relationRegex.exec(content)) !== null) {
    const fkColumn = match[1] || `${toSnakeCase(match[2])}_id`;
    const relatedEntity = match[2];

    // Add foreign key column if not already present
    if (!columns.find(c => c.name === fkColumn)) {
      columns.push({
        name: fkColumn,
        type: 'uuid',
        nullable: true,
        primary: false,
        unique: false,
        references: {
          table: toSnakeCase(relatedEntity),
          column: 'id',
        },
      });
    }
  }

  // Parse indexes
  const indexMatch = content.match(/@Index\(\s*\[([^\]]+)\]/g);
  if (indexMatch) {
    for (const idx of indexMatch) {
      const cols = idx.match(/['"](\w+)['"]/g);
      if (cols) {
        indexes.push({
          columns: cols.map(c => c.replace(/['"]/g, '')),
          unique: idx.includes('unique: true'),
        });
      }
    }
  }

  // Add default columns if missing
  if (!columns.find(c => c.name === 'id')) {
    columns.unshift({
      name: 'id',
      type: 'uuid',
      nullable: false,
      primary: true,
      unique: true,
      default: 'uuid_generate_v4()',
    });
  }

  if (!columns.find(c => c.name === 'created_at')) {
    columns.push({
      name: 'created_at',
      type: 'timestamp',
      nullable: false,
      primary: false,
      unique: false,
      default: 'CURRENT_TIMESTAMP',
    });
  }

  if (!columns.find(c => c.name === 'updated_at')) {
    columns.push({
      name: 'updated_at',
      type: 'timestamp',
      nullable: false,
      primary: false,
      unique: false,
      default: 'CURRENT_TIMESTAMP',
    });
  }

  return { name: tableName, columns, indexes };
}

function mapTypeToSql(tsType: string, options: string): string {
  const typeMap: Record<string, string> = {
    'string': 'varchar(255)',
    'number': 'integer',
    'boolean': 'boolean',
    'Date': 'timestamp',
    'bigint': 'bigint',
    'float': 'float',
    'decimal': 'decimal(10,2)',
  };

  // Check for explicit type in decorator options
  const explicitType = options.match(/type:\s*['"](\w+)['"]/);
  if (explicitType) {
    return explicitType[1];
  }

  // Check for length
  const length = options.match(/length:\s*(\d+)/);
  if (length && tsType === 'string') {
    return `varchar(${length[1]})`;
  }

  return typeMap[tsType] || 'varchar(255)';
}

async function generateTypeOrmMigration(
  basePath: string,
  tables: TableDefinition[],
  name: string,
  timestamp: number
): Promise<void> {
  const migrationsPath = path.join(basePath, 'src/database/migrations');
  await ensureDir(migrationsPath);

  const className = `${toPascalCase(name)}${timestamp}`;
  const fileName = `${timestamp}-${name}.ts`;

  let upStatements = '';
  let downStatements = '';

  for (const table of tables) {
    // Generate CREATE TABLE
    const columnDefs = table.columns.map(col => {
      let def = `{ name: "${col.name}", type: "${col.type}"`;

      if (col.primary) {
        def += ', isPrimary: true';
        if (col.type === 'uuid') {
          def += ', generationStrategy: "uuid", default: "uuid_generate_v4()"';
        }
      }

      if (!col.nullable && !col.primary) {
        def += ', isNullable: false';
      } else if (col.nullable) {
        def += ', isNullable: true';
      }

      if (col.unique && !col.primary) {
        def += ', isUnique: true';
      }

      if (col.default && !col.primary) {
        def += `, default: "${col.default}"`;
      }

      def += ' }';
      return def;
    });

    upStatements += `
    // Create ${table.name} table
    await queryRunner.createTable(
      new Table({
        name: "${table.name}",
        columns: [
          ${columnDefs.join(',\n          ')},
        ],
      }),
      true
    );
`;

    // Generate indexes
    for (const index of table.indexes) {
      const indexName = `IDX_${table.name}_${index.columns.join('_')}`;
      upStatements += `
    await queryRunner.createIndex(
      "${table.name}",
      new TableIndex({
        name: "${indexName}",
        columnNames: [${index.columns.map(c => `"${c}"`).join(', ')}],
        ${index.unique ? 'isUnique: true,' : ''}
      })
    );
`;
    }

    // Generate foreign keys
    for (const col of table.columns.filter(c => c.references)) {
      const fkName = `FK_${table.name}_${col.name}`;
      upStatements += `
    await queryRunner.createForeignKey(
      "${table.name}",
      new TableForeignKey({
        name: "${fkName}",
        columnNames: ["${col.name}"],
        referencedColumnNames: ["${col.references!.column}"],
        referencedTableName: "${col.references!.table}",
        onDelete: "SET NULL",
      })
    );
`;
    }

    // Generate DROP TABLE for down
    downStatements = `await queryRunner.dropTable("${table.name}", true);\n    ` + downStatements;
  }

  const content = `import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from "typeorm";

export class ${className} implements MigrationInterface {
  name = '${className}';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
${upStatements}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    ${downStatements}
  }
}
`;

  await writeFile(path.join(migrationsPath, fileName), content);
  console.log(chalk.green(`✓ Generated migration: ${fileName}`));

  for (const table of tables) {
    console.log(chalk.gray(`  • Table: ${table.name} (${table.columns.length} columns)`));
  }
}

async function generatePrismaMigration(
  basePath: string,
  tables: TableDefinition[],
  name: string,
  timestamp: number
): Promise<void> {
  const migrationsPath = path.join(basePath, 'prisma/migrations');
  const migrationDir = path.join(migrationsPath, `${timestamp}_${name}`);

  await ensureDir(migrationDir);

  let upSql = `-- Migration: ${name}\n-- Generated at: ${new Date(timestamp).toISOString()}\n\n`;
  let downSql = `-- Rollback migration: ${name}\n\n`;

  for (const table of tables) {
    // Generate CREATE TABLE
    const columnDefs = table.columns.map(col => {
      let def = `  "${col.name}" ${col.type.toUpperCase()}`;

      if (col.primary) {
        def += ' PRIMARY KEY';
        if (col.default) {
          def += ` DEFAULT ${col.default}`;
        }
      } else {
        if (!col.nullable) {
          def += ' NOT NULL';
        }
        if (col.unique) {
          def += ' UNIQUE';
        }
        if (col.default) {
          def += ` DEFAULT ${col.default}`;
        }
      }

      return def;
    });

    upSql += `CREATE TABLE "${table.name}" (\n${columnDefs.join(',\n')}\n);\n\n`;

    // Generate indexes
    for (const index of table.indexes) {
      const indexName = `${table.name}_${index.columns.join('_')}_idx`;
      upSql += `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX "${indexName}" ON "${table.name}"(${index.columns.map(c => `"${c}"`).join(', ')});\n`;
    }

    // Generate foreign keys
    for (const col of table.columns.filter(c => c.references)) {
      const fkName = `${table.name}_${col.name}_fkey`;
      upSql += `ALTER TABLE "${table.name}" ADD CONSTRAINT "${fkName}" FOREIGN KEY ("${col.name}") REFERENCES "${col.references!.table}"("${col.references!.column}") ON DELETE SET NULL;\n`;
    }

    upSql += '\n';

    // Generate DROP for down
    downSql += `DROP TABLE IF EXISTS "${table.name}" CASCADE;\n`;
  }

  await writeFile(path.join(migrationDir, 'migration.sql'), upSql);
  console.log(chalk.green(`✓ Generated Prisma migration: ${timestamp}_${name}`));

  for (const table of tables) {
    console.log(chalk.gray(`  • Table: ${table.name} (${table.columns.length} columns)`));
  }
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}
