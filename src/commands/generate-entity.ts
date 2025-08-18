import * as path from 'path';
import chalk from 'chalk';
import { getModulePath, prepareTemplateData, generateFromTemplate, fileExists } from '../utils/file.utils';
import { toKebabCase } from '../utils/naming.utils';

export async function generateEntity(entityName: string, options: any) {
  if (!options.module) {
    throw new Error('Module name is required. Use -m or --module option.');
  }
  
  console.log(chalk.blue(`Generating entity: ${entityName}`));
  
  const basePath = options.path || process.cwd();
  const modulePath = getModulePath(basePath, options.module);
  const templateData = prepareTemplateData(entityName, options.module);
  
  // Generate domain entity
  const entityTemplatePath = path.join(__dirname, '../templates/entity/entity.hbs');
  const entityOutputPath = path.join(
    modulePath,
    'domain/entities',
    `${toKebabCase(entityName)}.entity.ts`
  );
  
  if (await fileExists(entityOutputPath)) {
    console.log(chalk.yellow(`Entity ${entityName} already exists. Skipping...`));
    return;
  }
  
  await generateFromTemplate(entityTemplatePath, entityOutputPath, templateData);
  
  // Generate ORM entity if not skipped
  if (!options.skipOrm) {
    const ormTemplatePath = path.join(__dirname, '../templates/orm-entity/orm-entity.hbs');
    const ormOutputPath = path.join(
      modulePath,
      'infrastructure/orm-entities',
      `${toKebabCase(entityName)}.orm-entity.ts`
    );
    
    await generateFromTemplate(ormTemplatePath, ormOutputPath, templateData);
  }
  
  // Generate mapper if not skipped
  if (!options.skipMapper) {
    const mapperTemplatePath = path.join(__dirname, '../templates/mapper/mapper.hbs');
    const mapperOutputPath = path.join(
      modulePath,
      'infrastructure/mappers',
      `${toKebabCase(entityName)}.mapper.ts`
    );
    
    await generateFromTemplate(mapperTemplatePath, mapperOutputPath, templateData);
  }
  
  // Generate repository if not skipped
  if (!options.skipRepo) {
    const repoTemplatePath = path.join(__dirname, '../templates/repository/repository.hbs');
    const repoOutputPath = path.join(
      modulePath,
      'infrastructure/repositories',
      `${toKebabCase(entityName)}.repository.ts`
    );
    
    await generateFromTemplate(repoTemplatePath, repoOutputPath, templateData);
  }
  
  // Update index files
  await updateIndexFiles(modulePath, entityName, options);
  
  console.log(chalk.green(`✅ Entity ${entityName} generated successfully!`));
}

async function updateIndexFiles(_modulePath: string, _entityName: string, options: any) {
  // This would update the index.ts files to include the new exports
  // For now, we'll just log a reminder
  console.log(chalk.yellow(`\n⚠️  Remember to update the following index files:`));
  console.log(`   - domain/entities/index.ts`);
  if (!options.skipOrm) {
    console.log(`   - infrastructure/orm-entities/index.ts`);
  }
  if (!options.skipMapper) {
    console.log(`   - infrastructure/mappers/index.ts`);
  }
  if (!options.skipRepo) {
    console.log(`   - infrastructure/repositories/index.ts`);
  }
}