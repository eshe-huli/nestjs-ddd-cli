import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../utils/file.utils';

export interface EnvManagerOptions {
  path?: string;
  environment?: string;
}

interface EnvVariable {
  name: string;
  value?: string;
  type: 'string' | 'number' | 'boolean' | 'url' | 'secret';
  required: boolean;
  description?: string;
  default?: string;
  example?: string;
}

interface EnvSchema {
  variables: EnvVariable[];
  groups: Array<{
    name: string;
    variables: string[];
  }>;
}

export async function initEnvManager(basePath: string, options: EnvManagerOptions = {}): Promise<void> {
  console.log(chalk.bold.blue('\n🔐 Initializing Environment Management\n'));

  const configPath = path.join(basePath, 'src/config');
  await ensureDir(configPath);

  // Generate environment schema
  await generateEnvSchema(basePath);

  // Generate environment files
  await generateEnvFiles(basePath);

  // Generate typed config module
  await generateConfigModule(configPath);

  // Generate validation
  await generateEnvValidation(configPath);

  console.log(chalk.green('\n✅ Environment management configured!'));
}

async function generateEnvSchema(basePath: string): Promise<void> {
  const schema: EnvSchema = {
    variables: [
      // Application
      { name: 'NODE_ENV', type: 'string', required: true, default: 'development', description: 'Application environment' },
      { name: 'PORT', type: 'number', required: false, default: '3000', description: 'Server port' },
      { name: 'HOST', type: 'string', required: false, default: '0.0.0.0', description: 'Server host' },
      { name: 'API_PREFIX', type: 'string', required: false, default: 'api', description: 'API route prefix' },

      // Database
      { name: 'DATABASE_URL', type: 'url', required: true, description: 'Database connection URL', example: 'postgres://user:pass@localhost:5432/db' },
      { name: 'DATABASE_SSL', type: 'boolean', required: false, default: 'false', description: 'Enable SSL for database' },
      { name: 'DATABASE_POOL_SIZE', type: 'number', required: false, default: '10', description: 'Database connection pool size' },

      // Authentication
      { name: 'JWT_SECRET', type: 'secret', required: true, description: 'JWT signing secret' },
      { name: 'JWT_EXPIRATION', type: 'string', required: false, default: '7d', description: 'JWT token expiration' },
      { name: 'REFRESH_TOKEN_SECRET', type: 'secret', required: false, description: 'Refresh token secret' },

      // Redis
      { name: 'REDIS_URL', type: 'url', required: false, description: 'Redis connection URL', example: 'redis://localhost:6379' },

      // External Services
      { name: 'SMTP_HOST', type: 'string', required: false, description: 'SMTP server host' },
      { name: 'SMTP_PORT', type: 'number', required: false, default: '587', description: 'SMTP server port' },
      { name: 'SMTP_USER', type: 'string', required: false, description: 'SMTP username' },
      { name: 'SMTP_PASS', type: 'secret', required: false, description: 'SMTP password' },

      // AWS
      { name: 'AWS_REGION', type: 'string', required: false, default: 'us-east-1', description: 'AWS region' },
      { name: 'AWS_ACCESS_KEY_ID', type: 'secret', required: false, description: 'AWS access key' },
      { name: 'AWS_SECRET_ACCESS_KEY', type: 'secret', required: false, description: 'AWS secret key' },
      { name: 'S3_BUCKET', type: 'string', required: false, description: 'S3 bucket name' },

      // Monitoring
      { name: 'SENTRY_DSN', type: 'url', required: false, description: 'Sentry DSN for error tracking' },
      { name: 'LOG_LEVEL', type: 'string', required: false, default: 'info', description: 'Log level (debug, info, warn, error)' },
    ],
    groups: [
      { name: 'Application', variables: ['NODE_ENV', 'PORT', 'HOST', 'API_PREFIX'] },
      { name: 'Database', variables: ['DATABASE_URL', 'DATABASE_SSL', 'DATABASE_POOL_SIZE'] },
      { name: 'Authentication', variables: ['JWT_SECRET', 'JWT_EXPIRATION', 'REFRESH_TOKEN_SECRET'] },
      { name: 'Redis', variables: ['REDIS_URL'] },
      { name: 'Email', variables: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'] },
      { name: 'AWS', variables: ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET'] },
      { name: 'Monitoring', variables: ['SENTRY_DSN', 'LOG_LEVEL'] },
    ],
  };

  await writeFile(path.join(basePath, 'env.schema.json'), JSON.stringify(schema, null, 2));
  console.log(chalk.green('  ✓ env.schema.json'));
}

async function generateEnvFiles(basePath: string): Promise<void> {
  const schemaPath = path.join(basePath, 'env.schema.json');
  const schema: EnvSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

  // .env.example
  let example = '# Environment Variables\n# Copy this file to .env and fill in the values\n\n';

  for (const group of schema.groups) {
    example += `# ${group.name}\n`;
    for (const varName of group.variables) {
      const variable = schema.variables.find(v => v.name === varName);
      if (variable) {
        if (variable.description) {
          example += `# ${variable.description}\n`;
        }
        const value = variable.example || variable.default || '';
        example += `${variable.name}=${value}\n`;
      }
    }
    example += '\n';
  }

  await writeFile(path.join(basePath, '.env.example'), example);
  console.log(chalk.green('  ✓ .env.example'));

  // .env.development
  let dev = '# Development Environment\n\n';
  dev += 'NODE_ENV=development\n';
  dev += 'PORT=3000\n';
  dev += 'HOST=localhost\n\n';
  dev += '# Database\n';
  dev += 'DATABASE_URL=postgres://postgres:postgres@localhost:5432/app_dev\n\n';
  dev += '# Auth\n';
  dev += 'JWT_SECRET=dev-secret-change-in-production\n';
  dev += 'JWT_EXPIRATION=1d\n\n';
  dev += '# Logging\n';
  dev += 'LOG_LEVEL=debug\n';

  await writeFile(path.join(basePath, '.env.development'), dev);
  console.log(chalk.green('  ✓ .env.development'));

  // .env.test
  let test = '# Test Environment\n\n';
  test += 'NODE_ENV=test\n';
  test += 'PORT=3001\n\n';
  test += '# Database (use separate test database)\n';
  test += 'DATABASE_URL=postgres://postgres:postgres@localhost:5432/app_test\n\n';
  test += '# Auth\n';
  test += 'JWT_SECRET=test-secret\n\n';
  test += '# Logging\n';
  test += 'LOG_LEVEL=error\n';

  await writeFile(path.join(basePath, '.env.test'), test);
  console.log(chalk.green('  ✓ .env.test'));

  // .env.production.example
  let prod = '# Production Environment\n# DO NOT commit actual production values!\n\n';
  prod += 'NODE_ENV=production\n';
  prod += 'PORT=3000\n';
  prod += 'HOST=0.0.0.0\n\n';
  prod += '# Database (use connection pooler in production)\n';
  prod += 'DATABASE_URL=\n';
  prod += 'DATABASE_SSL=true\n';
  prod += 'DATABASE_POOL_SIZE=20\n\n';
  prod += '# Auth (use strong secrets)\n';
  prod += 'JWT_SECRET=\n';
  prod += 'JWT_EXPIRATION=7d\n\n';
  prod += '# Monitoring\n';
  prod += 'SENTRY_DSN=\n';
  prod += 'LOG_LEVEL=info\n';

  await writeFile(path.join(basePath, '.env.production.example'), prod);
  console.log(chalk.green('  ✓ .env.production.example'));
}

async function generateConfigModule(configPath: string): Promise<void> {
  const content = `import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  apiPrefix: process.env.API_PREFIX || 'api',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true',
  poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
}));

export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION || '7d',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
}));

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL,
}));

export const smtpConfig = registerAs('smtp', () => ({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
}));

export const awsConfig = registerAs('aws', () => ({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3Bucket: process.env.S3_BUCKET,
}));

export const monitoringConfig = registerAs('monitoring', () => ({
  sentryDsn: process.env.SENTRY_DSN,
  logLevel: process.env.LOG_LEVEL || 'info',
}));

// Export all configs
export const configs = [
  appConfig,
  databaseConfig,
  authConfig,
  redisConfig,
  smtpConfig,
  awsConfig,
  monitoringConfig,
];
`;

  await writeFile(path.join(configPath, 'configuration.ts'), content);
  console.log(chalk.green('  ✓ configuration.ts'));

  // Config types
  const typesContent = `export interface AppConfig {
  nodeEnv: string;
  port: number;
  host: string;
  apiPrefix: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
}

export interface DatabaseConfig {
  url: string;
  ssl: boolean;
  poolSize: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiration: string;
  refreshTokenSecret?: string;
}

export interface RedisConfig {
  url?: string;
}

export interface SmtpConfig {
  host?: string;
  port: number;
  user?: string;
  pass?: string;
}

export interface AwsConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  s3Bucket?: string;
}

export interface MonitoringConfig {
  sentryDsn?: string;
  logLevel: string;
}
`;

  await writeFile(path.join(configPath, 'config.types.ts'), typesContent);
  console.log(chalk.green('  ✓ config.types.ts'));
}

async function generateEnvValidation(configPath: string): Promise<void> {
  const content = `import { plainToInstance } from 'class-transformer';
import { IsString, IsNumber, IsBoolean, IsOptional, IsUrl, validateSync, IsEnum } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  HOST: string = '0.0.0.0';

  @IsString()
  DATABASE_URL: string;

  @IsBoolean()
  @IsOptional()
  DATABASE_SSL: boolean = false;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRATION: string = '7d';

  @IsUrl()
  @IsOptional()
  REDIS_URL?: string;

  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'info';
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors.map(err => {
      const constraints = Object.values(err.constraints || {}).join(', ');
      return \`  - \${err.property}: \${constraints}\`;
    });

    throw new Error(\`Environment validation failed:\\n\${messages.join('\\n')}\`);
  }

  return validatedConfig;
}

/**
 * Load environment variables with validation
 */
export function loadEnv() {
  // Validate required variables
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  return validateEnv(process.env);
}
`;

  await writeFile(path.join(configPath, 'env.validation.ts'), content);
  console.log(chalk.green('  ✓ env.validation.ts'));

  // Index file
  const indexContent = `export * from './configuration';
export * from './config.types';
export * from './env.validation';
`;

  await writeFile(path.join(configPath, 'index.ts'), indexContent);
  console.log(chalk.green('  ✓ config/index.ts'));
}

export async function validateEnvCommand(basePath: string): Promise<void> {
  console.log(chalk.bold.blue('\n🔍 Validating Environment Variables\n'));

  const schemaPath = path.join(basePath, 'env.schema.json');

  if (!fs.existsSync(schemaPath)) {
    console.log(chalk.yellow('No env.schema.json found. Run `ddd env init` first.'));
    return;
  }

  const schema: EnvSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const variable of schema.variables) {
    const value = process.env[variable.name];

    if (variable.required && !value) {
      errors.push(`Missing required variable: ${variable.name}`);
    } else if (!value && variable.default) {
      warnings.push(`Using default for ${variable.name}: ${variable.default}`);
    }

    if (value && variable.type === 'number' && isNaN(Number(value))) {
      errors.push(`${variable.name} should be a number, got: ${value}`);
    }

    if (value && variable.type === 'boolean' && !['true', 'false', '1', '0'].includes(value)) {
      errors.push(`${variable.name} should be a boolean, got: ${value}`);
    }

    if (value && variable.type === 'url') {
      try {
        new URL(value);
      } catch {
        errors.push(`${variable.name} should be a valid URL, got: ${value}`);
      }
    }
  }

  if (errors.length > 0) {
    console.log(chalk.red('❌ Validation Errors:'));
    errors.forEach(e => console.log(chalk.red(`  • ${e}`)));
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️ Warnings:'));
    warnings.forEach(w => console.log(chalk.yellow(`  • ${w}`)));
  }

  if (errors.length === 0) {
    console.log(chalk.green('✅ All environment variables are valid!'));
  } else {
    process.exit(1);
  }
}
