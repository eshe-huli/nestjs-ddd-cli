import * as path from 'path';
import chalk from 'chalk';
import {
  generateFromTemplate,
  getModulePath,
  prepareTemplateData,
  updateBarrelFile,
} from '../utils/file.utils';
import { toKebabCase, toPascalCase } from '../utils/naming.utils';

export async function generateQuery(queryName: string, options: any) {
  if (!options.module) {
    throw new Error('Module name is required. Use -m option to specify the module.');
  }

  const dryRun = !!options.dryRun;
  const normalizedQueryName = queryName.replace(/[-_\s]?query$/i, '');
  if (!normalizedQueryName) {
    throw new Error('Query name must include an operation name.');
  }
  console.log(chalk.blue(`Generating query handler: ${queryName}`));

  const basePath = options.path || process.cwd();
  const modulePath = getModulePath(basePath, options.module);

  // Generate query handler
  const templateData = prepareTemplateData(normalizedQueryName, options.module);
  const templatePath = path.join(__dirname, '../templates/query/query-handler.hbs');
  const outputPath = path.join(
    modulePath,
    'application/queries',
    `${toKebabCase(normalizedQueryName)}.handler.ts`,
  );

  await generateFromTemplate(templatePath, outputPath, templateData, dryRun);
  await updateBarrelFile(path.join(modulePath, 'application/queries/index.ts'), {
    exports: [`export * from './${toKebabCase(normalizedQueryName)}.handler';`],
    imports: [
      `import { ${toPascalCase(normalizedQueryName)}Handler } from './${toKebabCase(normalizedQueryName)}.handler';`,
    ],
    arrayName: 'Queries',
    arrayItems: [`${toPascalCase(normalizedQueryName)}Handler`],
    dryRun,
  });

  console.log(
    chalk.green(
      dryRun
        ? `Query handler ${queryName} preview complete.`
        : `✅ Query handler ${queryName} generated successfully!`,
    ),
  );
}
