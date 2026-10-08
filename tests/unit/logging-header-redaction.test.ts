import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applyRecipe } from '../../src/commands/recipe';

describe('emitted internal service credential redaction', () => {
  it('emits the internal API header redaction with existing bearer/cookie protection', async () => {
    const target = await mkdtemp(path.join(tmpdir(), 'ddd-logging-redaction-'));
    const output = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await expect(applyRecipe('health', { path: target, dryRun: true })).rejects.toThrow(
        'Dry-run is currently supported only',
      );
      await expect(
        readFile(path.join(target, 'src/shared/logging/logger.config.ts'), 'utf8'),
      ).rejects.toMatchObject({ code: 'ENOENT' });
      await applyRecipe('health', { path: target });
      const source = await readFile(
        path.join(target, 'src/shared/logging/logger.config.ts'),
        'utf8',
      );
      expect(source).toContain('"req.headers[\'x-internal-api-key\']"');
      expect(source).toContain('"req.headers.authorization"');
      expect(source).toContain('"req.headers.cookie"');
      expect(source).toContain('"res.headers[\'set-cookie\']"');
      expect(source).toContain('censor: "[REDACTED]"');
    } finally {
      output.mockRestore();
      await rm(target, { recursive: true, force: true });
    }
  });
});
