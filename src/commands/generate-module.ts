import * as path from 'path';
import chalk from 'chalk';
import { getModulePath, prepareTemplateData, generateFromTemplate, ensureDir } from '../utils/file.utils';
import { toKebabCase } from '../utils/naming.utils';

export async function generateModule(moduleName: string, options: any) {
  console.log(chalk.blue(`Generating module: ${moduleName}`));
  
  const basePath = options.path || process.cwd();
  const modulePath = getModulePath(basePath, moduleName);
  
  // Create module directory structure
  await ensureDir(path.join(modulePath, 'application/commands'));
  await ensureDir(path.join(modulePath, 'application/controllers'));
  await ensureDir(path.join(modulePath, 'application/domain/entities'));
  await ensureDir(path.join(modulePath, 'application/domain/events'));
  await ensureDir(path.join(modulePath, 'application/domain/services'));
  await ensureDir(path.join(modulePath, 'application/domain/usecases'));
  await ensureDir(path.join(modulePath, 'application/dto/requests'));
  await ensureDir(path.join(modulePath, 'application/dto/responses'));
  await ensureDir(path.join(modulePath, 'application/queries'));
  await ensureDir(path.join(modulePath, 'infrastructure/mappers'));
  await ensureDir(path.join(modulePath, 'infrastructure/orm-entities'));
  await ensureDir(path.join(modulePath, 'infrastructure/repositories'));
  
  // Generate module file
  const templateData = prepareTemplateData(moduleName, moduleName);
  const templatePath = path.join(__dirname, '../templates/module/module.hbs');
  const outputPath = path.join(modulePath, `${toKebabCase(moduleName)}.module.ts`);
  
  await generateFromTemplate(templatePath, outputPath, templateData);
  
  // Create empty index files
  const indexPaths = [
    'application/commands/index.ts',
    'application/controllers/index.ts',
    'application/domain/entities/index.ts',
    'application/domain/events/index.ts',
    'application/domain/services/index.ts',
    'application/domain/usecases/index.ts',
    'application/dto/requests/index.ts',
    'application/dto/responses/index.ts',
    'application/queries/index.ts',
    'infrastructure/mappers/index.ts',
    'infrastructure/orm-entities/index.ts',
    'infrastructure/repositories/index.ts',
  ];
  
  for (const indexPath of indexPaths) {
    const arrayName = getArrayNameFromPath(indexPath);
    await generateIndexFile(path.join(modulePath, indexPath), arrayName);
  }
  
  console.log(chalk.green(`✅ Module ${moduleName} generated successfully!`));
}

function getArrayNameFromPath(indexPath: string): string {
  const parts = indexPath.split('/');
  const lastPart = parts[parts.length - 2];
  
  const mapping: Record<string, string> = {
    'commands': 'CommandHandlers',
    'controllers': 'Controllers',
    'entities': 'Entities',
    'events': 'Events',
    'services': 'Services',
    'usecases': 'UseCases',
    'requests': 'Requests',
    'responses': 'Responses',
    'queries': 'Queries',
    'mappers': 'Mappers',
    'orm-entities': 'OrmEntities',
    'repositories': 'Repositories',
  };
  
  return (lastPart && mapping[lastPart]) || 'Exports';
}

async function generateIndexFile(filePath: string, arrayName: string) {
  const content = `export const ${arrayName} = [];\n`;
  await ensureDir(path.dirname(filePath));
  await require('../utils/file.utils').writeFile(filePath, content);
}