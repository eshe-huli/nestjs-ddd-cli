import * as path from 'node:path';
import { applyStaticRecipePlan } from '../../utils/static-recipe.utils';

/** Raw HTTP evidence transport; consumers retain origin and domain authority. */
export async function applyBoundedBinaryHttpRecipe(
  basePath: string,
  dryRun = false,
): Promise<void> {
  const templateRoot = path.join(__dirname, '../../templates/recipes/bounded-binary-http');
  await applyStaticRecipePlan(
    basePath,
    [
      {
        template: path.join(templateRoot, 'client.ts.hbs'),
        destination: 'src/shared/http/bounded-binary-http.client.ts',
      },
      {
        template: path.join(templateRoot, 'README.md.hbs'),
        destination: 'docs/http/bounded-binary-http.md',
      },
    ],
    dryRun,
  );
}
