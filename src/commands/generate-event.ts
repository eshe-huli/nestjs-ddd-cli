import * as path from 'path';
import chalk from 'chalk';
import { getModulePath, prepareTemplateData, generateFromTemplate } from '../utils/file.utils';
import { toKebabCase } from '../utils/naming.utils';

export async function generateEvent(eventName: string, options: any) {
  if (!options.module) {
    throw new Error('Module name is required. Use -m option to specify the module.');
  }

  console.log(chalk.blue(`Generating domain event: ${eventName}`));
  
  const basePath = options.path || process.cwd();
  const modulePath = getModulePath(basePath, options.module);
  
  // Generate domain event
  const templateData = prepareTemplateData(eventName, options.module);
  const templatePath = path.join(__dirname, '../templates/event/domain-event.hbs');
  const outputPath = path.join(
    modulePath,
    'domain/events',
    `${toKebabCase(eventName)}.event.ts`
  );
  
  await generateFromTemplate(templatePath, outputPath, templateData);
  
  console.log(chalk.green(`✅ Domain event ${eventName} generated successfully!`));
}