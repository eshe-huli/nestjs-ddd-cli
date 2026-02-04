import * as path from 'path';
import chalk from 'chalk';
import { getModulePath, prepareTemplateData, generateFromTemplate, fileExists, writeFile } from '../utils/file.utils';
import { toKebabCase, toPascalCase } from '../utils/naming.utils';

export async function generateEntity(entityName: string, options: any) {
  if (!options.module) {
    throw new Error('Module name is required. Use -m or --module option.');
  }

  console.log(chalk.blue(`  Generating entity: ${entityName}`));

  const basePath = options.path || process.cwd();
  const modulePath = getModulePath(basePath, options.module);
  const fieldsString = options.fields || '';
  const templateData = prepareTemplateData(entityName, options.module, fieldsString);

  // Generate domain entity
  const entityTemplatePath = path.join(__dirname, '../templates/entity/entity.hbs');
  const entityOutputPath = path.join(
    modulePath,
    'application/domain/entities',
    `${toKebabCase(entityName)}.entity.ts`
  );

  if (await fileExists(entityOutputPath)) {
    console.log(chalk.yellow(`    Entity ${entityName} already exists. Skipping...`));
  } else {
    await generateFromTemplate(entityTemplatePath, entityOutputPath, templateData);
    console.log(chalk.green(`    ✓ Domain entity`));
  }

  const orm = options.orm || 'typeorm';
  const isPrisma = orm === 'prisma';

  // Generate ORM entity if not skipped (TypeORM only - Prisma uses schema.prisma)
  if (!options.skipOrm && !isPrisma) {
    const ormTemplatePath = path.join(__dirname, '../templates/orm-entity/orm-entity.hbs');
    const ormOutputPath = path.join(
      modulePath,
      'infrastructure/orm-entities',
      `${toKebabCase(entityName)}.orm-entity.ts`
    );

    if (!(await fileExists(ormOutputPath))) {
      await generateFromTemplate(ormTemplatePath, ormOutputPath, templateData);
      console.log(chalk.green(`    ✓ ORM entity (TypeORM)`));
    }
  }

  // Generate mapper if not skipped
  if (!options.skipMapper) {
    const mapperTemplatePath = isPrisma
      ? path.join(__dirname, '../templates/prisma/prisma-mapper.hbs')
      : path.join(__dirname, '../templates/mapper/mapper.hbs');
    const mapperOutputPath = path.join(
      modulePath,
      'infrastructure/mappers',
      `${toKebabCase(entityName)}.mapper.ts`
    );

    if (!(await fileExists(mapperOutputPath))) {
      await generateFromTemplate(mapperTemplatePath, mapperOutputPath, templateData);
      console.log(chalk.green(`    ✓ Mapper (${isPrisma ? 'Prisma' : 'TypeORM'})`));
    }
  }

  // Generate repository if not skipped
  if (!options.skipRepo) {
    const repoTemplatePath = isPrisma
      ? path.join(__dirname, '../templates/prisma/prisma-repository.hbs')
      : path.join(__dirname, '../templates/repository/repository.hbs');
    const repoOutputPath = path.join(
      modulePath,
      'infrastructure/repositories',
      `${toKebabCase(entityName)}.repository.ts`
    );

    if (!(await fileExists(repoOutputPath))) {
      await generateFromTemplate(repoTemplatePath, repoOutputPath, templateData);
      console.log(chalk.green(`    ✓ Repository (${isPrisma ? 'Prisma' : 'TypeORM'})`));
    }
  }

  // Generate response DTO
  const responseDtoTemplatePath = path.join(__dirname, '../templates/dto/response-dto.hbs');
  const responseDtoOutputPath = path.join(
    modulePath,
    'application/dto/responses',
    `${toKebabCase(entityName)}.response.dto.ts`
  );

  if (!(await fileExists(responseDtoOutputPath))) {
    await generateFromTemplate(responseDtoTemplatePath, responseDtoOutputPath, templateData);
    console.log(chalk.green(`    ✓ Response DTO`));
  }

  // Update index files if this was called directly (not from generate-all)
  if (!options._fromGenerateAll) {
    await updateIndexFiles(modulePath, entityName, options);
  }
}

async function updateIndexFiles(modulePath: string, entityName: string, options: any) {
  const entityNameKebab = toKebabCase(entityName);
  const entityNamePascal = toPascalCase(entityName);

  // Entities index
  const entitiesIndexPath = path.join(modulePath, 'application/domain/entities/index.ts');
  const entitiesIndexContent = `export * from './${entityNameKebab}.entity';
`;
  await writeFile(entitiesIndexPath, entitiesIndexContent);

  if (!options.skipOrm) {
    // ORM entities index
    const ormIndexPath = path.join(modulePath, 'infrastructure/orm-entities/index.ts');
    const ormIndexContent = `export * from './${entityNameKebab}.orm-entity';

import { ${entityNamePascal}OrmEntity } from './${entityNameKebab}.orm-entity';

export const OrmEntities = [${entityNamePascal}OrmEntity];
`;
    await writeFile(ormIndexPath, ormIndexContent);
  }

  if (!options.skipMapper) {
    // Mappers index
    const mappersIndexPath = path.join(modulePath, 'infrastructure/mappers/index.ts');
    const mappersIndexContent = `export * from './${entityNameKebab}.mapper';

import { ${entityNamePascal}Mapper } from './${entityNameKebab}.mapper';

export const Mappers = [${entityNamePascal}Mapper];
`;
    await writeFile(mappersIndexPath, mappersIndexContent);
  }

  if (!options.skipRepo) {
    // Repositories index
    const reposIndexPath = path.join(modulePath, 'infrastructure/repositories/index.ts');
    const reposIndexContent = `export * from './${entityNameKebab}.repository';

import { ${entityNamePascal}Repository } from './${entityNameKebab}.repository';

export const Repositories = [${entityNamePascal}Repository];
`;
    await writeFile(reposIndexPath, reposIndexContent);
  }

  // Responses index
  const responsesIndexPath = path.join(modulePath, 'application/dto/responses/index.ts');
  const responsesIndexContent = `export * from './${entityNameKebab}.response.dto';
`;
  await writeFile(responsesIndexPath, responsesIndexContent);
}
