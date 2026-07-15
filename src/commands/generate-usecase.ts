import * as path from 'path';
import chalk from 'chalk';
import {
  getModulePath,
  prepareConfiguredTemplateData,
  generateFromTemplate,
} from '../utils/file.utils';
import { toKebabCase } from '../utils/naming.utils';

export async function generateUseCase(useCaseName: string, options: any) {
  if (!options.module) {
    throw new Error('Module name is required. Use -m or --module option.');
  }

  const dryRun = !!options.dryRun;
  console.log(chalk.blue(`Generating use case: ${useCaseName}`));

  const basePath = options.path || process.cwd();
  const modulePath = getModulePath(basePath, options.module);

  const templateData = await prepareConfiguredTemplateData(useCaseName, options.module, {
    basePath,
    orm: options.orm,
  });

  // Generate use case
  const useCaseTemplatePath = path.join(__dirname, '../templates/usecase/application-usecase.hbs');
  const useCaseOutputPath = path.join(
    modulePath,
    'application/domain/usecases',
    `${toKebabCase(useCaseName)}.use-case.ts`,
  );

  await generateFromTemplate(useCaseTemplatePath, useCaseOutputPath, templateData, dryRun);

  console.log(
    chalk.green(
      dryRun
        ? `Use case ${useCaseName} preview complete.`
        : `✅ Use case ${useCaseName} generated successfully!`,
    ),
  );
  console.log(
    chalk.yellow(`\n⚠️  Remember to export it from application/domain/usecases/index.ts`),
  );
}
