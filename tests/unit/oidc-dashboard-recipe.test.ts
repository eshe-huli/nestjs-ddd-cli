import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { applyOidcDashboardRecipe } from '../../src/commands/recipes/oidc-dashboard.recipe';

describe('OIDC dashboard recipe', () => {
  const testDir = path.join(__dirname, '../.test-oidc-dashboard-output');

  beforeEach(async () => {
    await fs.remove(testDir);
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('writes a generic OIDC contract with framework guidance and mapping hooks', async () => {
    await applyOidcDashboardRecipe(testDir);

    const authPath = path.join(testDir, 'src/shared/auth/oidc-dashboard');
    const config = await fs.readFile(path.join(authPath, 'oidc-dashboard.config.ts'), 'utf-8');
    const principal = await fs.readFile(path.join(authPath, 'oidc-principal.ts'), 'utf-8');
    const mapping = await fs.readFile(path.join(authPath, 'oidc-access-mapping.ts'), 'utf-8');
    const docs = await fs.readFile(path.join(testDir, 'docs/auth/oidc-dashboard.md'), 'utf-8');
    const env = await fs.readFile(path.join(testDir, '.env.example'), 'utf-8');

    expect(config).toContain('OIDC_ISSUER_URL');
    expect(config).toContain('OIDC_CLIENT_ID');
    expect(config).toContain('OIDC_CLIENT_SECRET');
    expect(config).toContain('OIDC_CALLBACK_URL');
    expect(config).toContain('OIDC_SCOPES');
    expect(config).toContain('OIDC_ALLOWED_EMAIL_DOMAINS');
    expect(config).toContain('OIDC_ROLE_CLAIM');
    expect(config).toContain('OIDC_GROUP_CLAIM');

    expect(principal).toContain('groups: string[]');
    expect(mapping).toContain('OidcDashboardAccessMappingHook');
    expect(mapping).toContain('defaultOidcDashboardAccessMapping');
    expect(mapping).toContain('Object.entries');

    expect(docs).toContain('Laravel/Filament Pattern');
    expect(docs).toContain('Next.js/Node Pattern');
    expect(docs).toContain('ZITADEL');
    expect(docs).toContain('Product authorization stays local or PARC-backed');

    expect(env).toContain('OIDC_GROUP_CLAIM=groups');
    expect(env).not.toContain('payswitch');
  });
});
