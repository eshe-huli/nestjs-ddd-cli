import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../utils/file.utils';

export interface MigrationEngineOptions {
  path?: string;
  orm?: 'typeorm' | 'prisma';
  dryRun?: boolean;
}

interface EntitySchema {
  name: string;
  tableName: string;
  columns: ColumnSchema[];
  indexes: IndexSchema[];
  relations: RelationSchema[];
}

interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  primary: boolean;
  unique: boolean;
  default?: string;
  length?: number;
}

interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
}

interface RelationSchema {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  target: string;
  joinColumn?: string;
}

interface SchemaDiff {
  added: {
    tables: EntitySchema[];
    columns: Array<{ table: string; column: ColumnSchema }>;
    indexes: Array<{ table: string; index: IndexSchema }>;
  };
  removed: {
    tables: string[];
    columns: Array<{ table: string; column: string }>;
    indexes: Array<{ table: string; index: string }>;
  };
  modified: {
    columns: Array<{ table: string; column: string; changes: Partial<ColumnSchema> }>;
  };
}

export async function diffMigration(basePath: string, options: MigrationEngineOptions = {}): Promise<void> {
  console.log(chalk.bold.blue('\n🔄 Migration Diff Engine\n'));

  const modulesPath = path.join(basePath, 'src/modules');

  if (!fs.existsSync(modulesPath)) {
    console.log(chalk.red('❌ No modules directory found.'));
    return;
  }

  // Parse current entity schemas
  const currentSchemas = parseEntitySchemas(modulesPath);

  console.log(chalk.cyan(`Found ${currentSchemas.length} entities`));

  // Load previous schema snapshot (if exists)
  const snapshotPath = path.join(basePath, '.ddd/schema-snapshot.json');
  let previousSchemas: EntitySchema[] = [];

  if (fs.existsSync(snapshotPath)) {
    previousSchemas = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    console.log(chalk.gray(`Previous snapshot: ${previousSchemas.length} entities`));
  } else {
    console.log(chalk.yellow('No previous schema snapshot found. Will generate initial migration.'));
  }

  // Calculate diff
  const diff = calculateDiff(previousSchemas, currentSchemas);

  if (isDiffEmpty(diff)) {
    console.log(chalk.green('\n✅ No schema changes detected.'));
    return;
  }

  // Print diff
  printDiff(diff);

  if (options.dryRun) {
    console.log(chalk.yellow('\n🔍 Dry run - no files will be generated.'));
    return;
  }

  // Generate migration
  const timestamp = Date.now();
  const migrationName = generateMigrationName(diff);

  if (options.orm === 'prisma') {
    await generatePrismaMigrationFromDiff(basePath, diff, migrationName, timestamp);
  } else {
    await generateTypeOrmMigrationFromDiff(basePath, diff, migrationName, timestamp);
  }

  // Save new snapshot
  await ensureDir(path.join(basePath, '.ddd'));
  await writeFile(snapshotPath, JSON.stringify(currentSchemas, null, 2));
  console.log(chalk.gray('\n📸 Schema snapshot updated.'));
}

function parseEntitySchemas(modulesPath: string): EntitySchema[] {
  const schemas: EntitySchema[] = [];
  const entityFiles = findEntityFiles(modulesPath);

  for (const file of entityFiles) {
    const schema = parseEntityFile(file);
    if (schema) {
      schemas.push(schema);
    }
  }

  return schemas;
}

function parseEntityFile(filePath: string): EntitySchema | null {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Extract class name and table name
  const classMatch = content.match(/export\s+class\s+(\w+)/);
  if (!classMatch) return null;

  const className = classMatch[1];
  const tableMatch = content.match(/@Entity\(\s*['"]?([^'")\s]+)?['"]?\s*\)/);
  const tableName = tableMatch?.[1] || toSnakeCase(className.replace(/Entity$/, ''));

  const columns: ColumnSchema[] = [];
  const indexes: IndexSchema[] = [];
  const relations: RelationSchema[] = [];

  // Parse columns
  const columnRegex = /@(?:Column|PrimaryGeneratedColumn|PrimaryColumn|CreateDateColumn|UpdateDateColumn|DeleteDateColumn)\s*\(([^)]*)\)\s*(\w+)(?:\?)?:\s*(\w+)/g;

  let match;
  while ((match = columnRegex.exec(content)) !== null) {
    const options = match[1];
    const propName = match[2];
    const propType = match[3];

    columns.push({
      name: toSnakeCase(propName),
      type: extractColumnType(propType, options),
      nullable: options.includes('nullable: true') || match[0].includes('?:'),
      primary: match[0].includes('Primary'),
      unique: options.includes('unique: true'),
      default: extractDefault(options),
      length: extractLength(options),
    });
  }

  // Parse indexes
  const indexRegex = /@Index\(\s*(?:\[[^\]]+\]|['"][^'"]+['"])/g;
  while ((match = indexRegex.exec(content)) !== null) {
    const indexContent = match[0];
    const colsMatch = indexContent.match(/\[([^\]]+)\]/);
    if (colsMatch) {
      const cols = colsMatch[1].match(/['"](\w+)['"]/g)?.map(c => c.replace(/['"]/g, '')) || [];
      indexes.push({
        name: `IDX_${tableName}_${cols.join('_')}`,
        columns: cols,
        unique: indexContent.includes('unique: true'),
      });
    }
  }

  // Parse relations
  const relationTypes = ['ManyToOne', 'OneToMany', 'OneToOne', 'ManyToMany'];
  for (const relType of relationTypes) {
    const relRegex = new RegExp(`@${relType}\\s*\\([^)]*\\)[\\s\\S]*?(\\w+):\\s*(\\w+)`, 'g');
    while ((match = relRegex.exec(content)) !== null) {
      relations.push({
        name: match[1],
        type: relType.toLowerCase().replace(/([a-z])([a-z]+)([a-z])([a-z]+)/g, '$1$2-$3$4') as any,
        target: match[2],
      });
    }
  }

  return { name: className, tableName, columns, indexes, relations };
}

function calculateDiff(previous: EntitySchema[], current: EntitySchema[]): SchemaDiff {
  const diff: SchemaDiff = {
    added: { tables: [], columns: [], indexes: [] },
    removed: { tables: [], columns: [], indexes: [] },
    modified: { columns: [] },
  };

  const prevMap = new Map(previous.map(s => [s.tableName, s]));
  const currMap = new Map(current.map(s => [s.tableName, s]));

  // Find added tables
  for (const schema of current) {
    if (!prevMap.has(schema.tableName)) {
      diff.added.tables.push(schema);
    }
  }

  // Find removed tables
  for (const schema of previous) {
    if (!currMap.has(schema.tableName)) {
      diff.removed.tables.push(schema.tableName);
    }
  }

  // Find column changes in existing tables
  for (const curr of current) {
    const prev = prevMap.get(curr.tableName);
    if (!prev) continue;

    const prevCols = new Map(prev.columns.map(c => [c.name, c]));
    const currCols = new Map(curr.columns.map(c => [c.name, c]));

    // Added columns
    for (const col of curr.columns) {
      if (!prevCols.has(col.name)) {
        diff.added.columns.push({ table: curr.tableName, column: col });
      }
    }

    // Removed columns
    for (const col of prev.columns) {
      if (!currCols.has(col.name)) {
        diff.removed.columns.push({ table: curr.tableName, column: col.name });
      }
    }

    // Modified columns
    for (const col of curr.columns) {
      const prevCol = prevCols.get(col.name);
      if (prevCol) {
        const changes: Partial<ColumnSchema> = {};
        if (col.type !== prevCol.type) changes.type = col.type;
        if (col.nullable !== prevCol.nullable) changes.nullable = col.nullable;
        if (col.unique !== prevCol.unique) changes.unique = col.unique;

        if (Object.keys(changes).length > 0) {
          diff.modified.columns.push({ table: curr.tableName, column: col.name, changes });
        }
      }
    }

    // Index changes
    const prevIdxs = new Set(prev.indexes.map(i => i.name));
    const currIdxs = new Set(curr.indexes.map(i => i.name));

    for (const idx of curr.indexes) {
      if (!prevIdxs.has(idx.name)) {
        diff.added.indexes.push({ table: curr.tableName, index: idx });
      }
    }

    for (const idx of prev.indexes) {
      if (!currIdxs.has(idx.name)) {
        diff.removed.indexes.push({ table: curr.tableName, index: idx.name });
      }
    }
  }

  return diff;
}

function isDiffEmpty(diff: SchemaDiff): boolean {
  return (
    diff.added.tables.length === 0 &&
    diff.added.columns.length === 0 &&
    diff.added.indexes.length === 0 &&
    diff.removed.tables.length === 0 &&
    diff.removed.columns.length === 0 &&
    diff.removed.indexes.length === 0 &&
    diff.modified.columns.length === 0
  );
}

function printDiff(diff: SchemaDiff): void {
  console.log(chalk.bold('\n📋 Schema Changes:\n'));

  if (diff.added.tables.length > 0) {
    console.log(chalk.green('+ Added Tables:'));
    for (const table of diff.added.tables) {
      console.log(chalk.green(`  + ${table.tableName} (${table.columns.length} columns)`));
    }
  }

  if (diff.removed.tables.length > 0) {
    console.log(chalk.red('- Removed Tables:'));
    for (const table of diff.removed.tables) {
      console.log(chalk.red(`  - ${table}`));
    }
  }

  if (diff.added.columns.length > 0) {
    console.log(chalk.green('+ Added Columns:'));
    for (const { table, column } of diff.added.columns) {
      console.log(chalk.green(`  + ${table}.${column.name} (${column.type})`));
    }
  }

  if (diff.removed.columns.length > 0) {
    console.log(chalk.red('- Removed Columns:'));
    for (const { table, column } of diff.removed.columns) {
      console.log(chalk.red(`  - ${table}.${column}`));
    }
  }

  if (diff.modified.columns.length > 0) {
    console.log(chalk.yellow('~ Modified Columns:'));
    for (const { table, column, changes } of diff.modified.columns) {
      console.log(chalk.yellow(`  ~ ${table}.${column}: ${JSON.stringify(changes)}`));
    }
  }
}

function generateMigrationName(diff: SchemaDiff): string {
  const parts: string[] = [];

  if (diff.added.tables.length > 0) {
    parts.push(`add_${diff.added.tables.map(t => t.tableName).join('_')}`);
  }
  if (diff.removed.tables.length > 0) {
    parts.push(`drop_${diff.removed.tables.join('_')}`);
  }
  if (diff.added.columns.length > 0 || diff.modified.columns.length > 0) {
    parts.push('modify_columns');
  }

  return parts.join('_') || 'schema_update';
}

async function generateTypeOrmMigrationFromDiff(
  basePath: string,
  diff: SchemaDiff,
  name: string,
  timestamp: number
): Promise<void> {
  const migrationsPath = path.join(basePath, 'src/database/migrations');
  await ensureDir(migrationsPath);

  const className = `${toPascalCase(name)}${timestamp}`;
  const fileName = `${timestamp}-${name}.ts`;

  let upStatements = '';
  let downStatements = '';

  // Added tables
  for (const table of diff.added.tables) {
    upStatements += generateCreateTableSql(table);
    downStatements = `    await queryRunner.dropTable("${table.tableName}", true);\n` + downStatements;
  }

  // Removed tables (down restores them - simplified)
  for (const tableName of diff.removed.tables) {
    upStatements += `    await queryRunner.dropTable("${tableName}", true);\n`;
  }

  // Added columns
  for (const { table, column } of diff.added.columns) {
    upStatements += `    await queryRunner.query(\`ALTER TABLE "${table}" ADD COLUMN "${column.name}" ${column.type.toUpperCase()}${column.nullable ? '' : ' NOT NULL'}${column.default ? ` DEFAULT ${column.default}` : ''}\`);\n`;
    downStatements = `    await queryRunner.query(\`ALTER TABLE "${table}" DROP COLUMN "${column.name}"\`);\n` + downStatements;
  }

  // Removed columns
  for (const { table, column } of diff.removed.columns) {
    upStatements += `    await queryRunner.query(\`ALTER TABLE "${table}" DROP COLUMN "${column}"\`);\n`;
  }

  // Modified columns
  for (const { table, column, changes } of diff.modified.columns) {
    if (changes.type) {
      upStatements += `    await queryRunner.query(\`ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE ${changes.type.toUpperCase()}\`);\n`;
    }
    if (changes.nullable !== undefined) {
      upStatements += `    await queryRunner.query(\`ALTER TABLE "${table}" ALTER COLUMN "${column}" ${changes.nullable ? 'DROP NOT NULL' : 'SET NOT NULL'}\`);\n`;
    }
  }

  const content = `import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from "typeorm";

export class ${className} implements MigrationInterface {
  name = '${className}';

  public async up(queryRunner: QueryRunner): Promise<void> {
${upStatements || '    // No changes'}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
${downStatements || '    // No changes'}
  }
}
`;

  await writeFile(path.join(migrationsPath, fileName), content);
  console.log(chalk.green(`\n✅ Generated migration: ${fileName}`));
}

async function generatePrismaMigrationFromDiff(
  basePath: string,
  diff: SchemaDiff,
  name: string,
  timestamp: number
): Promise<void> {
  const migrationsPath = path.join(basePath, 'prisma/migrations', `${timestamp}_${name}`);
  await ensureDir(migrationsPath);

  let sql = `-- Migration: ${name}\n-- Generated: ${new Date().toISOString()}\n\n`;

  // Added tables
  for (const table of diff.added.tables) {
    sql += generateCreateTablePrisma(table);
  }

  // Removed tables
  for (const tableName of diff.removed.tables) {
    sql += `DROP TABLE IF EXISTS "${tableName}" CASCADE;\n\n`;
  }

  // Added columns
  for (const { table, column } of diff.added.columns) {
    sql += `ALTER TABLE "${table}" ADD COLUMN "${column.name}" ${column.type.toUpperCase()}`;
    if (!column.nullable) sql += ' NOT NULL';
    if (column.default) sql += ` DEFAULT ${column.default}`;
    sql += ';\n';
  }

  // Removed columns
  for (const { table, column } of diff.removed.columns) {
    sql += `ALTER TABLE "${table}" DROP COLUMN "${column}";\n`;
  }

  await writeFile(path.join(migrationsPath, 'migration.sql'), sql);
  console.log(chalk.green(`\n✅ Generated Prisma migration: ${timestamp}_${name}`));
}

function generateCreateTableSql(table: EntitySchema): string {
  const columns = table.columns.map(col => {
    let def = `{ name: "${col.name}", type: "${col.type}"`;
    if (col.primary) def += ', isPrimary: true';
    if (!col.nullable && !col.primary) def += ', isNullable: false';
    if (col.unique && !col.primary) def += ', isUnique: true';
    if (col.default) def += `, default: "${col.default}"`;
    def += ' }';
    return def;
  });

  return `
    await queryRunner.createTable(
      new Table({
        name: "${table.tableName}",
        columns: [
          ${columns.join(',\n          ')},
        ],
      }),
      true
    );
`;
}

function generateCreateTablePrisma(table: EntitySchema): string {
  const columns = table.columns.map(col => {
    let def = `  "${col.name}" ${col.type.toUpperCase()}`;
    if (col.primary) def += ' PRIMARY KEY';
    if (!col.nullable && !col.primary) def += ' NOT NULL';
    if (col.unique && !col.primary) def += ' UNIQUE';
    if (col.default) def += ` DEFAULT ${col.default}`;
    return def;
  });

  return `CREATE TABLE "${table.tableName}" (\n${columns.join(',\n')}\n);\n\n`;
}

function findEntityFiles(dir: string): string[] {
  const files: string[] = [];
  function scan(d: string) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) scan(p);
      else if (e.name.endsWith('.entity.ts')) files.push(p);
    }
  }
  scan(dir);
  return files;
}

function extractColumnType(tsType: string, options: string): string {
  const explicitType = options.match(/type:\s*['"](\w+)['"]/);
  if (explicitType) return explicitType[1];

  const typeMap: Record<string, string> = {
    string: 'varchar',
    number: 'integer',
    boolean: 'boolean',
    Date: 'timestamp',
  };
  return typeMap[tsType] || 'varchar';
}

function extractDefault(options: string): string | undefined {
  const match = options.match(/default:\s*['"]?([^'",}]+)['"]?/);
  return match?.[1];
}

function extractLength(options: string): number | undefined {
  const match = options.match(/length:\s*(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function toPascalCase(str: string): string {
  return str.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}
