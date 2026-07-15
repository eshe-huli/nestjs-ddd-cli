import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  createDefaultConfig,
  getConfigSchema,
  loadConfig,
  resetConfigCache,
} from '../../src/utils/config.utils';

interface FeatureSchema {
  type: string;
  default: boolean;
  description?: string;
}

interface ConfigSchema {
  properties: {
    features: {
      properties: Record<string, FeatureSchema>;
    };
  };
}

describe('DDD configuration safety defaults', () => {
  const testDir = path.join(__dirname, '../.test-config-output');

  beforeEach(async () => {
    resetConfigCache();
    await fs.remove(testDir);
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    resetConfigCache();
    await fs.remove(testDir);
  });

  it('creates projects with soft deletion enabled and hard-delete helpers disabled', async () => {
    await createDefaultConfig(testDir);

    const config = (await fs.readJson(path.join(testDir, '.dddrc.json'))) as {
      features: Record<string, unknown>;
    };

    expect(config.features).toMatchObject({
      softDelete: true,
      hardDelete: false,
    });
  });

  it('defaults legacy configuration files without hardDelete to the safe setting', async () => {
    await fs.writeJson(path.join(testDir, '.dddrc.json'), {
      features: { softDelete: false },
    });

    const config = await loadConfig(testDir);
    const features = config.features as typeof config.features & { hardDelete?: boolean };

    expect(features.softDelete).toBe(false);
    expect(features.hardDelete).toBe(false);
  });

  it('keeps hard-delete generation available only through an explicit opt-in', async () => {
    await fs.writeJson(path.join(testDir, '.dddrc.json'), {
      features: { hardDelete: true },
    });

    const config = await loadConfig(testDir);
    const features = config.features as typeof config.features & { hardDelete?: boolean };

    expect(features.hardDelete).toBe(true);
  });

  it('publishes hardDelete as a default-false boolean in both configuration schemas', async () => {
    const generatedSchema = getConfigSchema() as ConfigSchema;
    const publishedSchema = (await fs.readJson(
      path.resolve(__dirname, '../../ddd.schema.json'),
    )) as ConfigSchema;

    for (const schema of [generatedSchema, publishedSchema]) {
      expect(schema.properties.features.properties['hardDelete']).toMatchObject({
        type: 'boolean',
        default: false,
      });
    }
  });
});
