import * as path from 'path';
import chalk from 'chalk';
import { getModulePath, prepareTemplateData, generateFromTemplate } from '../utils/file.utils';
import { toKebabCase } from '../utils/naming.utils';

export async function generateQuery(queryName: string, options: any) {
  if (!options.module) {
    throw new Error('Module name is required. Use -m option to specify the module.');
  }

  console.log(chalk.blue(`Generating query handler: ${queryName}`));
  
  const basePath = options.path || process.cwd();
  const modulePath = getModulePath(basePath, options.module);
  
  // Generate query handler
  const templateData = prepareTemplateData(queryName, options.module);
  const templatePath = path.join(__dirname, '../templates/query/query-handler.hbs');
  const outputPath = path.join(
    modulePath,
    'application/queries',
    `${toKebabCase(queryName)}.handler.ts`
  );
  
  await generateFromTemplate(templatePath, outputPath, templateData);
  
  console.log(chalk.green(`✅ Query handler ${queryName} generated successfully!`));
}