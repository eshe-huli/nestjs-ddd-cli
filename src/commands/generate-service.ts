import * as path from 'path';
import chalk from 'chalk';
import { getModulePath, prepareTemplateData, generateFromTemplate } from '../utils/file.utils';
import { toKebabCase } from '../utils/naming.utils';

export async function generateService(serviceName: string, options: any) {
  if (!options.module) {
    throw new Error('Module name is required. Use -m option to specify the module.');
  }

  console.log(chalk.blue(`Generating domain service: ${serviceName}`));
  
  const basePath = options.path || process.cwd();
  const modulePath = getModulePath(basePath, options.module);
  
  // Generate domain service
  const templateData = prepareTemplateData(serviceName, options.module);
  const templatePath = path.join(__dirname, '../templates/service/domain-service.hbs');
  const outputPath = path.join(
    modulePath,
    'application/domain/services',
    `${toKebabCase(serviceName)}.service.ts`
  );
  
  await generateFromTemplate(templatePath, outputPath, templateData);
  
  console.log(chalk.green(`✅ Domain service ${serviceName} generated successfully!`));
}