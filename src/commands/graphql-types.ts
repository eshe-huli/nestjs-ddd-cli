import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../utils/file.utils';

export interface GraphQLTypesOptions {
  module?: string;
  output?: string;
}

interface EntityField {
  name: string;
  type: string;
  nullable: boolean;
  isArray: boolean;
  isRelation: boolean;
  description?: string;
}

interface EntityDefinition {
  name: string;
  fields: EntityField[];
  relations: Array<{
    name: string;
    type: string;
    relationType: 'ManyToOne' | 'OneToMany' | 'OneToOne' | 'ManyToMany';
  }>;
}

export async function generateGraphQLTypes(basePath: string, options: GraphQLTypesOptions = {}): Promise<void> {
  console.log(chalk.bold.blue('\n🔷 Generating GraphQL Types...\n'));

  const modulesPath = path.join(basePath, 'src/modules');

  if (!fs.existsSync(modulesPath)) {
    console.log(chalk.red('❌ No modules directory found.'));
    return;
  }

  const modules = options.module
    ? [options.module]
    : fs.readdirSync(modulesPath).filter(f =>
        fs.statSync(path.join(modulesPath, f)).isDirectory()
      );

  for (const moduleName of modules) {
    const modulePath = path.join(modulesPath, moduleName);

    if (!fs.existsSync(modulePath)) {
      console.log(chalk.yellow(`⚠️  Module "${moduleName}" not found.`));
      continue;
    }

    await generateModuleGraphQLTypes(modulePath, moduleName);
  }
}

async function generateModuleGraphQLTypes(modulePath: string, moduleName: string): Promise<void> {
  // Find entity files
  const entityFiles = findFiles(modulePath, '.entity.ts');

  if (entityFiles.length === 0) {
    console.log(chalk.gray(`  No entities found in ${moduleName}`));
    return;
  }

  const graphqlPath = path.join(modulePath, 'presentation/graphql');
  await ensureDir(graphqlPath);

  console.log(chalk.cyan(`\n📦 Module: ${moduleName}`));

  for (const entityFile of entityFiles) {
    const entity = parseEntity(entityFile);
    if (!entity) continue;

    // Generate Object Type
    const objectType = generateObjectType(entity);
    await writeFile(
      path.join(graphqlPath, `${toKebabCase(entity.name)}.type.ts`),
      objectType
    );
    console.log(chalk.green(`  ✓ ${entity.name}Type`));

    // Generate Input Types (Create, Update)
    const createInput = generateCreateInput(entity);
    await writeFile(
      path.join(graphqlPath, `create-${toKebabCase(entity.name)}.input.ts`),
      createInput
    );
    console.log(chalk.green(`  ✓ Create${entity.name}Input`));

    const updateInput = generateUpdateInput(entity);
    await writeFile(
      path.join(graphqlPath, `update-${toKebabCase(entity.name)}.input.ts`),
      updateInput
    );
    console.log(chalk.green(`  ✓ Update${entity.name}Input`));

    // Generate Filter Input
    const filterInput = generateFilterInput(entity);
    await writeFile(
      path.join(graphqlPath, `${toKebabCase(entity.name)}-filter.input.ts`),
      filterInput
    );
    console.log(chalk.green(`  ✓ ${entity.name}FilterInput`));

    // Generate Pagination Types
    const paginationType = generatePaginationType(entity);
    await writeFile(
      path.join(graphqlPath, `${toKebabCase(entity.name)}-pagination.type.ts`),
      paginationType
    );
    console.log(chalk.green(`  ✓ ${entity.name}PaginatedResponse`));
  }

  // Generate index file
  const indexContent = generateIndexFile(entityFiles.map(f => {
    const entity = parseEntity(f);
    return entity?.name || '';
  }).filter(Boolean));

  await writeFile(path.join(graphqlPath, 'index.ts'), indexContent);
}

function parseEntity(filePath: string): EntityDefinition | null {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Extract class name
  const classMatch = content.match(/export\s+class\s+(\w+)/);
  if (!classMatch) return null;

  const name = classMatch[1].replace(/Entity$/, '');
  const fields: EntityField[] = [];
  const relations: EntityDefinition['relations'] = [];

  // Parse Column fields
  const columnRegex = /@Column\s*\(([^)]*)\)\s*(\w+)(?:\?)?:\s*(\w+)(?:\[\])?/g;
  let match;

  while ((match = columnRegex.exec(content)) !== null) {
    const options = match[1];
    const fieldName = match[2];
    const fieldType = match[3];

    // Skip internal fields
    if (['createdAt', 'updatedAt', 'deletedAt', 'version'].includes(fieldName)) continue;

    fields.push({
      name: fieldName,
      type: mapTsToGraphQL(fieldType),
      nullable: options.includes('nullable: true') || content.includes(`${fieldName}?:`),
      isArray: content.includes(`${fieldName}: ${fieldType}[]`) || content.includes(`${fieldName}?: ${fieldType}[]`),
      isRelation: false,
    });
  }

  // Parse PrimaryGeneratedColumn
  if (content.includes('@PrimaryGeneratedColumn')) {
    fields.unshift({
      name: 'id',
      type: 'ID',
      nullable: false,
      isArray: false,
      isRelation: false,
    });
  }

  // Parse relations
  const relationTypes = ['ManyToOne', 'OneToMany', 'OneToOne', 'ManyToMany'];
  for (const relType of relationTypes) {
    const relRegex = new RegExp(`@${relType}\\s*\\([^)]*\\)[\\s\\S]*?(\\w+):\\s*(\\w+)`, 'g');
    while ((match = relRegex.exec(content)) !== null) {
      const relName = match[1];
      const relTargetType = match[2].replace(/\[\]$/, '');

      relations.push({
        name: relName,
        type: relTargetType,
        relationType: relType as any,
      });

      fields.push({
        name: relName,
        type: relTargetType,
        nullable: relType !== 'ManyToOne',
        isArray: ['OneToMany', 'ManyToMany'].includes(relType),
        isRelation: true,
      });
    }
  }

  // Add timestamps
  fields.push(
    { name: 'createdAt', type: 'DateTime', nullable: false, isArray: false, isRelation: false },
    { name: 'updatedAt', type: 'DateTime', nullable: false, isArray: false, isRelation: false }
  );

  return { name, fields, relations };
}

function generateObjectType(entity: EntityDefinition): string {
  const fields = entity.fields
    .map(f => {
      const nullable = f.nullable ? '{ nullable: true }' : '';
      const returnType = f.isArray ? `[${f.type}]` : f.type;
      return `  @Field(() => ${returnType}${nullable ? `, ${nullable}` : ''})
  ${f.name}${f.nullable ? '?' : ''}: ${mapGraphQLToTs(f.type)}${f.isArray ? '[]' : ''};`;
    })
    .join('\n\n');

  return `import { ObjectType, Field, ID } from "@nestjs/graphql";

@ObjectType()
export class ${entity.name}Type {
${fields}
}
`;
}

function generateCreateInput(entity: EntityDefinition): string {
  const fields = entity.fields
    .filter(f => !['id', 'createdAt', 'updatedAt'].includes(f.name) && !f.isRelation)
    .map(f => {
      const nullable = f.nullable ? '{ nullable: true }' : '';
      const validators = generateValidators(f);
      return `${validators}  @Field(${nullable ? `() => ${mapToGraphQLScalar(f.type)}, ${nullable}` : ''})
  ${f.name}${f.nullable ? '?' : ''}: ${mapGraphQLToTs(f.type)}${f.isArray ? '[]' : ''};`;
    })
    .join('\n\n');

  // Add relation IDs
  const relationFields = entity.relations
    .filter(r => r.relationType === 'ManyToOne')
    .map(r => {
      return `  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  ${r.name}Id?: string;`;
    })
    .join('\n\n');

  return `import { InputType, Field, ID } from "@nestjs/graphql";
import { IsString, IsNumber, IsBoolean, IsOptional, IsUUID, IsNotEmpty } from "class-validator";

@InputType()
export class Create${entity.name}Input {
${fields}
${relationFields ? '\n' + relationFields : ''}
}
`;
}

function generateUpdateInput(entity: EntityDefinition): string {
  const fields = entity.fields
    .filter(f => !['id', 'createdAt', 'updatedAt'].includes(f.name) && !f.isRelation)
    .map(f => {
      const validators = generateValidators(f, true);
      return `${validators}  @Field(() => ${mapToGraphQLScalar(f.type)}, { nullable: true })
  ${f.name}?: ${mapGraphQLToTs(f.type)}${f.isArray ? '[]' : ''};`;
    })
    .join('\n\n');

  // Add relation IDs
  const relationFields = entity.relations
    .filter(r => r.relationType === 'ManyToOne')
    .map(r => {
      return `  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  ${r.name}Id?: string;`;
    })
    .join('\n\n');

  return `import { InputType, Field, ID, PartialType } from "@nestjs/graphql";
import { IsString, IsNumber, IsBoolean, IsOptional, IsUUID } from "class-validator";
import { Create${entity.name}Input } from "./create-${toKebabCase(entity.name)}.input";

@InputType()
export class Update${entity.name}Input extends PartialType(Create${entity.name}Input) {
  @Field(() => ID)
  @IsUUID()
  id: string;
}
`;
}

function generateFilterInput(entity: EntityDefinition): string {
  const filterFields = entity.fields
    .filter(f => !f.isRelation && !['createdAt', 'updatedAt'].includes(f.name))
    .map(f => {
      if (f.type === 'String' || f.type === 'ID') {
        return `  @Field(() => String, { nullable: true })
  ${f.name}?: string;

  @Field(() => String, { nullable: true })
  ${f.name}Contains?: string;`;
      } else if (f.type === 'Int' || f.type === 'Float') {
        return `  @Field(() => ${f.type}, { nullable: true })
  ${f.name}?: number;

  @Field(() => ${f.type}, { nullable: true })
  ${f.name}Gte?: number;

  @Field(() => ${f.type}, { nullable: true })
  ${f.name}Lte?: number;`;
      } else if (f.type === 'Boolean') {
        return `  @Field(() => Boolean, { nullable: true })
  ${f.name}?: boolean;`;
      } else if (f.type === 'DateTime') {
        return `  @Field(() => Date, { nullable: true })
  ${f.name}After?: Date;

  @Field(() => Date, { nullable: true })
  ${f.name}Before?: Date;`;
      }
      return `  @Field(() => ${mapToGraphQLScalar(f.type)}, { nullable: true })
  ${f.name}?: ${mapGraphQLToTs(f.type)};`;
    })
    .join('\n\n');

  return `import { InputType, Field, Int, Float } from "@nestjs/graphql";

@InputType()
export class ${entity.name}FilterInput {
${filterFields}

  @Field(() => Int, { nullable: true })
  page?: number;

  @Field(() => Int, { nullable: true })
  limit?: number;

  @Field(() => String, { nullable: true })
  sortBy?: string;

  @Field(() => String, { nullable: true })
  sortOrder?: 'ASC' | 'DESC';
}
`;
}

function generatePaginationType(entity: EntityDefinition): string {
  return `import { ObjectType, Field, Int } from "@nestjs/graphql";
import { ${entity.name}Type } from "./${toKebabCase(entity.name)}.type";

@ObjectType()
export class ${entity.name}PaginatedResponse {
  @Field(() => [${entity.name}Type])
  items: ${entity.name}Type[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;
}
`;
}

function generateIndexFile(entityNames: string[]): string {
  const exports = entityNames.flatMap(name => {
    const kebab = toKebabCase(name);
    return [
      `export * from "./${kebab}.type";`,
      `export * from "./create-${kebab}.input";`,
      `export * from "./update-${kebab}.input";`,
      `export * from "./${kebab}-filter.input";`,
      `export * from "./${kebab}-pagination.type";`,
    ];
  });

  return exports.join('\n') + '\n';
}

function generateValidators(field: EntityField, optional: boolean = false): string {
  const validators: string[] = [];

  if (optional || field.nullable) {
    validators.push('  @IsOptional()');
  } else {
    validators.push('  @IsNotEmpty()');
  }

  switch (field.type) {
    case 'String':
      validators.push('  @IsString()');
      break;
    case 'Int':
    case 'Float':
      validators.push('  @IsNumber()');
      break;
    case 'Boolean':
      validators.push('  @IsBoolean()');
      break;
    case 'ID':
      validators.push('  @IsUUID()');
      break;
  }

  return validators.join('\n') + '\n';
}

function mapTsToGraphQL(tsType: string): string {
  const map: Record<string, string> = {
    'string': 'String',
    'number': 'Int',
    'boolean': 'Boolean',
    'Date': 'DateTime',
    'bigint': 'Int',
    'float': 'Float',
  };
  return map[tsType] || 'String';
}

function mapGraphQLToTs(gqlType: string): string {
  const map: Record<string, string> = {
    'String': 'string',
    'Int': 'number',
    'Float': 'number',
    'Boolean': 'boolean',
    'DateTime': 'Date',
    'ID': 'string',
  };
  return map[gqlType] || 'any';
}

function mapToGraphQLScalar(gqlType: string): string {
  if (['String', 'Int', 'Float', 'Boolean', 'ID'].includes(gqlType)) {
    return gqlType;
  }
  if (gqlType === 'DateTime') {
    return 'Date';
  }
  return 'String';
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function findFiles(dir: string, extension: string): string[] {
  const files: string[] = [];

  function scan(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.name.endsWith(extension)) {
        files.push(fullPath);
      }
    }
  }

  scan(dir);
  return files;
}
