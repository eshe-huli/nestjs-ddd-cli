import * as path from 'node:path';
import { applyStaticRecipePlan } from '../../utils/static-recipe.utils';

export async function applyPlatformParcBoundAuthorizationRecipe(
  basePath: string,
  dryRun = false,
): Promise<void> {
  const root = path.join(__dirname, '../../templates/recipes');
  await applyStaticRecipePlan(
    basePath,
    [
      {
        template: path.join(root, 'oauth2-token-introspection/http-client.ts.hbs'),
        destination: 'src/shared/auth/oauth2-token-introspection/bounded-json-http.client.ts',
      },
      {
        template: path.join(root, 'platform-parc-bound-authorization/client.ts.hbs'),
        destination:
          'src/shared/authorization/platform-parc-bound-authorization/parc-bound.client.ts',
      },
      {
        template: path.join(root, 'platform-parc-bound-authorization/README.md.hbs'),
        destination: 'docs/platform/parc-bound-authorization.md',
      },
    ],
    dryRun,
  );
}
