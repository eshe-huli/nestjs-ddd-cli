import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, fileExists, writeFile } from '../../utils/file.utils';

export async function applyJoiEnvRecipe(basePath: string): Promise<void> {
  const configPath = path.join(basePath, 'src/config');
  await ensureDir(configPath);

  await writeFile(path.join(configPath, 'env.validation.ts'), envValidationContent);
  await writeFile(path.join(configPath, 'configuration.ts'), configurationContent);
  await writeFile(path.join(configPath, 'config-module.options.ts'), configModuleOptionsContent);
  await writeFile(path.join(configPath, 'index.ts'), indexContent);

  const envExamplePath = path.join(basePath, '.env.example');
  const fallbackExamplePath = path.join(basePath, '.env.joi.example');
  const targetExamplePath = (await fileExists(envExamplePath))
    ? fallbackExamplePath
    : envExamplePath;

  await writeFile(targetExamplePath, envExampleContent);

  console.log(chalk.green('  ✓ Joi environment validation schema'));
  console.log(chalk.green('  ✓ Typed configuration factory'));
  console.log(chalk.green('  ✓ ConfigModule options helper'));
  console.log(
    chalk.green(`  ✓ ${path.basename(targetExamplePath)} with platform service defaults`),
  );
  console.log(
    chalk.yellow(
      '  Add `ConfigModule.forRoot(configModuleOptions)` in AppModule to enforce this schema.',
    ),
  );
}

const envValidationContent = `import * as Joi from 'joi';

const uuid = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });
const requiredInProduction = <T extends Joi.Schema>(schema: T): T =>
  schema.when('NODE_ENV', {
    is: 'production',
    then: schema.required(),
    otherwise: schema.optional(),
  }) as T;

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  API_PREFIX: Joi.string().trim().default('api/v1'),
  APP_NAME: Joi.string().trim().default('nestjs-ddd-service'),

  DATABASE_URL: requiredInProduction(
    Joi.string().trim().uri({ scheme: ['postgres', 'postgresql'] }),
  ),
  DATABASE_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  DATABASE_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),

  INTERNAL_API_KEY: requiredInProduction(Joi.string().trim().min(32)),
  SERVICE_ACCESS_INTERNAL_API_KEY: Joi.string().trim().min(32).optional(),

  SERVICE_ACCESS_URL: Joi.string().trim().uri().optional(),
  SERVICE_ACCESS_TIMEOUT_MS: Joi.number().integer().min(1000).default(5000),

  IDENTITY_MANAGER_URL: Joi.string().trim().uri().optional(),
  BUSINESS_ENTITY_URL: Joi.string().trim().uri().optional(),

  IDENTITY_BOOTSTRAP_PLATFORM_USERS: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  SERVICE_ACCESS_BOOTSTRAP_CATALOG: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  SERVICE_ACCESS_BOOTSTRAP_PLATFORM_GRANTS: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  BUSINESS_ENTITY_BOOTSTRAP_PLATFORM_BUSINESSES: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  PLATFORM_BUSINESS_OWNER_ID: uuid.default(
    '00000000-0000-4000-8000-000000000001',
  ),
  KORIDO_BUSINESS_ENTITY_ID: uuid.default(
    '00000000-0000-4000-8000-000000000101',
  ),
  KORIDO_BUSINESS_OWNER_ID: uuid.optional(),

  PLATFORM_OWNER_EMAIL: Joi.string()
    .trim()
    .lowercase()
    .email()
    .default('platform-owner@joonapay.local'),
  PLATFORM_OWNER_USERNAME: Joi.string().trim().default('platform-owner'),
  PLATFORM_OWNER_FIRST_NAME: Joi.string().trim().default('Platform'),
  PLATFORM_OWNER_LAST_NAME: Joi.string().trim().default('Owner'),

  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
  CORS_ORIGINS: Joi.string().trim().allow('').default(''),
})
  .or('INTERNAL_API_KEY', 'SERVICE_ACCESS_INTERNAL_API_KEY')
  .prefs({
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });

export type ValidatedEnv = {
  NODE_ENV: 'development' | 'test' | 'staging' | 'production';
  PORT: number;
  API_PREFIX: string;
  APP_NAME: string;
  DATABASE_URL?: string;
  DATABASE_SSL: boolean;
  DATABASE_LOGGING: boolean;
  INTERNAL_API_KEY?: string;
  SERVICE_ACCESS_INTERNAL_API_KEY?: string;
  SERVICE_ACCESS_URL?: string;
  SERVICE_ACCESS_TIMEOUT_MS: number;
  IDENTITY_MANAGER_URL?: string;
  BUSINESS_ENTITY_URL?: string;
  IDENTITY_BOOTSTRAP_PLATFORM_USERS: boolean;
  SERVICE_ACCESS_BOOTSTRAP_CATALOG: boolean;
  SERVICE_ACCESS_BOOTSTRAP_PLATFORM_GRANTS: boolean;
  BUSINESS_ENTITY_BOOTSTRAP_PLATFORM_BUSINESSES: boolean;
  PLATFORM_BUSINESS_OWNER_ID: string;
  KORIDO_BUSINESS_ENTITY_ID: string;
  KORIDO_BUSINESS_OWNER_ID?: string;
  PLATFORM_OWNER_EMAIL: string;
  PLATFORM_OWNER_USERNAME: string;
  PLATFORM_OWNER_FIRST_NAME: string;
  PLATFORM_OWNER_LAST_NAME: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  CORS_ORIGINS: string;
};

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const { error, value } = envValidationSchema.validate(config);

  if (error) {
    const message = error.details
      .map((detail) => \`  - \${detail.path.join('.')}: \${detail.message}\`)
      .join('\\n');
    throw new Error(\`Environment validation failed:\\n\${message}\`);
  }

  return value as ValidatedEnv;
}
`;

const configurationContent = `import { validateEnv } from './env.validation';

export default () => {
  const env = validateEnv(process.env);
  const internalApiKey =
    env.INTERNAL_API_KEY ?? env.SERVICE_ACCESS_INTERNAL_API_KEY;

  return {
    app: {
      name: env.APP_NAME,
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      apiPrefix: env.API_PREFIX,
      isProduction: env.NODE_ENV === 'production',
      isStaging: env.NODE_ENV === 'staging',
      isTest: env.NODE_ENV === 'test',
    },
    database: {
      url: env.DATABASE_URL,
      ssl: env.DATABASE_SSL,
      logging: env.DATABASE_LOGGING,
    },
    security: {
      internalApiKey,
    },
    serviceAccess: {
      baseUrl: env.SERVICE_ACCESS_URL,
      internalApiKey,
      timeoutMs: env.SERVICE_ACCESS_TIMEOUT_MS,
    },
    platformAdapters: {
      identityManagerUrl: env.IDENTITY_MANAGER_URL,
      businessEntityUrl: env.BUSINESS_ENTITY_URL,
    },
    platformBootstrap: {
      identityUsersEnabled: env.IDENTITY_BOOTSTRAP_PLATFORM_USERS,
      serviceCatalogEnabled: env.SERVICE_ACCESS_BOOTSTRAP_CATALOG,
      serviceGrantsEnabled: env.SERVICE_ACCESS_BOOTSTRAP_PLATFORM_GRANTS,
      businessEntitiesEnabled:
        env.BUSINESS_ENTITY_BOOTSTRAP_PLATFORM_BUSINESSES,
      platformBusinessOwnerId: env.PLATFORM_BUSINESS_OWNER_ID,
      koridoBusinessEntityId: env.KORIDO_BUSINESS_ENTITY_ID,
      koridoBusinessOwnerId:
        env.KORIDO_BUSINESS_OWNER_ID ?? env.PLATFORM_BUSINESS_OWNER_ID,
      platformOwnerEmail: env.PLATFORM_OWNER_EMAIL,
      platformOwnerUsername: env.PLATFORM_OWNER_USERNAME,
      platformOwnerFirstName: env.PLATFORM_OWNER_FIRST_NAME,
      platformOwnerLastName: env.PLATFORM_OWNER_LAST_NAME,
    },
    logging: {
      level: env.LOG_LEVEL,
    },
    cors: {
      origins: env.CORS_ORIGINS
        ? env.CORS_ORIGINS.split(',').map((item) => item.trim()).filter(Boolean)
        : [],
    },
  };
};
`;

const configModuleOptionsContent = `import { ConfigModuleOptions } from '@nestjs/config';
import configuration from './configuration';
import { envValidationSchema } from './env.validation';

export const configModuleOptions: ConfigModuleOptions = {
  isGlobal: true,
  load: [configuration],
  validationSchema: envValidationSchema,
  validationOptions: {
    abortEarly: false,
    allowUnknown: true,
  },
  envFilePath: ['.env.local', '.env'],
  cache: true,
  expandVariables: true,
};
`;

const indexContent = `export * from './config-module.options';
export * from './configuration';
export * from './env.validation';
`;

const envExampleContent = `# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
APP_NAME=nestjs-ddd-service

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/app
DATABASE_SSL=false
DATABASE_LOGGING=false

# Internal platform auth
INTERNAL_API_KEY=replace-with-a-long-random-shared-secret
# SERVICE_ACCESS_INTERNAL_API_KEY=replace-with-a-long-random-shared-secret

# Platform adapters
SERVICE_ACCESS_URL=http://localhost:3010
SERVICE_ACCESS_TIMEOUT_MS=5000
IDENTITY_MANAGER_URL=http://localhost:3000
BUSINESS_ENTITY_URL=http://localhost:3020

# Platform bootstrap defaults
IDENTITY_BOOTSTRAP_PLATFORM_USERS=true
SERVICE_ACCESS_BOOTSTRAP_CATALOG=true
SERVICE_ACCESS_BOOTSTRAP_PLATFORM_GRANTS=true
BUSINESS_ENTITY_BOOTSTRAP_PLATFORM_BUSINESSES=true
PLATFORM_BUSINESS_OWNER_ID=00000000-0000-4000-8000-000000000001
KORIDO_BUSINESS_ENTITY_ID=00000000-0000-4000-8000-000000000101
PLATFORM_OWNER_EMAIL=platform-owner@joonapay.local
PLATFORM_OWNER_USERNAME=platform-owner
PLATFORM_OWNER_FIRST_NAME=Platform
PLATFORM_OWNER_LAST_NAME=Owner

# Runtime
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:3000
`;
