import { describe, it, expect, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { applyJoiEnvRecipe } from '../../src/commands/recipes/joi-env.recipe';

describe('Joi environment recipe', () => {
  const testDir = path.join(__dirname, '../.test-joi-env-output');

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('accepts both postgres and postgresql URL schemes', async () => {
    await fs.ensureDir(testDir);
    await applyJoiEnvRecipe(testDir);

    const validation = await fs.readFile(
      path.join(testDir, 'src/config/env.validation.ts'),
      'utf-8',
    );

    expect(validation).toContain("uri({ scheme: ['postgres', 'postgresql'] })");
    expect(validation).not.toContain('/postgresql?/');
  });
});
