import * as path from 'path';
import chalk from 'chalk';
import {
  getModulePath,
  prepareConfiguredTemplateData,
  generateFromTemplate,
  updateBarrelFile,
} from '../utils/file.utils';
import { toKebabCase, toPascalCase } from '../utils/naming.utils';

export async function generateService(serviceName: string, options: any) {
  if (!options.module) {
    throw new Error('Module name is required. Use -m option to specify the module.');
  }

  const dryRun = !!options.dryRun;
  console.log(chalk.blue(`Generating domain service: ${serviceName}`));

  const basePath = options.path || process.cwd();
  const modulePath = getModulePath(basePath, options.module);

  // Generate domain service
  const templateData = await prepareConfiguredTemplateData(serviceName, options.module, {
    basePath,
    orm: options.orm,
  });
  const templatePath = path.join(__dirname, '../templates/service/domain-service.hbs');
  const outputPath = path.join(
    modulePath,
    'application/domain/services',
    `${toKebabCase(serviceName)}.service.ts`,
  );

  await generateFromTemplate(templatePath, outputPath, templateData, dryRun);
  await updateBarrelFile(path.join(modulePath, 'application/domain/services/index.ts'), {
    exports: [`export * from './${toKebabCase(serviceName)}.service';`],
    imports: [
      `import { ${toPascalCase(serviceName)}Service } from './${toKebabCase(serviceName)}.service';`,
    ],
    arrayName: 'Services',
    arrayItems: [`${toPascalCase(serviceName)}Service`],
    dryRun,
  });

  console.log(
    chalk.green(
      dryRun
        ? `Domain service ${serviceName} preview complete.`
        : `✅ Domain service ${serviceName} generated successfully!`,
    ),
  );
}
