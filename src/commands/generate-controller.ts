import * as path from 'path';
import chalk from 'chalk';
import {
  generateFromTemplate,
  getModulePath,
  prepareConfiguredTemplateData,
  updateBarrelFile,
} from '../utils/file.utils';
import { toKebabCase, toPascalCase } from '../utils/naming.utils';

export async function generateController(controllerName: string, options: any) {
  if (!options.module) {
    throw new Error('Module name is required. Use -m or --module option.');
  }

  const dryRun = !!options.dryRun;
  console.log(chalk.blue(`Generating application controller: ${controllerName}`));

  const basePath = options.path || process.cwd();
  const modulePath = getModulePath(basePath, options.module);
  const templateData = await prepareConfiguredTemplateData(controllerName, options.module, {
    basePath,
    orm: options.orm,
  });
  const outputPath = path.join(
    modulePath,
    'application/controllers',
    `${toKebabCase(controllerName)}.controller.ts`,
  );

  await generateFromTemplate(
    path.join(__dirname, '../templates/controller/application-controller.hbs'),
    outputPath,
    templateData,
    dryRun,
  );
  await updateBarrelFile(path.join(modulePath, 'application/controllers/index.ts'), {
    exports: [`export * from './${toKebabCase(controllerName)}.controller';`],
    imports: [
      `import { ${toPascalCase(controllerName)}Controller } from './${toKebabCase(controllerName)}.controller';`,
    ],
    arrayName: 'Controllers',
    arrayItems: [`${toPascalCase(controllerName)}Controller`],
    dryRun,
  });

  console.log(
    chalk.green(
      dryRun
        ? `Application controller ${controllerName} preview complete.`
        : `✅ Application controller ${controllerName} generated successfully!`,
    ),
  );
}
