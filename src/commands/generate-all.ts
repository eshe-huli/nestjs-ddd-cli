import * as path from 'path';
import chalk from 'chalk';
import { generateModule } from './generate-module';
import { generateEntity } from './generate-entity';
import {
  getModulePath,
  prepareConfiguredTemplateData,
  generateFromTemplate,
  fileExists,
  writeGeneratedFile,
  updateBarrelFile,
  resetDryRunFiles,
  getDryRunFiles,
} from '../utils/file.utils';
import { toKebabCase, toPascalCase, toPlural } from '../utils/naming.utils';
import { installDependencies } from '../utils/dependency.utils';
import { loadConfig } from '../utils/config.utils';
import { resolveMigrationOutputPath } from './migration';

export async function generateAll(entityName: string, options: any) {
  console.log(chalk.blue(`\n🚀 Generating complete scaffolding for: ${entityName}`));

  const basePath = options.path || process.cwd();
  const config = await loadConfig(basePath);
  const orm = options.orm || config.orm || 'typeorm';
  const dryRun = !!options.dryRun;

  if (dryRun) {
    resetDryRunFiles();
    console.log(chalk.yellow('  Dry run: no files, directories, or dependencies will be written.'));
  }

  // Check if we need to install dependencies
  const requiredDeps = ['@nestjs/cqrs', 'class-validator', 'class-transformer', '@nestjs/swagger'];
  if (orm === 'prisma') {
    requiredDeps.push('@prisma/client', 'prisma');
  } else {
    requiredDeps.push('typeorm', '@nestjs/typeorm');
  }
  if (options.installDeps && !dryRun) {
    await installDependencies(options.path || process.cwd(), requiredDeps);
  } else if (options.installDeps && dryRun) {
    console.log(chalk.yellow(`  Dry run: would install dependencies: ${requiredDeps.join(', ')}`));
  }

  const moduleName = options.module || entityName;
  const modulePath = getModulePath(basePath, moduleName);
  const fieldsString = options.fields || '';

  // Check if module exists, create if not
  const moduleFilePath = path.join(modulePath, `${toKebabCase(moduleName)}.module.ts`);
  if (!(await fileExists(moduleFilePath))) {
    console.log(chalk.yellow(`  Module ${moduleName} doesn't exist. Creating...`));
    await generateModule(moduleName, { ...options, dryRun });
  }

  // Prepare template data with fields
  const templateData = await prepareConfiguredTemplateData(entityName, moduleName, {
    basePath,
    fieldsString,
    orm,
    features: {
      ...config.features,
      delete: options.delete === false ? false : config.features.delete,
    },
  });

  // Generate entity with all related files
  await generateEntity(entityName, {
    ...options,
    module: moduleName,
    fields: fieldsString,
    orm,
    dryRun,
    _fromGenerateAll: true,
  });

  // Generate PrismaService if using Prisma
  if (orm === 'prisma') {
    await generatePrismaService(basePath, dryRun);
  }

  // Generate CRUD commands
  console.log(chalk.cyan('  Generating commands...'));
  await generateCommand('create', entityName, modulePath, templateData, dryRun);
  await generateCommand('update', entityName, modulePath, templateData, dryRun);
  if (templateData.deleteEnabled) {
    await generateCommand('delete', entityName, modulePath, templateData, dryRun);
  }

  // Generate use cases
  console.log(chalk.cyan('  Generating use cases...'));
  await generateUseCase('create', entityName, modulePath, templateData, dryRun);
  await generateUseCase('update', entityName, modulePath, templateData, dryRun);
  if (templateData.deleteEnabled) {
    await generateUseCase('delete', entityName, modulePath, templateData, dryRun);
  }

  // Generate queries
  console.log(chalk.cyan('  Generating queries...'));
  await generateQueryHandler('get-by-id', entityName, modulePath, templateData, dryRun);
  await generateQueryHandler('get-all', entityName, modulePath, templateData, dryRun);

  // Generate DTOs
  console.log(chalk.cyan('  Generating DTOs...'));
  await generateDto('create', entityName, modulePath, templateData, dryRun);
  await generateDto('update', entityName, modulePath, templateData, dryRun);
  await generateDto('response', entityName, modulePath, templateData, dryRun);
  await generatePaginationDtos(modulePath, templateData, dryRun);

  // Generate controller
  console.log(chalk.cyan('  Generating controller...'));
  const controllerTemplatePath = path.join(__dirname, '../templates/controller/controller.hbs');
  const controllerOutputPath = path.join(
    modulePath,
    'application/controllers',
    `${toKebabCase(entityName)}.controller.ts`,
  );
  await generateFromTemplate(controllerTemplatePath, controllerOutputPath, templateData, dryRun);

  // Generate migration file or Prisma schema snippet
  if (orm === 'prisma') {
    console.log(chalk.cyan('  Generating Prisma schema snippet...'));
    await generatePrismaSchemaSnippet(entityName, basePath, templateData, dryRun);
  } else {
    console.log(chalk.cyan('  Generating migration...'));
    await generateMigration(entityName, basePath, templateData, dryRun);
  }

  // Generate barrel exports
  console.log(chalk.cyan('  Generating barrel exports...'));
  await generateBarrelExports(entityName, modulePath, orm, dryRun, templateData.deleteEnabled);

  // Generate tests if requested
  if (options.withTests) {
    console.log(chalk.cyan('  Generating tests...'));
    await generateTests(entityName, modulePath, templateData, dryRun);
  }

  // Generate GraphQL files if requested
  if (options.withGraphql) {
    console.log(chalk.cyan('  Generating GraphQL resolvers and types...'));
    await generateGraphQL(entityName, modulePath, templateData, dryRun);
  }

  if (dryRun) {
    printDryRunSummary(basePath);
    return;
  }

  console.log(chalk.green(`\n✅ Complete scaffolding generated successfully!`));
  console.log(chalk.cyan(`\n📁 Generated structure:`));
  console.log(`   ${chalk.white('Module:')} ${modulePath}`);
  console.log(`   ${chalk.white('Entity:')} ${entityName}`);
  console.log(`   ${chalk.white('ORM:')} ${orm === 'prisma' ? 'Prisma' : 'TypeORM'}`);
  console.log(
    `   ${chalk.white('Commands:')} Create, Update${templateData.deleteEnabled ? ', Delete' : ''}`,
  );
  console.log(`   ${chalk.white('Queries:')} GetById, GetAll (paginated)`);
  console.log(
    `   ${chalk.white('Use Cases:')} Create, Update${templateData.deleteEnabled ? ', Delete' : ''}`,
  );
  console.log(`   ${chalk.white('DTOs:')} Create, Update, Response, Pagination`);
  console.log(
    `   ${chalk.white('Controller:')} ${templateData.deleteEnabled ? 'Full CRUD' : 'Create, read, and update'} REST endpoints`,
  );
  console.log(`   ${chalk.white('Repository:')} With pagination support`);
  console.log(
    `   ${chalk.white('Mapper:')} Domain ↔ ${orm === 'prisma' ? 'Prisma' : 'ORM'} ↔ Response`,
  );
  if (options.withGraphql) {
    console.log(`   ${chalk.white('GraphQL:')} Resolver, Types, Inputs`);
  }

  if (templateData.hasFields) {
    console.log(
      chalk.green(`\n✨ Fields generated: ${templateData.fields?.map((f) => f.name).join(', ')}`),
    );
  }

  console.log(chalk.yellow(`\n📋 Next steps:`));
  console.log(
    `   1. ${templateData.hasFields ? 'Review' : 'Add properties to'} your entity and DTOs`,
  );
  if (orm === 'prisma') {
    console.log(`   2. Add the generated model to your ${chalk.cyan('prisma/schema.prisma')}`);
    console.log(
      `   3. Run: ${chalk.cyan('npx prisma migrate dev --name add_' + toKebabCase(entityName))}`,
    );
    console.log(`   4. Run: ${chalk.cyan('npx prisma generate')}`);
  } else {
    console.log(`   2. Run the migration: ${chalk.cyan('npm run migration:run')}`);
  }
  console.log(
    `   ${orm === 'prisma' ? '5' : '3'}. Import ${toPascalCase(moduleName)}Module in your app.module.ts`,
  );
  console.log(
    `   ${orm === 'prisma' ? '6' : '4'}. Start your server and test the API at ${chalk.cyan(`/${templateData.entityNamePluralKebab}`)}`,
  );
}

function printDryRunSummary(basePath: string): void {
  const changes = getDryRunFiles();

  console.log(chalk.cyan(`\n🧪 Dry run complete. Planned file changes (${changes.length}):`));

  if (!changes.length) {
    console.log(chalk.gray('   No file changes planned.'));
    return;
  }

  for (const change of changes) {
    const relativePath = path.relative(basePath, change.filePath);
    console.log(`   ${change.action.padEnd(6)} ${relativePath}`);
  }
}

async function generateCommand(
  action: 'create' | 'update' | 'delete',
  entityName: string,
  modulePath: string,
  templateData: any,
  dryRun = false,
) {
  const templatePath = path.join(__dirname, `../templates/command/${action}-command.hbs`);
  const outputPath = path.join(
    modulePath,
    'application/commands',
    `${action}-${toKebabCase(entityName)}.command.ts`,
  );
  await generateFromTemplate(templatePath, outputPath, templateData, dryRun);
}

async function generateUseCase(
  action: 'create' | 'update' | 'delete',
  entityName: string,
  modulePath: string,
  templateData: any,
  dryRun = false,
) {
  const templatePath = path.join(__dirname, `../templates/usecase/${action}-usecase.hbs`);
  const outputPath = path.join(
    modulePath,
    'application/domain/usecases',
    `${action}-${toKebabCase(entityName)}.use-case.ts`,
  );
  await generateFromTemplate(templatePath, outputPath, templateData, dryRun);
}

async function generateQueryHandler(
  type: 'get-by-id' | 'get-all',
  entityName: string,
  modulePath: string,
  templateData: any,
  dryRun = false,
) {
  const fileName =
    type === 'get-all'
      ? `get-all-${templateData.entityNamePluralKebab}.query.ts`
      : `get-${toKebabCase(entityName)}-by-id.query.ts`;
  const templatePath = path.join(__dirname, `../templates/query/${type}.query.hbs`);
  const outputPath = path.join(modulePath, 'application/queries', fileName);
  await generateFromTemplate(templatePath, outputPath, templateData, dryRun);
}

async function generateDto(
  type: 'create' | 'update' | 'response',
  entityName: string,
  modulePath: string,
  templateData: any,
  dryRun = false,
) {
  const templateMap: Record<string, string> = {
    create: 'create-dto.hbs',
    update: 'update-dto.hbs',
    response: 'response-dto.hbs',
  };

  const outputDirMap: Record<string, string> = {
    create: 'requests',
    update: 'requests',
    response: 'responses',
  };

  const fileNameMap: Record<string, string> = {
    create: `create-${toKebabCase(entityName)}.dto.ts`,
    update: `update-${toKebabCase(entityName)}.dto.ts`,
    response: `${toKebabCase(entityName)}.response.dto.ts`,
  };

  const templatePath = path.join(__dirname, `../templates/dto/${templateMap[type]}`);
  const outputPath = path.join(
    modulePath,
    `application/dto/${outputDirMap[type]}`,
    fileNameMap[type]!,
  );
  await generateFromTemplate(templatePath, outputPath, templateData, dryRun);
}

async function generatePaginationDtos(modulePath: string, templateData: any, dryRun = false) {
  // Generate pagination query DTO
  const paginationQueryTemplatePath = path.join(
    __dirname,
    '../templates/dto/pagination-query.dto.hbs',
  );
  const paginationQueryOutputPath = path.join(
    modulePath,
    'application/dto/requests',
    'pagination.query.dto.ts',
  );

  if (!(await fileExists(paginationQueryOutputPath))) {
    await generateFromTemplate(
      paginationQueryTemplatePath,
      paginationQueryOutputPath,
      templateData,
      dryRun,
    );
  }

  // Generate paginated response DTO
  const paginatedResponseTemplatePath = path.join(
    __dirname,
    '../templates/dto/paginated-response.dto.hbs',
  );
  const paginatedResponseOutputPath = path.join(
    modulePath,
    'application/dto/responses',
    'paginated.response.dto.ts',
  );

  if (!(await fileExists(paginatedResponseOutputPath))) {
    await generateFromTemplate(
      paginatedResponseTemplatePath,
      paginatedResponseOutputPath,
      templateData,
      dryRun,
    );
  }
}

async function generateMigration(
  entityName: string,
  basePath: string,
  templateData: any,
  dryRun = false,
) {
  const timestamp = Date.now();
  const tableName = templateData.tableName;
  const migrationName = `create_${tableName}_table`;
  const fileName = `${timestamp}-${migrationName}.ts`;

  const fieldsColumns =
    templateData.migrationColumns ||
    `          // Add your custom columns here
          // Example:
          // {
          //   name: "name",
          //   type: "varchar",
          //   isNullable: false,
          // },`;
  const softDeleteColumn = templateData.softDelete
    ? `          {
            name: "deleted_at",
            type: "timestamp",
            isNullable: true,
          },`
    : '';

  const content = `import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class Create${toPascalCase(entityName)}Table${timestamp} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "${tableName}",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
${fieldsColumns}
          {
            name: "is_active",
            type: "boolean",
            default: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
${softDeleteColumn}
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("${tableName}");
  }
}
`;

  const config = await loadConfig(basePath);
  const migrationsDir = resolveMigrationOutputPath(
    basePath,
    config.paths.migrations,
    'src/migrations',
  );
  const migrationPath = path.join(migrationsDir, fileName);
  await writeGeneratedFile(migrationPath, content, dryRun);
  console.log(chalk.green(`   ✓ Migration: ${fileName}`));
}

async function generateBarrelExports(
  entityName: string,
  modulePath: string,
  orm: string = 'typeorm',
  dryRun = false,
  deleteEnabled = true,
) {
  const entityNameKebab = toKebabCase(entityName);
  const entityNamePascal = toPascalCase(entityName);
  const entityNamePluralKebab = toKebabCase(toPlural(entityName));
  const entityNamePluralPascal = toPlural(toPascalCase(entityName));
  const isPrisma = orm === 'prisma';

  // Commands index
  const commandsIndexPath = path.join(modulePath, 'application/commands/index.ts');
  await updateBarrelFile(commandsIndexPath, {
    exports: [
      `export * from './create-${entityNameKebab}.command';`,
      `export * from './update-${entityNameKebab}.command';`,
      ...(deleteEnabled ? [`export * from './delete-${entityNameKebab}.command';`] : []),
    ],
    imports: [
      `import { Create${entityNamePascal}Handler } from './create-${entityNameKebab}.command';`,
      `import { Update${entityNamePascal}Handler } from './update-${entityNameKebab}.command';`,
      ...(deleteEnabled
        ? [`import { Delete${entityNamePascal}Handler } from './delete-${entityNameKebab}.command';`]
        : []),
    ],
    arrayName: 'CommandHandlers',
    arrayItems: [
      `Create${entityNamePascal}Handler`,
      `Update${entityNamePascal}Handler`,
      ...(deleteEnabled ? [`Delete${entityNamePascal}Handler`] : []),
    ],
    dryRun,
  });

  // Queries index
  const queriesIndexPath = path.join(modulePath, 'application/queries/index.ts');
  await updateBarrelFile(queriesIndexPath, {
    exports: [
      `export * from './get-${entityNameKebab}-by-id.query';`,
      `export * from './get-all-${entityNamePluralKebab}.query';`,
    ],
    imports: [
      `import { Get${entityNamePascal}ByIdHandler } from './get-${entityNameKebab}-by-id.query';`,
      `import { GetAll${entityNamePluralPascal}Handler } from './get-all-${entityNamePluralKebab}.query';`,
    ],
    arrayName: 'Queries',
    arrayItems: [`Get${entityNamePascal}ByIdHandler`, `GetAll${entityNamePluralPascal}Handler`],
    dryRun,
  });

  // Use cases index
  const useCasesIndexPath = path.join(modulePath, 'application/domain/usecases/index.ts');
  await updateBarrelFile(useCasesIndexPath, {
    exports: [
      `export * from './create-${entityNameKebab}.use-case';`,
      `export * from './update-${entityNameKebab}.use-case';`,
      ...(deleteEnabled ? [`export * from './delete-${entityNameKebab}.use-case';`] : []),
    ],
    imports: [
      `import { Create${entityNamePascal}UseCase } from './create-${entityNameKebab}.use-case';`,
      `import { Update${entityNamePascal}UseCase } from './update-${entityNameKebab}.use-case';`,
      ...(deleteEnabled
        ? [`import { Delete${entityNamePascal}UseCase } from './delete-${entityNameKebab}.use-case';`]
        : []),
    ],
    arrayName: 'UseCases',
    arrayItems: [
      `Create${entityNamePascal}UseCase`,
      `Update${entityNamePascal}UseCase`,
      ...(deleteEnabled ? [`Delete${entityNamePascal}UseCase`] : []),
    ],
    dryRun,
  });

  // DTOs index
  const dtosIndexPath = path.join(modulePath, 'application/dto/index.ts');
  await updateBarrelFile(dtosIndexPath, {
    exports: [`export * from './requests';`, `export * from './responses';`],
    dryRun,
  });

  // Requests index
  const requestsIndexPath = path.join(modulePath, 'application/dto/requests/index.ts');
  await updateBarrelFile(requestsIndexPath, {
    exports: [
      `export * from './create-${entityNameKebab}.dto';`,
      `export * from './update-${entityNameKebab}.dto';`,
      `export * from './pagination.query.dto';`,
    ],
    dryRun,
  });

  // Responses index
  const responsesIndexPath = path.join(modulePath, 'application/dto/responses/index.ts');
  await updateBarrelFile(responsesIndexPath, {
    exports: [
      `export * from './${entityNameKebab}.response.dto';`,
      `export * from './paginated.response.dto';`,
    ],
    dryRun,
  });

  // Controllers index
  const controllersIndexPath = path.join(modulePath, 'application/controllers/index.ts');
  await updateBarrelFile(controllersIndexPath, {
    exports: [`export * from './${entityNameKebab}.controller';`],
    imports: [`import { ${entityNamePascal}Controller } from './${entityNameKebab}.controller';`],
    arrayName: 'Controllers',
    arrayItems: [`${entityNamePascal}Controller`],
    dryRun,
  });

  // Entities index
  const entitiesIndexPath = path.join(modulePath, 'application/domain/entities/index.ts');
  await updateBarrelFile(entitiesIndexPath, {
    exports: [`export * from './${entityNameKebab}.entity';`],
    dryRun,
  });

  // Repositories index
  const repositoriesIndexPath = path.join(modulePath, 'infrastructure/repositories/index.ts');
  await updateBarrelFile(repositoriesIndexPath, {
    exports: [`export * from './${entityNameKebab}.repository';`],
    imports: [`import { ${entityNamePascal}Repository } from './${entityNameKebab}.repository';`],
    arrayName: 'Repositories',
    arrayItems: [`${entityNamePascal}Repository`],
    dryRun,
  });

  // Mappers index
  const mappersIndexPath = path.join(modulePath, 'infrastructure/mappers/index.ts');
  await updateBarrelFile(mappersIndexPath, {
    exports: [`export * from './${entityNameKebab}.mapper';`],
    imports: [`import { ${entityNamePascal}Mapper } from './${entityNameKebab}.mapper';`],
    arrayName: 'Mappers',
    arrayItems: [`${entityNamePascal}Mapper`],
    dryRun,
  });

  // ORM entities index (TypeORM only)
  if (!isPrisma) {
    const ormEntitiesIndexPath = path.join(modulePath, 'infrastructure/orm-entities/index.ts');
    await updateBarrelFile(ormEntitiesIndexPath, {
      exports: [`export * from './${entityNameKebab}.orm-entity';`],
      imports: [`import { ${entityNamePascal}OrmEntity } from './${entityNameKebab}.orm-entity';`],
      arrayName: 'OrmEntities',
      arrayItems: [`${entityNamePascal}OrmEntity`],
      dryRun,
    });
  }
}

async function generateTests(
  entityName: string,
  modulePath: string,
  templateData: any,
  dryRun = false,
) {
  const entityNameKebab = toKebabCase(entityName);

  // Repository test
  const repoTestTemplatePath = templateData.isPrisma
    ? path.join(__dirname, '../templates/test/prisma-repository.spec.hbs')
    : path.join(__dirname, '../templates/test/repository.spec.hbs');
  const repoTestOutputPath = path.join(
    modulePath,
    'infrastructure/repositories',
    `${entityNameKebab}.repository.spec.ts`,
  );
  await generateFromTemplate(repoTestTemplatePath, repoTestOutputPath, templateData, dryRun);
  console.log(chalk.green(`   ✓ Repository test`));

  // Use case tests
  const useCaseTestTemplatePath = path.join(__dirname, '../templates/test/usecase.spec.hbs');
  const useCaseTestOutputPath = path.join(
    modulePath,
    'application/domain/usecases',
    `${entityNameKebab}.use-case.spec.ts`,
  );
  await generateFromTemplate(useCaseTestTemplatePath, useCaseTestOutputPath, templateData, dryRun);
  console.log(chalk.green(`   ✓ Use case tests`));

  // Controller test
  const controllerTestTemplatePath = path.join(__dirname, '../templates/test/controller.spec.hbs');
  const controllerTestOutputPath = path.join(
    modulePath,
    'application/controllers',
    `${entityNameKebab}.controller.spec.ts`,
  );
  await generateFromTemplate(
    controllerTestTemplatePath,
    controllerTestOutputPath,
    templateData,
    dryRun,
  );
  console.log(chalk.green(`   ✓ Controller test`));
}

async function generateGraphQL(
  entityName: string,
  modulePath: string,
  templateData: any,
  dryRun = false,
) {
  const entityNameKebab = toKebabCase(entityName);
  const entityNamePascal = toPascalCase(entityName);

  // Create GraphQL directories
  const graphqlPath = path.join(modulePath, 'application/graphql');
  const typesPath = path.join(graphqlPath, 'types');
  const inputsPath = path.join(graphqlPath, 'inputs');
  const argsPath = path.join(graphqlPath, 'args');

  // Generate resolver
  const resolverTemplatePath = path.join(__dirname, '../templates/resolver/resolver.hbs');
  const resolverOutputPath = path.join(graphqlPath, `${entityNameKebab}.resolver.ts`);
  await generateFromTemplate(resolverTemplatePath, resolverOutputPath, templateData, dryRun);
  console.log(chalk.green(`   ✓ Resolver`));

  // Generate GraphQL type
  const typeTemplatePath = path.join(__dirname, '../templates/resolver/graphql-type.hbs');
  const typeOutputPath = path.join(typesPath, `${entityNameKebab}.type.ts`);
  await generateFromTemplate(typeTemplatePath, typeOutputPath, templateData, dryRun);
  console.log(chalk.green(`   ✓ GraphQL Type`));

  // Generate GraphQL inputs
  const inputTemplatePath = path.join(__dirname, '../templates/resolver/graphql-input.hbs');
  const inputOutputPath = path.join(inputsPath, `${entityNameKebab}.input.ts`);
  await generateFromTemplate(inputTemplatePath, inputOutputPath, templateData, dryRun);
  console.log(chalk.green(`   ✓ GraphQL Inputs`));

  // Generate pagination args (if not exists)
  const paginationArgsPath = path.join(argsPath, 'pagination.args.ts');
  if (!(await fileExists(paginationArgsPath))) {
    const paginationArgsTemplatePath = path.join(
      __dirname,
      '../templates/resolver/pagination-args.hbs',
    );
    await generateFromTemplate(
      paginationArgsTemplatePath,
      paginationArgsPath,
      templateData,
      dryRun,
    );
    console.log(chalk.green(`   ✓ Pagination Args`));
  }

  // Generate barrel exports
  const typesIndexContent = `export * from "./${entityNameKebab}.type";
`;
  await writeGeneratedFile(path.join(typesPath, 'index.ts'), typesIndexContent, dryRun);

  const inputsIndexContent = `export * from "./${entityNameKebab}.input";
`;
  await writeGeneratedFile(path.join(inputsPath, 'index.ts'), inputsIndexContent, dryRun);

  const argsIndexContent = `export * from "./pagination.args";
`;
  await writeGeneratedFile(path.join(argsPath, 'index.ts'), argsIndexContent, dryRun);

  const graphqlIndexContent = `export * from "./${entityNameKebab}.resolver";
export * from "./types";
export * from "./inputs";
export * from "./args";

import { ${entityNamePascal}Resolver } from "./${entityNameKebab}.resolver";

export const Resolvers = [${entityNamePascal}Resolver];
`;
  await writeGeneratedFile(path.join(graphqlPath, 'index.ts'), graphqlIndexContent, dryRun);
}

async function generatePrismaService(basePath: string, dryRun = false) {
  const prismaServicePath = path.join(basePath, 'src/prisma/prisma.service.ts');

  if (await fileExists(prismaServicePath)) {
    console.log(chalk.yellow(`   PrismaService already exists. Skipping...`));
    return;
  }

  const content = `import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Execute operations in a transaction
   */
  async executeInTransaction<T>(
    fn: (prisma: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use">) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(fn);
  }

  /**
   * Clean database (useful for testing)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("cleanDatabase can only be called in test environment");
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => typeof key === "string" && !key.startsWith("_") && !key.startsWith("$"),
    );

    for (const model of models) {
      try {
        await (this as any)[model].deleteMany();
      } catch (error) {
        // Ignore if model doesn't support deleteMany
      }
    }
  }
}
`;

  await writeGeneratedFile(prismaServicePath, content, dryRun);
  console.log(chalk.green(`   ✓ PrismaService`));

  // Also generate prisma.module.ts
  const prismaModulePath = path.join(basePath, 'src/prisma/prisma.module.ts');
  if (!(await fileExists(prismaModulePath))) {
    const moduleContent = `import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
`;
    await writeGeneratedFile(prismaModulePath, moduleContent, dryRun);
    console.log(chalk.green(`   ✓ PrismaModule`));
  }

  // Generate index.ts
  const indexPath = path.join(basePath, 'src/prisma/index.ts');
  if (!(await fileExists(indexPath))) {
    const indexContent = `export * from "./prisma.service";
export * from "./prisma.module";
`;
    await writeGeneratedFile(indexPath, indexContent, dryRun);
  }
}

async function generatePrismaSchemaSnippet(
  entityName: string,
  basePath: string,
  templateData: any,
  dryRun = false,
) {
  const tableName = templateData.tableName;
  const entityNamePascal = toPascalCase(entityName);

  // Generate fields for Prisma schema
  let fieldsContent = '';
  if (templateData.fields && templateData.fields.length > 0) {
    fieldsContent = templateData.fields
      .map((f: any) => {
        let line = `  ${f.snakeCase.padEnd(20)} ${f.prismaType}`;
        if (f.isOptional) line += '?';
        if (f.isUnique) line += ' @unique';
        return line;
      })
      .join('\n');
  } else {
    fieldsContent = `  // Add your fields here
  // name                 String
  // email                String    @unique`;
  }

  const content = `// =============================================================
// Prisma Schema Snippet for ${entityNamePascal}
// Add this to your prisma/schema.prisma file
// =============================================================

model ${entityNamePascal} {
  id                   String    @id @default(uuid())
${fieldsContent}
  is_active            Boolean   @default(true)
  created_at           DateTime  @default(now())
  updated_at           DateTime  @updatedAt
${templateData.softDelete ? '  deleted_at           DateTime?' : ''}

  @@map("${tableName}")
}

// =============================================================
// After adding, run:
//   npx prisma migrate dev --name add_${toKebabCase(entityName)}
//   npx prisma generate
// =============================================================
`;

  const snippetPath = path.join(basePath, `prisma/snippets/${toKebabCase(entityName)}.prisma`);
  await writeGeneratedFile(snippetPath, content, dryRun);
  console.log(
    chalk.green(`   ✓ Prisma schema snippet: prisma/snippets/${toKebabCase(entityName)}.prisma`),
  );
}
