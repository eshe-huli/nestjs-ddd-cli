import * as fs from 'fs-extra';
import * as path from 'path';
import { cosmiconfig } from 'cosmiconfig';

export interface DddConfig {
  orm: 'typeorm' | 'prisma' | 'mikro-orm';
  database: 'postgres' | 'mysql' | 'mongodb' | 'sqlite';
  naming: {
    table: 'snake_case' | 'camelCase' | 'PascalCase';
    dto: 'snake_case' | 'camelCase';
    file: 'kebab-case' | 'snake_case';
  };
  features: {
    swagger: boolean;
    pagination: boolean;
    softDelete: boolean;
    timestamps: boolean;
    tests: boolean;
    events: boolean;
  };
  paths: {
    modules: string;
    migrations: string;
    shared: string;
  };
  templates: {
    custom?: string;
  };
}

const DEFAULT_CONFIG: DddConfig = {
  orm: 'typeorm',
  database: 'postgres',
  naming: {
    table: 'snake_case',
    dto: 'snake_case',
    file: 'kebab-case',
  },
  features: {
    swagger: true,
    pagination: true,
    softDelete: true,
    timestamps: true,
    tests: false,
    events: false,
  },
  paths: {
    modules: 'src/modules',
    migrations: 'src/migrations',
    shared: 'src/shared',
  },
  templates: {},
};

let cachedConfig: DddConfig | null = null;

/**
 * Load configuration from .dddrc.json or ddd.config.js
 */
export async function loadConfig(basePath?: string): Promise<DddConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const searchPath = basePath || process.cwd();

  try {
    const explorer = cosmiconfig('ddd');
    const result = await explorer.search(searchPath);

    if (result && result.config) {
      cachedConfig = mergeConfig(DEFAULT_CONFIG, result.config);
      return cachedConfig;
    }
  } catch (error) {
    // Ignore errors, use defaults
  }

  cachedConfig = DEFAULT_CONFIG;
  return cachedConfig;
}

/**
 * Reset cached config (useful for testing)
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}

/**
 * Deep merge configuration objects
 */
function mergeConfig(defaults: DddConfig, overrides: Partial<DddConfig>): DddConfig {
  return {
    orm: overrides.orm || defaults.orm,
    database: overrides.database || defaults.database,
    naming: {
      ...defaults.naming,
      ...(overrides.naming || {}),
    },
    features: {
      ...defaults.features,
      ...(overrides.features || {}),
    },
    paths: {
      ...defaults.paths,
      ...(overrides.paths || {}),
    },
    templates: {
      ...defaults.templates,
      ...(overrides.templates || {}),
    },
  };
}

/**
 * Get a specific config value
 */
export async function getConfigValue<K extends keyof DddConfig>(
  key: K,
  basePath?: string
): Promise<DddConfig[K]> {
  const config = await loadConfig(basePath);
  return config[key];
}

/**
 * Create a default .dddrc.json file in the specified directory
 */
export async function createDefaultConfig(basePath: string): Promise<void> {
  const configPath = path.join(basePath, '.dddrc.json');

  const configContent = {
    $schema: 'https://unpkg.com/nestjs-ddd-cli/ddd.schema.json',
    ...DEFAULT_CONFIG,
  };

  await fs.writeJson(configPath, configContent, { spaces: 2 });
}

/**
 * Generate JSON schema for configuration validation
 */
export function getConfigSchema(): object {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'NestJS DDD CLI Configuration',
    type: 'object',
    properties: {
      orm: {
        type: 'string',
        enum: ['typeorm', 'prisma', 'mikro-orm'],
        default: 'typeorm',
        description: 'ORM to use for database operations',
      },
      database: {
        type: 'string',
        enum: ['postgres', 'mysql', 'mongodb', 'sqlite'],
        default: 'postgres',
        description: 'Database type',
      },
      naming: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            enum: ['snake_case', 'camelCase', 'PascalCase'],
            default: 'snake_case',
          },
          dto: {
            type: 'string',
            enum: ['snake_case', 'camelCase'],
            default: 'snake_case',
          },
          file: {
            type: 'string',
            enum: ['kebab-case', 'snake_case'],
            default: 'kebab-case',
          },
        },
      },
      features: {
        type: 'object',
        properties: {
          swagger: { type: 'boolean', default: true },
          pagination: { type: 'boolean', default: true },
          softDelete: { type: 'boolean', default: true },
          timestamps: { type: 'boolean', default: true },
          tests: { type: 'boolean', default: false },
          events: { type: 'boolean', default: false },
        },
      },
      paths: {
        type: 'object',
        properties: {
          modules: { type: 'string', default: 'src/modules' },
          migrations: { type: 'string', default: 'src/migrations' },
          shared: { type: 'string', default: 'src/shared' },
        },
      },
      templates: {
        type: 'object',
        properties: {
          custom: {
            type: 'string',
            description: 'Path to custom templates directory',
          },
        },
      },
    },
  };
}
