import * as path from 'node:path';
import { applyStaticRecipePlan } from '../../utils/static-recipe.utils';

const files = [
  [
    'client.ts.hbs',
    'src/shared/auth/oauth2-token-introspection/oauth2-token-introspection.client.ts',
  ],
  [
    'client.spec.ts.hbs',
    'src/shared/auth/oauth2-token-introspection/oauth2-token-introspection.client.spec.ts',
  ],
  [
    'module.ts.hbs',
    'src/shared/auth/oauth2-token-introspection/oauth2-token-introspection.module.ts',
  ],
  ['index.ts.hbs', 'src/shared/auth/oauth2-token-introspection/index.ts'],
  ['http-client.ts.hbs', 'src/shared/auth/oauth2-token-introspection/bounded-json-http.client.ts'],
  [
    'http-client.spec.ts.hbs',
    'src/shared/auth/oauth2-token-introspection/bounded-json-http.client.spec.ts',
  ],
  ['README.md.hbs', 'docs/auth/oauth2-token-introspection.md'],
] as const;

export async function applyOAuth2TokenIntrospectionRecipe(
  basePath: string,
  dryRun = false,
): Promise<void> {
  const templateRoot = path.join(__dirname, '../../templates/recipes/oauth2-token-introspection');
  await applyStaticRecipePlan(
    basePath,
    files.map(([source, destination]) => ({
      template: path.join(templateRoot, source),
      destination,
    })),
    dryRun,
  );
}
