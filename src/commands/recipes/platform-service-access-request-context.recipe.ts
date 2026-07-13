import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, fileExists, readTemplate, writeFile } from '../../utils/file.utils';
import { applyPlatformContextRecipe } from './platform-context.recipe';

interface RecipeTemplate {
  source: string;
  target: string;
}

const recipeTemplates: readonly RecipeTemplate[] = [
  {
    source: 'service-access-request-context.config.ts.hbs',
    target:
      'src/shared/auth/platform-service-access-request-context/service-access-request-context.config.ts',
  },
  {
    source: 'request-context-introspection.types.ts.hbs',
    target:
      'src/shared/auth/platform-service-access-request-context/request-context-introspection.types.ts',
  },
  {
    source: 'request-context-introspection.parser.ts.hbs',
    target:
      'src/shared/auth/platform-service-access-request-context/request-context-introspection.parser.ts',
  },
  {
    source: 'request-context-headers.ts.hbs',
    target: 'src/shared/auth/platform-service-access-request-context/request-context-headers.ts',
  },
  {
    source: 'service-access-request-context.client.ts.hbs',
    target:
      'src/shared/auth/platform-service-access-request-context/service-access-request-context.client.ts',
  },
  {
    source: 'service-access-request-context.guard.ts.hbs',
    target:
      'src/shared/auth/platform-service-access-request-context/service-access-request-context.guard.ts',
  },
  {
    source: 'service-access-request-context.module.ts.hbs',
    target:
      'src/shared/auth/platform-service-access-request-context/service-access-request-context.module.ts',
  },
  {
    source: 'index.ts.hbs',
    target: 'src/shared/auth/platform-service-access-request-context/index.ts',
  },
  {
    source: 'docs.md.hbs',
    target: 'docs/platform/platform-service-access-request-context.md',
  },
];

export async function applyPlatformServiceAccessRequestContextRecipe(
  basePath: string,
): Promise<void> {
  await applyPlatformContextRecipe(basePath);

  const templatePath = path.join(
    __dirname,
    '../../templates/recipes/platform-service-access-request-context',
  );

  for (const template of recipeTemplates) {
    const content = await readTemplate(path.join(templatePath, template.source));
    await writeFile(path.join(basePath, template.target), content);
  }

  const envExamplePath = path.join(basePath, '.env.example');
  const fallbackExamplePath = path.join(
    basePath,
    '.env.platform-service-access-request-context.example',
  );
  const targetExamplePath = (await fileExists(envExamplePath))
    ? fallbackExamplePath
    : envExamplePath;
  const envContent = await readTemplate(path.join(templatePath, 'env.example.hbs'));
  await ensureDir(path.dirname(targetExamplePath));
  await writeFile(targetExamplePath, envContent);

  console.log(chalk.green('  ✓ Platform request context contract'));
  console.log(chalk.green('  ✓ Service Access lease introspection client and guard'));
  console.log(chalk.green('  ✓ Strict active-response, audience, and principal parsing'));
  console.log(chalk.green('  ✓ Disabled, shadow, and enforce rollout modes'));
  console.log(
    chalk.yellow(
      '  Run this guard before route-specific PARC authorization; caller identity headers are never authority.',
    ),
  );
}
