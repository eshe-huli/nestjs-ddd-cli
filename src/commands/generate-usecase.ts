import * as path from 'path';
import chalk from 'chalk';
import { getModulePath, prepareTemplateData, generateFromTemplate } from '../utils/file.utils';
import { toKebabCase, toPascalCase } from '../utils/naming.utils';

export async function generateUseCase(useCaseName: string, options: any) {
  if (!options.module) {
    throw new Error('Module name is required. Use -m or --module option.');
  }
  
  console.log(chalk.blue(`Generating use case: ${useCaseName}`));
  
  const basePath = options.path || process.cwd();
  const modulePath = getModulePath(basePath, options.module);
  
  // Extract entity name from use case name (e.g., CreateUser -> User)
  const entityName = extractEntityName(useCaseName);
  const templateData = prepareTemplateData(entityName, options.module);
  
  // Generate use case
  const useCaseTemplatePath = path.join(__dirname, '../templates/usecase/create-usecase.hbs');
  const useCaseOutputPath = path.join(
    modulePath,
    'application/domain/usecases',
    `${toKebabCase(useCaseName)}.use-case.ts`
  );
  
  await generateFromTemplate(useCaseTemplatePath, useCaseOutputPath, templateData);
  
  // Generate command
  const commandTemplatePath = path.join(__dirname, '../templates/command/create-command.hbs');
  const commandOutputPath = path.join(
    modulePath,
    'application/commands',
    `${toKebabCase(useCaseName)}.command.ts`
  );
  
  await generateFromTemplate(commandTemplatePath, commandOutputPath, templateData);
  
  // Generate DTO
  const dtoTemplatePath = path.join(__dirname, '../templates/dto/create-dto.hbs');
  const dtoOutputPath = path.join(
    modulePath,
    'application/dto/requests',
    `${toKebabCase(useCaseName)}.dto.ts`
  );
  
  await generateFromTemplate(dtoTemplatePath, dtoOutputPath, templateData);
  
  console.log(chalk.green(`✅ Use case ${useCaseName} generated successfully!`));
  console.log(chalk.yellow(`\n⚠️  Remember to update the following index files:`));
  console.log(`   - application/domain/usecases/index.ts`);
  console.log(`   - application/commands/index.ts`);
  console.log(`   - application/dto/requests/index.ts`);
}

function extractEntityName(useCaseName: string): string {
  // Remove common prefixes
  const prefixes = ['Create', 'Update', 'Delete', 'Get', 'Find', 'List'];
  let entityName = useCaseName;
  
  for (const prefix of prefixes) {
    if (useCaseName.startsWith(prefix)) {
      entityName = useCaseName.substring(prefix.length);
      break;
    }
  }
  
  return entityName;
}