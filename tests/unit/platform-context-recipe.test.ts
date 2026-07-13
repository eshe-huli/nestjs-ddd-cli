import { afterEach, describe, expect, it } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { applyPlatformContextRecipe } from '../../src/commands/recipes/platform-context.recipe';

describe('platform context recipe', () => {
  const testDir = path.join(__dirname, '../.test-platform-context-output');

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('generates a trusted actor and machine request-context contract', async () => {
    await fs.ensureDir(testDir);
    await applyPlatformContextRecipe(testDir);

    const root = path.join(testDir, 'src/shared/platform-context');
    const types = await fs.readFile(path.join(root, 'platform-context.types.ts'), 'utf-8');
    const factory = await fs.readFile(path.join(root, 'platform-context.factory.ts'), 'utf-8');
    const service = await fs.readFile(path.join(root, 'platform-context.service.ts'), 'utf-8');
    const docs = await fs.readFile(
      path.join(testDir, 'docs/platform/platform-context.md'),
      'utf-8',
    );

    expect(types).toContain('subjectId: string;');
    expect(types).toContain('businessId?: string;');
    expect(types).toContain('applicationId?: string;');
    expect(types).toContain('serviceName: string;');
    expect(types).toContain('correlationId: string;');
    expect(types).toContain('idempotencyKey?: string;');
    expect(types).toContain('authority: "service-access" | "parc" | "owner-service";');
    expect(types).toContain('decisionReference: string;');
    expect(types).toContain('decisionId?: string;');
    expect(factory).toContain('assertVerifiedPrincipal(input.principal)');
    expect(factory).not.toContain('headers');
    expect(service).toContain('AsyncLocalStorage<PlatformRequestContext>');
    expect(docs).toContain('Both Service Access and PARC must allow');
    expect(docs).toContain('Do not populate actor, business, application, or');
  });
});
