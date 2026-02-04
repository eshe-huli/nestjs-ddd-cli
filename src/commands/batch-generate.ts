import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as yaml from 'yaml';
import { generateAll } from './generate-all';
import { generateModule } from './generate-module';
import { txn, withTransaction } from '../utils/rollback.utils';

export interface BatchGenerateOptions {
  path?: string;
  dryRun?: boolean;
  continueOnError?: boolean;
  installDeps?: boolean;
}

interface BatchSchema {
  version: string;
  project?: {
    name: string;
    orm: 'typeorm' | 'prisma';
    database: string;
  };
  modules: BatchModule[];
  relations?: BatchRelation[];
}

interface BatchModule {
  name: string;
  entities: BatchEntity[];
  shared?: boolean;
}

interface BatchEntity {
  name: string;
  fields: string[] | Record<string, string>;
  options?: {
    withTests?: boolean;
    withGraphql?: boolean;
    withEvents?: boolean;
    withQueries?: boolean;
  };
}

interface BatchRelation {
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  field?: string;
}

interface GenerationPlan {
  steps: GenerationStep[];
  totalEntities: number;
  totalModules: number;
  estimatedFiles: number;
}

interface GenerationStep {
  order: number;
  type: 'module' | 'entity';
  name: string;
  module: string;
  config: any;
  dependencies: string[];
}

export async function batchGenerate(schemaPath: string, options: BatchGenerateOptions = {}): Promise<void> {
  console.log(chalk.bold.blue('\n📦 Batch Generation\n'));

  const basePath = options.path || process.cwd();
  const absoluteSchemaPath = path.isAbsolute(schemaPath) ? schemaPath : path.join(basePath, schemaPath);

  if (!fs.existsSync(absoluteSchemaPath)) {
    console.log(chalk.red(`❌ Schema file not found: ${schemaPath}`));
    return;
  }

  // Parse schema
  const schema = parseSchema(absoluteSchemaPath);

  if (!schema) {
    console.log(chalk.red('❌ Failed to parse schema file'));
    return;
  }

  // Validate schema
  const validation = validateSchema(schema);
  if (!validation.valid) {
    console.log(chalk.red('❌ Schema validation failed:'));
    validation.errors.forEach(e => console.log(chalk.red(`  • ${e}`)));
    return;
  }

  // Build generation plan
  const plan = buildGenerationPlan(schema);

  console.log(chalk.cyan('Generation Plan:'));
  console.log(`  Modules: ${plan.totalModules}`);
  console.log(`  Entities: ${plan.totalEntities}`);
  console.log(`  Estimated files: ~${plan.estimatedFiles}`);

  if (options.dryRun) {
    console.log(chalk.yellow('\n🔍 Dry Run - No files will be created\n'));
    printPlan(plan);
    return;
  }

  // Execute generation
  console.log(chalk.cyan('\n🚀 Starting generation...\n'));

  txn.enable();

  try {
    await withTransaction('batch-generation', async () => {
      let completed = 0;

      for (const step of plan.steps) {
        try {
          await executeStep(step, basePath, options);
          completed++;
          const progress = Math.round((completed / plan.steps.length) * 100);
          console.log(chalk.gray(`  Progress: ${progress}%`));
        } catch (error) {
          if (!options.continueOnError) {
            throw error;
          }
          console.log(chalk.yellow(`  ⚠️ Skipped: ${step.name} (${(error as Error).message})`));
        }
      }
    });

    console.log(chalk.green(`\n✅ Batch generation completed!`));
    console.log(chalk.gray(`  Created ${plan.totalModules} modules with ${plan.totalEntities} entities`));

  } catch (error) {
    console.log(chalk.red(`\n❌ Generation failed: ${(error as Error).message}`));
    console.log(chalk.yellow('  Changes have been rolled back'));
  }
}

function parseSchema(filePath: string): BatchSchema | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.yaml' || ext === '.yml') {
      return yaml.parse(content);
    } else if (ext === '.json') {
      return JSON.parse(content);
    } else {
      // Try YAML first, then JSON
      try {
        return yaml.parse(content);
      } catch {
        return JSON.parse(content);
      }
    }
  } catch (error) {
    console.log(chalk.red(`Parse error: ${(error as Error).message}`));
    return null;
  }
}

function validateSchema(schema: BatchSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!schema.version) {
    errors.push('Missing version field');
  }

  if (!schema.modules || !Array.isArray(schema.modules)) {
    errors.push('Missing or invalid modules array');
  } else {
    for (const module of schema.modules) {
      if (!module.name) {
        errors.push('Module missing name');
      }
      if (!module.entities || !Array.isArray(module.entities)) {
        errors.push(`Module "${module.name}" missing entities array`);
      } else {
        for (const entity of module.entities) {
          if (!entity.name) {
            errors.push(`Entity in module "${module.name}" missing name`);
          }
          if (!entity.fields) {
            errors.push(`Entity "${entity.name}" missing fields`);
          }
        }
      }
    }
  }

  // Validate relations
  if (schema.relations) {
    const entityNames = new Set<string>();
    for (const module of schema.modules || []) {
      for (const entity of module.entities || []) {
        entityNames.add(`${module.name}.${entity.name}`);
        entityNames.add(entity.name);
      }
    }

    for (const relation of schema.relations) {
      if (!entityNames.has(relation.from) && !entityNames.has(relation.from.split('.').pop()!)) {
        errors.push(`Relation references unknown entity: ${relation.from}`);
      }
      if (!entityNames.has(relation.to) && !entityNames.has(relation.to.split('.').pop()!)) {
        errors.push(`Relation references unknown entity: ${relation.to}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function buildGenerationPlan(schema: BatchSchema): GenerationPlan {
  const steps: GenerationStep[] = [];
  let order = 0;

  // First, create all modules
  for (const module of schema.modules) {
    steps.push({
      order: order++,
      type: 'module',
      name: module.name,
      module: module.name,
      config: { shared: module.shared },
      dependencies: [],
    });
  }

  // Then create entities (respecting relation dependencies)
  const entityDeps = buildEntityDependencies(schema);

  for (const module of schema.modules) {
    for (const entity of module.entities) {
      const entityKey = `${module.name}.${entity.name}`;
      const deps = entityDeps.get(entityKey) || [];

      steps.push({
        order: order++,
        type: 'entity',
        name: entity.name,
        module: module.name,
        config: {
          fields: normalizeFields(entity.fields),
          ...entity.options,
        },
        dependencies: deps,
      });
    }
  }

  // Sort by dependencies (topological sort)
  const sorted = topologicalSort(steps);

  return {
    steps: sorted,
    totalModules: schema.modules.length,
    totalEntities: schema.modules.reduce((sum, m) => sum + m.entities.length, 0),
    estimatedFiles: schema.modules.reduce((sum, m) => sum + m.entities.length * 8, 0),
  };
}

function buildEntityDependencies(schema: BatchSchema): Map<string, string[]> {
  const deps = new Map<string, string[]>();

  if (!schema.relations) return deps;

  for (const relation of schema.relations) {
    // The "from" entity depends on "to" entity for foreign key
    if (relation.type === 'many-to-one' || relation.type === 'one-to-one') {
      const existing = deps.get(relation.from) || [];
      existing.push(relation.to);
      deps.set(relation.from, existing);
    }
  }

  return deps;
}

function normalizeFields(fields: string[] | Record<string, string>): string {
  if (Array.isArray(fields)) {
    return fields.join(' ');
  }

  return Object.entries(fields)
    .map(([name, type]) => `${name}:${type}`)
    .join(' ');
}

function topologicalSort(steps: GenerationStep[]): GenerationStep[] {
  const sorted: GenerationStep[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(step: GenerationStep) {
    const key = `${step.type}:${step.module}.${step.name}`;

    if (visiting.has(key)) {
      // Circular dependency - just continue
      return;
    }

    if (visited.has(key)) return;

    visiting.add(key);

    // Visit dependencies first
    for (const dep of step.dependencies) {
      const depStep = steps.find(s =>
        s.type === 'entity' &&
        (s.name === dep || `${s.module}.${s.name}` === dep)
      );
      if (depStep) {
        visit(depStep);
      }
    }

    visiting.delete(key);
    visited.add(key);
    sorted.push(step);
  }

  // First add all modules
  for (const step of steps.filter(s => s.type === 'module')) {
    visit(step);
  }

  // Then add entities
  for (const step of steps.filter(s => s.type === 'entity')) {
    visit(step);
  }

  return sorted;
}

async function executeStep(step: GenerationStep, basePath: string, options: BatchGenerateOptions): Promise<void> {
  if (step.type === 'module') {
    console.log(chalk.cyan(`  📁 Creating module: ${step.name}`));
    await generateModule(step.name, { path: basePath });
  } else {
    console.log(chalk.cyan(`  📄 Creating entity: ${step.module}/${step.name}`));
    await generateAll(step.name, {
      path: basePath,
      module: step.module,
      fields: step.config.fields,
      withTests: step.config.withTests,
      withGraphql: step.config.withGraphql,
      withEvents: step.config.withEvents,
      withQueries: step.config.withQueries,
      installDeps: options.installDeps,
    });
  }
}

function printPlan(plan: GenerationPlan): void {
  console.log(chalk.bold('Generation Steps:\n'));

  let currentModule = '';

  for (const step of plan.steps) {
    if (step.type === 'module') {
      currentModule = step.name;
      console.log(chalk.cyan(`📁 Module: ${step.name}`));
    } else {
      console.log(chalk.gray(`  📄 ${step.name}`));
      if (step.dependencies.length > 0) {
        console.log(chalk.gray(`     depends on: ${step.dependencies.join(', ')}`));
      }
    }
  }
}

export async function createBatchSchema(outputPath: string, options: { path?: string } = {}): Promise<void> {
  const basePath = options.path || process.cwd();
  const fullPath = path.join(basePath, outputPath);

  const sampleSchema: BatchSchema = {
    version: '1.0',
    project: {
      name: 'my-project',
      orm: 'typeorm',
      database: 'postgres',
    },
    modules: [
      {
        name: 'users',
        entities: [
          {
            name: 'User',
            fields: {
              'email': 'string:unique',
              'password': 'string',
              'firstName': 'string:optional',
              'lastName': 'string:optional',
              'isActive': 'boolean',
            },
            options: {
              withTests: true,
              withGraphql: false,
            },
          },
          {
            name: 'Profile',
            fields: ['bio:text:optional', 'avatarUrl:string:optional', 'website:string:optional'],
          },
        ],
      },
      {
        name: 'posts',
        entities: [
          {
            name: 'Post',
            fields: {
              'title': 'string',
              'content': 'text',
              'publishedAt': 'Date:optional',
              'status': 'string',
            },
            options: {
              withEvents: true,
            },
          },
          {
            name: 'Comment',
            fields: ['content:text', 'authorName:string'],
          },
        ],
      },
    ],
    relations: [
      {
        from: 'users.Profile',
        to: 'users.User',
        type: 'one-to-one',
        field: 'user',
      },
      {
        from: 'posts.Post',
        to: 'users.User',
        type: 'many-to-one',
        field: 'author',
      },
      {
        from: 'posts.Comment',
        to: 'posts.Post',
        type: 'many-to-one',
        field: 'post',
      },
    ],
  };

  const ext = path.extname(outputPath).toLowerCase();
  let content: string;

  if (ext === '.json') {
    content = JSON.stringify(sampleSchema, null, 2);
  } else {
    content = yaml.stringify(sampleSchema);
  }

  fs.writeFileSync(fullPath, content);
  console.log(chalk.green(`✅ Created batch schema: ${outputPath}`));
  console.log(chalk.gray(`\nRun with: ddd batch ${outputPath}`));
}
