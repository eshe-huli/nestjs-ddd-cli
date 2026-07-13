import { afterEach, describe, expect, it } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { applyRecipe } from '../../src/commands/recipe';
import { applyPlatformParcAuthorizationRecipe } from '../../src/commands/recipes';

describe('platform PARC authorization recipe', () => {
  const testDir = path.join(__dirname, '../.test-platform-parc-authorization-output');

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('generates a fail-closed PARC guard, client, decorator, and audit contract', async () => {
    await fs.ensureDir(testDir);
    await fs.writeFile(path.join(testDir, '.env.example'), 'EXISTING=true\n');

    expect(applyPlatformParcAuthorizationRecipe).toBeDefined();
    await applyRecipe('platform-parc-authorization', { path: testDir });

    const root = path.join(testDir, 'src/shared/authorization/platform-parc-authorization');
    const types = await fs.readFile(path.join(root, 'parc-authorization.types.ts'), 'utf-8');
    const decorator = await fs.readFile(
      path.join(root, 'require-parc-authorization.decorator.ts'),
      'utf-8',
    );
    const client = await fs.readFile(path.join(root, 'parc-authorization.client.ts'), 'utf-8');
    const guard = await fs.readFile(
      path.join(root, 'platform-parc-authorization.guard.ts'),
      'utf-8',
    );
    const module = await fs.readFile(
      path.join(root, 'platform-parc-authorization.module.ts'),
      'utf-8',
    );
    const docs = await fs.readFile(
      path.join(testDir, 'docs/platform/platform-parc-authorization.md'),
      'utf-8',
    );
    const env = await fs.readFile(
      path.join(testDir, '.env.platform-parc-authorization.example'),
      'utf-8',
    );

    expect(
      await fs.pathExists(
        path.join(testDir, 'src/shared/platform-context/platform-context.types.ts'),
      ),
    ).toBe(true);
    expect(types).toContain('allowed: boolean;');
    expect(types).toContain('decisionReference: string;');
    expect(types).toContain('decisionId?: string;');
    expect(types).toContain('parcAccessDecisionReceipt?: ParcAccessDecisionReceipt;');
    expect(decorator).toContain('SetMetadata(PARC_AUTHORIZATION_TARGET');
    expect(decorator).toContain('target: ParcAuthorizationTarget');
    expect(types).toContain('capability: string;');
    expect(types).toContain('action?: string;');

    expect(client).toContain('baseUrl + "/v1/decisions/check"');
    expect(client).toContain('method: "POST"');
    expect(client).toContain('"x-internal-api-key": internalApiKey');
    expect(client).toContain('this.requiredConfig("PARC_INTERNAL_API_KEY")');
    expect(client).toContain('subjectId: this.requiredString(actor?.subjectId)');
    expect(client).toContain(
      'businessId: this.requiredString(target.businessId ?? actor?.businessId)',
    );
    expect(client).toContain(
      'clientAppId: this.requiredString(target.applicationId ?? actor?.applicationId)',
    );
    expect(client).toContain('service: this.requiredString(target.service)');
    expect(client).toContain('permission: this.requiredString(target.capability)');
    expect(client).toContain('action: this.optionalString(target.action)');
    expect(client).toContain('AbortSignal.timeout(timeoutMs)');
    expect(client).toContain('if (!response.ok)');
    expect(client).toContain('typeof record.allowed !== "boolean"');
    expect(client).toContain('this.requiredString(record.decisionReference)');
    expect(client).toContain('if (!decision.allowed)');
    expect(client).toContain('catch {');
    expect(client).toContain('throw this.denied();');

    expect(guard).toContain('this.reflector.getAllAndOverride<ParcAuthorizationTarget>');
    expect(guard).toContain('const receipt = await this.client.check(request, target);');
    expect(guard).toContain('request.parcAccessDecisionReceipt = receipt;');
    expect(guard).not.toContain('request.headers');
    expect(guard).not.toContain('request.query');
    expect(module).toContain('imports: [PlatformContextModule]');

    expect(env).toContain('PARC_URL=');
    expect(env).toContain('PARC_INTERNAL_API_KEY=');
    expect(await fs.readFile(path.join(testDir, '.env.example'), 'utf-8')).toBe('EXISTING=true\n');
    expect(docs).toContain('Owner invariants still apply after PARC allows access.');
    expect(docs).toContain(
      'record `decisionReference` in the same owner transaction as the protected',
    );
    expect(docs).toContain('it does not own\nbusiness truth.');
    expect(docs).toContain("It is not\nthe user's authorization");
  });
});
