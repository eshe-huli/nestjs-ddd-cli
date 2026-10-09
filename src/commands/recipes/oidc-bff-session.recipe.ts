import * as path from 'node:path';
import { applyStaticRecipePlan } from '../../utils/static-recipe.utils';
import { loadConfig } from '../../utils/config.utils';

const files = [
  ['client.ts.hbs', 'src/shared/oidc-bff/oidc-bff.client.ts'],
  ['client.test.ts.hbs', 'src/shared/oidc-bff/oidc-bff.client.test.ts'],
  ['store.ts.hbs', 'src/shared/oidc-bff/opaque-session-store.ts'],
  ['record-encryption.ts.hbs', 'src/shared/oidc-bff/session-record-encryption.ts'],
  ['store.test.ts.hbs', 'src/shared/oidc-bff/opaque-session-store.test.ts'],
  ['store.integration.test.ts.hbs', 'src/shared/oidc-bff/opaque-session-store.integration.test.ts'],
  ['valkey.ts.hbs', 'src/shared/oidc-bff/valkey-session-store.ts'],
  ['valkey.test.ts.hbs', 'src/shared/oidc-bff/valkey-session-store.test.ts'],
  ['index.ts.hbs', 'src/shared/oidc-bff/index.ts'],
  ['README.md.hbs', 'docs/auth/oidc-bff-session.md'],
] as const;

export async function applyOidcBffSessionRecipe(basePath: string, dryRun = false): Promise<void> {
  const templateRoot = path.join(__dirname, '../../templates/recipes/oidc-bff-session');
  const config = await loadConfig(basePath);
  await applyStaticRecipePlan(
    basePath,
    files.filter(([source]) => config.features.tests || !source.includes('.test.')).map(([source, destination]) => ({
      template: path.join(templateRoot, source),
      destination,
    })),
    dryRun,
  );
}
