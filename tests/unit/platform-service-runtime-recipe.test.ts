import { afterEach, describe, expect, it } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { applyPlatformServiceRuntimeRecipe } from '../../src/commands/recipes/platform-service-runtime.recipe';

describe('platform service runtime recipe', () => {
  const testDir = path.join(__dirname, '../.test-platform-service-runtime-output');

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('generates authenticated idempotent Service Access registration', async () => {
    await fs.ensureDir(testDir);
    await fs.writeFile(path.join(testDir, '.env.example'), 'EXISTING=true\n');
    await applyPlatformServiceRuntimeRecipe(testDir);

    const root = path.join(testDir, 'src/shared/platform-service-runtime');
    const client = await fs.readFile(
      path.join(root, 'platform-service-registration.client.ts'),
      'utf-8',
    );
    const controller = await fs.readFile(
      path.join(root, 'platform-service-manifest.controller.ts'),
      'utf-8',
    );
    const module = await fs.readFile(path.join(root, 'platform-service.module.ts'), 'utf-8');
    const guard = await fs.readFile(path.join(root, 'platform-manifest.guard.ts'), 'utf-8');
    const env = await fs.readFile(
      path.join(testDir, '.env.platform-service-runtime.example'),
      'utf-8',
    );

    expect(client).toContain('/registered-services/upsert');
    expect(client).toContain('"x-internal-api-key": apiKey');
    expect(client).toContain('"Idempotency-Key": idempotencyKey');
    expect(client).toContain('AbortSignal.timeout(timeoutMs)');
    expect(client).toContain('platform-runtime:');
    expect(client).toContain('PLATFORM_REGISTRATION_REQUIRED');
    expect(client).toContain('PLATFORM_SERVICE_MANIFEST');
    expect(client).not.toContain('from "./platform-service.module"');
    expect(client).toContain('status: "failed"');
    expect(client).toContain('status: "skipped"');
    expect(controller).toContain('@Controller("internal/platform")');
    expect(guard).toContain('PLATFORM_MANIFEST_READ_TOKEN');
    expect(guard).toContain('timingSafeEqual');
    expect(module).toContain('imports: [PlatformContextModule]');
    expect(env).toContain('SERVICE_ACCESS_INTERNAL_API_KEY=');
    expect(await fs.readFile(path.join(testDir, '.env.example'), 'utf-8')).toBe('EXISTING=true\n');
  });
});
