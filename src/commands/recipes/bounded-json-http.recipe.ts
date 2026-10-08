import * as path from 'node:path';
import { applyStaticRecipePlan } from '../../utils/static-recipe.utils';

/** Emit the shared transport alone for consumers that do not use NestJS. */
export async function applyBoundedJsonHttpRecipe(basePath: string, dryRun = false): Promise<void> {
  const templateRoot = path.join(__dirname, '../../templates/recipes');
  await applyStaticRecipePlan(
    basePath,
    [
      {
        template: path.join(templateRoot, 'oauth2-token-introspection/http-client.ts.hbs'),
        destination: 'src/shared/auth/oauth2-token-introspection/bounded-json-http.client.ts',
      },
      {
        template: path.join(templateRoot, 'bounded-json-http/README.md.hbs'),
        destination: 'docs/auth/bounded-json-http.md',
      },
    ],
    dryRun,
  );
}
