import * as path from 'node:path';
import { applyStaticRecipePlan } from '../../utils/static-recipe.utils';

export async function applyOAuth2ClientCredentialsRecipe(
  basePath: string,
  dryRun = false,
): Promise<void> {
  const root = path.join(__dirname, '../../templates/recipes');
  const own = 'src/shared/auth/oauth2-client-credentials';
  const transport = 'src/shared/auth/oauth2-token-introspection';
  const files = [
    ['oauth2-client-credentials/client.ts.hbs', own + '/oauth2-client-credentials.client.ts'],
    [
      'oauth2-client-credentials/client.spec.ts.hbs',
      own + '/oauth2-client-credentials.client.spec.ts',
    ],
    ['oauth2-client-credentials/module.ts.hbs', own + '/oauth2-client-credentials.module.ts'],
    ['oauth2-client-credentials/index.ts.hbs', own + '/index.ts'],
    ['oauth2-client-credentials/README.md.hbs', 'docs/auth/oauth2-client-credentials.md'],
    ['oauth2-token-introspection/http-client.ts.hbs', transport + '/bounded-json-http.client.ts'],
    [
      'oauth2-token-introspection/http-client.spec.ts.hbs',
      transport + '/bounded-json-http.client.spec.ts',
    ],
  ] as const;
  await applyStaticRecipePlan(
    basePath,
    files.map(([source, destination]) => ({ template: path.join(root, source), destination })),
    dryRun,
  );
}
