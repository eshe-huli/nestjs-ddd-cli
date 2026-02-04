import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { generateAll } from './generate-all';
import { toKebabCase, toPascalCase } from '../utils/naming.utils';

/**
 * Schema file format for defining entities
 *
 * Example JSON:
 * {
 *   "module": "users",
 *   "orm": "typeorm",
 *   "entities": [
 *     {
 *       "name": "User",
 *       "fields": [
 *         { "name": "email", "type": "string", "unique": true },
 *         { "name": "password", "type": "string" },
 *         { "name": "firstName", "type": "string", "optional": true },
 *         { "name": "lastName", "type": "string", "optional": true },
 *         { "name": "role", "type": "enum", "values": ["admin", "user", "guest"] }
 *       ]
 *     }
 *   ],
 *   "options": {
 *     "withTests": true,
 *     "withEvents": false
 *   }
 * }
 */

export interface SchemaField {
  name: string;
  type: string;
  optional?: boolean;
  unique?: boolean;
  relation?: boolean;
  values?: string[]; // for enums
}

export interface SchemaEntity {
  name: string;
  fields: SchemaField[];
  skipOrm?: boolean;
  skipMapper?: boolean;
  skipRepo?: boolean;
}

export interface SchemaDefinition {
  module: string;
  orm?: 'typeorm' | 'prisma';
  entities: SchemaEntity[];
  options?: {
    withTests?: boolean;
    withEvents?: boolean;
    withQueries?: boolean;
    installDeps?: boolean;
  };
}

export async function generateFromSchema(schemaPath: string, options: any) {
  console.log(chalk.blue(`\n📄 Generating from schema: ${schemaPath}\n`));

  const basePath = options.path || process.cwd();
  const fullSchemaPath = path.isAbsolute(schemaPath)
    ? schemaPath
    : path.join(basePath, schemaPath);

  // Check if schema file exists
  if (!(await fs.pathExists(fullSchemaPath))) {
    throw new Error(`Schema file not found: ${fullSchemaPath}`);
  }

  // Read and parse schema
  const schema = await loadSchema(fullSchemaPath);

  // Validate schema
  validateSchema(schema);

  console.log(chalk.cyan(`  Module: ${schema.module}`));
  console.log(chalk.cyan(`  ORM: ${schema.orm || 'typeorm'}`));
  console.log(chalk.cyan(`  Entities: ${schema.entities.map(e => e.name).join(', ')}`));
  console.log('');

  // Generate each entity
  for (const entity of schema.entities) {
    console.log(chalk.blue(`\n🏗️  Generating entity: ${entity.name}`));

    // Convert fields to CLI format
    const fieldsString = convertFieldsToString(entity.fields);

    // Merge options
    const entityOptions = {
      ...options,
      module: schema.module,
      orm: schema.orm || 'typeorm',
      fields: fieldsString,
      skipOrm: entity.skipOrm,
      skipMapper: entity.skipMapper,
      skipRepo: entity.skipRepo,
      withTests: schema.options?.withTests ?? options.withTests,
      withEvents: schema.options?.withEvents ?? options.withEvents,
      withQueries: schema.options?.withQueries ?? true,
      installDeps: schema.options?.installDeps ?? options.installDeps,
    };

    await generateAll(entity.name, entityOptions);
  }

  console.log(chalk.green(`\n✅ Generated ${schema.entities.length} entities from schema`));

  // Show summary
  console.log(chalk.cyan(`\n📁 Generated structure:`));
  console.log(`   ${chalk.white('Module:')} ${toKebabCase(schema.module)}`);
  console.log(`   ${chalk.white('ORM:')} ${schema.orm || 'typeorm'}`);
  for (const entity of schema.entities) {
    console.log(`   ${chalk.white('Entity:')} ${toPascalCase(entity.name)} (${entity.fields.length} fields)`);
  }
}

async function loadSchema(schemaPath: string): Promise<SchemaDefinition> {
  const ext = path.extname(schemaPath).toLowerCase();
  const content = await fs.readFile(schemaPath, 'utf-8');

  if (ext === '.json') {
    return JSON.parse(content);
  } else if (ext === '.yaml' || ext === '.yml') {
    // Simple YAML parser for basic structures
    // For production, you'd use a proper YAML library
    try {
      // Try to require yaml if available
      const yaml = require('yaml');
      return yaml.parse(content);
    } catch {
      throw new Error('YAML parsing requires the "yaml" package. Install it with: npm install yaml');
    }
  } else {
    throw new Error(`Unsupported schema file format: ${ext}. Use .json or .yaml`);
  }
}

function validateSchema(schema: SchemaDefinition): void {
  if (!schema.module) {
    throw new Error('Schema must have a "module" property');
  }

  if (!schema.entities || !Array.isArray(schema.entities) || schema.entities.length === 0) {
    throw new Error('Schema must have at least one entity in the "entities" array');
  }

  for (const entity of schema.entities) {
    if (!entity.name) {
      throw new Error('Each entity must have a "name" property');
    }

    if (!entity.fields || !Array.isArray(entity.fields)) {
      throw new Error(`Entity "${entity.name}" must have a "fields" array`);
    }

    for (const field of entity.fields) {
      if (!field.name) {
        throw new Error(`All fields in entity "${entity.name}" must have a "name" property`);
      }
      if (!field.type) {
        throw new Error(`Field "${field.name}" in entity "${entity.name}" must have a "type" property`);
      }
      if (field.type === 'enum' && (!field.values || field.values.length === 0)) {
        throw new Error(`Enum field "${field.name}" in entity "${entity.name}" must have "values" array`);
      }
    }
  }
}

function convertFieldsToString(fields: SchemaField[]): string {
  return fields
    .map(field => {
      let fieldStr = `${field.name}:${field.type}`;

      const modifiers: string[] = [];
      if (field.optional) modifiers.push('optional');
      if (field.unique) modifiers.push('unique');
      if (field.relation) modifiers.push('relation');
      if (field.values && field.values.length > 0) {
        modifiers.push(field.values.join(','));
      }

      if (modifiers.length > 0) {
        fieldStr += ':' + modifiers.join(':');
      }

      return fieldStr;
    })
    .join(' ');
}

/**
 * Create a sample schema file for reference
 */
export async function createSampleSchema(outputPath: string, options: any) {
  const basePath = options.path || process.cwd();
  const fullOutputPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(basePath, outputPath);

  const sampleSchema: SchemaDefinition = {
    module: 'users',
    orm: 'typeorm',
    entities: [
      {
        name: 'User',
        fields: [
          { name: 'email', type: 'string', unique: true },
          { name: 'password', type: 'string' },
          { name: 'firstName', type: 'string', optional: true },
          { name: 'lastName', type: 'string', optional: true },
          { name: 'role', type: 'enum', values: ['admin', 'user', 'guest'] },
          { name: 'isVerified', type: 'boolean' },
          { name: 'lastLoginAt', type: 'datetime', optional: true },
        ],
      },
      {
        name: 'Profile',
        fields: [
          { name: 'userId', type: 'uuid', relation: true },
          { name: 'bio', type: 'text', optional: true },
          { name: 'avatarUrl', type: 'string', optional: true },
          { name: 'socialLinks', type: 'json', optional: true },
        ],
      },
    ],
    options: {
      withTests: true,
      withEvents: false,
      withQueries: true,
      installDeps: false,
    },
  };

  const ext = path.extname(fullOutputPath).toLowerCase();

  if (ext === '.yaml' || ext === '.yml') {
    try {
      const yaml = require('yaml');
      await fs.outputFile(fullOutputPath, yaml.stringify(sampleSchema));
    } catch {
      throw new Error('YAML writing requires the "yaml" package. Install it with: npm install yaml');
    }
  } else {
    await fs.outputFile(fullOutputPath, JSON.stringify(sampleSchema, null, 2));
  }

  console.log(chalk.green(`✓ Sample schema created: ${fullOutputPath}`));
  console.log(chalk.cyan('\nTo generate from this schema, run:'));
  console.log(chalk.white(`  ddd from-schema ${outputPath}`));
}
