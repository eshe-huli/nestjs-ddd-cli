import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../utils/file.utils';

export interface MonorepoOptions {
  path?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  apps?: string[];
  libs?: string[];
}

interface WorkspaceConfig {
  name: string;
  type: 'app' | 'lib';
  path: string;
  dependencies: string[];
}

export async function initMonorepo(projectName: string, options: MonorepoOptions = {}): Promise<void> {
  console.log(chalk.bold.blue(`\n🏗️  Initializing Monorepo: ${projectName}\n`));

  const basePath = options.path ? path.join(options.path, projectName) : path.join(process.cwd(), projectName);
  const packageManager = options.packageManager || 'npm';

  // Create directory structure
  await ensureDir(basePath);
  await ensureDir(path.join(basePath, 'apps'));
  await ensureDir(path.join(basePath, 'libs'));
  await ensureDir(path.join(basePath, 'tools'));

  // Generate root package.json
  await generateRootPackageJson(basePath, projectName, packageManager);

  // Generate workspace configuration
  await generateWorkspaceConfig(basePath, packageManager);

  // Generate shared TypeScript config
  await generateTsConfig(basePath);

  // Generate NX or Turborepo config
  await generateBuildConfig(basePath);

  // Generate common libs
  await generateSharedLib(basePath, 'common');
  await generateSharedLib(basePath, 'domain');

  // Generate sample app
  await generateSampleApp(basePath, 'api');

  // Generate scripts and tooling
  await generateTooling(basePath);

  console.log(chalk.green(`\n✅ Monorepo created at ${basePath}`));
  console.log(chalk.cyan(`\nNext steps:`));
  console.log(chalk.gray(`  cd ${projectName}`));
  console.log(chalk.gray(`  ${packageManager} install`));
  console.log(chalk.gray(`  ${packageManager} run dev`));
}

async function generateRootPackageJson(basePath: string, name: string, pm: string): Promise<void> {
  const workspaces = pm === 'pnpm' ? undefined : ['apps/*', 'libs/*'];

  const content = {
    name,
    version: '0.0.0',
    private: true,
    ...(workspaces && { workspaces }),
    scripts: {
      'dev': 'turbo run dev',
      'build': 'turbo run build',
      'test': 'turbo run test',
      'lint': 'turbo run lint',
      'clean': 'turbo run clean && rm -rf node_modules',
      'format': 'prettier --write "**/*.{ts,tsx,md}"',
      'prepare': 'husky install',
    },
    devDependencies: {
      'turbo': '^1.10.0',
      'typescript': '^5.0.0',
      'prettier': '^3.0.0',
      'husky': '^8.0.0',
      'lint-staged': '^14.0.0',
      '@types/node': '^20.0.0',
    },
    engines: {
      'node': '>=18.0.0',
    },
    packageManager: pm === 'pnpm' ? 'pnpm@8.0.0' : undefined,
  };

  await writeFile(path.join(basePath, 'package.json'), JSON.stringify(content, null, 2));
  console.log(chalk.green('  ✓ package.json'));
}

async function generateWorkspaceConfig(basePath: string, pm: string): Promise<void> {
  if (pm === 'pnpm') {
    const pnpmWorkspace = `packages:
  - 'apps/*'
  - 'libs/*'
`;
    await writeFile(path.join(basePath, 'pnpm-workspace.yaml'), pnpmWorkspace);
    console.log(chalk.green('  ✓ pnpm-workspace.yaml'));
  }

  // Turbo config
  const turboConfig = {
    $schema: 'https://turbo.build/schema.json',
    globalDependencies: ['**/.env.*local'],
    pipeline: {
      'build': {
        dependsOn: ['^build'],
        outputs: ['dist/**'],
      },
      'dev': {
        cache: false,
        persistent: true,
      },
      'test': {
        dependsOn: ['^build'],
        outputs: ['coverage/**'],
      },
      'lint': {
        outputs: [],
      },
      'clean': {
        cache: false,
      },
    },
  };

  await writeFile(path.join(basePath, 'turbo.json'), JSON.stringify(turboConfig, null, 2));
  console.log(chalk.green('  ✓ turbo.json'));
}

async function generateTsConfig(basePath: string): Promise<void> {
  // Base tsconfig
  const baseConfig = {
    compilerOptions: {
      target: 'ES2021',
      module: 'commonjs',
      lib: ['ES2021'],
      declaration: true,
      strict: true,
      noImplicitAny: true,
      strictNullChecks: true,
      noImplicitThis: true,
      alwaysStrict: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: false,
      inlineSourceMap: true,
      inlineSources: true,
      esModuleInterop: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      baseUrl: '.',
      paths: {
        '@libs/*': ['libs/*/src'],
        '@apps/*': ['apps/*/src'],
      },
    },
    exclude: ['node_modules', 'dist'],
  };

  await writeFile(path.join(basePath, 'tsconfig.base.json'), JSON.stringify(baseConfig, null, 2));
  console.log(chalk.green('  ✓ tsconfig.base.json'));

  // Root tsconfig that extends base
  const rootConfig = {
    extends: './tsconfig.base.json',
    compilerOptions: {
      baseUrl: '.',
    },
    references: [
      { path: 'apps/api' },
      { path: 'libs/common' },
      { path: 'libs/domain' },
    ],
    files: [],
    exclude: ['node_modules', '**/dist'],
  };

  await writeFile(path.join(basePath, 'tsconfig.json'), JSON.stringify(rootConfig, null, 2));
  console.log(chalk.green('  ✓ tsconfig.json'));
}

async function generateBuildConfig(basePath: string): Promise<void> {
  // .gitignore
  const gitignore = `# Dependencies
node_modules
.pnpm-store

# Build outputs
dist
*.tsbuildinfo

# Cache
.turbo
.cache

# IDE
.idea
.vscode
*.swp
*.swo

# Environment
.env
.env.local
.env.*.local

# Logs
logs
*.log
npm-debug.log*

# Test
coverage

# OS
.DS_Store
Thumbs.db
`;

  await writeFile(path.join(basePath, '.gitignore'), gitignore);
  console.log(chalk.green('  ✓ .gitignore'));

  // .prettierrc
  const prettierConfig = {
    semi: true,
    trailingComma: 'all',
    singleQuote: true,
    printWidth: 100,
    tabWidth: 2,
  };

  await writeFile(path.join(basePath, '.prettierrc'), JSON.stringify(prettierConfig, null, 2));
  console.log(chalk.green('  ✓ .prettierrc'));

  // .nvmrc
  await writeFile(path.join(basePath, '.nvmrc'), '18');
  console.log(chalk.green('  ✓ .nvmrc'));
}

async function generateSharedLib(basePath: string, libName: string): Promise<void> {
  const libPath = path.join(basePath, 'libs', libName);

  await ensureDir(path.join(libPath, 'src'));

  // package.json
  const packageJson = {
    name: `@libs/${libName}`,
    version: '0.0.0',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      'build': 'tsc -p tsconfig.build.json',
      'clean': 'rm -rf dist',
      'dev': 'tsc -w -p tsconfig.build.json',
    },
    dependencies: {},
    devDependencies: {
      'typescript': '^5.0.0',
    },
  };

  await writeFile(path.join(libPath, 'package.json'), JSON.stringify(packageJson, null, 2));

  // tsconfig.json
  const tsConfig = {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      outDir: './dist',
      rootDir: './src',
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };

  await writeFile(path.join(libPath, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));

  // tsconfig.build.json
  const tsBuildConfig = {
    extends: './tsconfig.json',
    exclude: ['**/*.spec.ts', '**/*.test.ts'],
  };

  await writeFile(path.join(libPath, 'tsconfig.build.json'), JSON.stringify(tsBuildConfig, null, 2));

  // src/index.ts
  const indexContent = libName === 'common'
    ? `// Common utilities and shared code
export * from './utils';
export * from './types';
`
    : `// Domain models and business logic
export * from './entities';
export * from './value-objects';
`;

  await writeFile(path.join(libPath, 'src/index.ts'), indexContent);

  // Create subdirectories
  if (libName === 'common') {
    await ensureDir(path.join(libPath, 'src/utils'));
    await ensureDir(path.join(libPath, 'src/types'));
    await writeFile(path.join(libPath, 'src/utils/index.ts'), `export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
`);
    await writeFile(path.join(libPath, 'src/types/index.ts'), `export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
`);
  } else {
    await ensureDir(path.join(libPath, 'src/entities'));
    await ensureDir(path.join(libPath, 'src/value-objects'));
    await writeFile(path.join(libPath, 'src/entities/index.ts'), `// Export domain entities
`);
    await writeFile(path.join(libPath, 'src/value-objects/index.ts'), `// Export value objects
`);
  }

  console.log(chalk.green(`  ✓ libs/${libName}`));
}

async function generateSampleApp(basePath: string, appName: string): Promise<void> {
  const appPath = path.join(basePath, 'apps', appName);

  await ensureDir(path.join(appPath, 'src'));
  await ensureDir(path.join(appPath, 'src/modules'));
  await ensureDir(path.join(appPath, 'test'));

  // package.json
  const packageJson = {
    name: `@apps/${appName}`,
    version: '0.0.0',
    scripts: {
      'build': 'nest build',
      'clean': 'rm -rf dist',
      'dev': 'nest start --watch',
      'start': 'node dist/main',
      'start:prod': 'node dist/main',
      'test': 'jest',
      'test:e2e': 'jest --config ./test/jest-e2e.json',
    },
    dependencies: {
      '@nestjs/common': '^10.0.0',
      '@nestjs/core': '^10.0.0',
      '@nestjs/platform-express': '^10.0.0',
      '@libs/common': 'workspace:*',
      '@libs/domain': 'workspace:*',
      'reflect-metadata': '^0.1.13',
      'rxjs': '^7.8.0',
    },
    devDependencies: {
      '@nestjs/cli': '^10.0.0',
      '@nestjs/testing': '^10.0.0',
      '@types/express': '^4.17.17',
      '@types/jest': '^29.5.0',
      'jest': '^29.5.0',
      'ts-jest': '^29.1.0',
      'typescript': '^5.0.0',
    },
  };

  await writeFile(path.join(appPath, 'package.json'), JSON.stringify(packageJson, null, 2));

  // tsconfig.json
  const tsConfig = {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      outDir: './dist',
      rootDir: './src',
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist', 'test'],
  };

  await writeFile(path.join(appPath, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));

  // nest-cli.json
  const nestCli = {
    $schema: 'https://json.schemastore.org/nest-cli',
    collection: '@nestjs/schematics',
    sourceRoot: 'src',
    compilerOptions: {
      deleteOutDir: true,
    },
  };

  await writeFile(path.join(appPath, 'nest-cli.json'), JSON.stringify(nestCli, null, 2));

  // main.ts
  const mainContent = `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(\`Application running on: http://localhost:\${port}\`);
}
bootstrap();
`;

  await writeFile(path.join(appPath, 'src/main.ts'), mainContent);

  // app.module.ts
  const appModuleContent = `import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
`;

  await writeFile(path.join(appPath, 'src/app.module.ts'), appModuleContent);

  // app.controller.ts
  const appControllerContent = `import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
`;

  await writeFile(path.join(appPath, 'src/app.controller.ts'), appControllerContent);

  // app.service.ts
  const appServiceContent = `import { Injectable } from '@nestjs/common';
import { sleep } from '@libs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello from the monorepo!';
  }
}
`;

  await writeFile(path.join(appPath, 'src/app.service.ts'), appServiceContent);

  console.log(chalk.green(`  ✓ apps/${appName}`));
}

async function generateTooling(basePath: string): Promise<void> {
  const toolsPath = path.join(basePath, 'tools');

  // Workspace generator script
  const generatorContent = `#!/usr/bin/env node
/**
 * Workspace Generator
 * Usage: node tools/generate.js <type> <name>
 * Types: app, lib
 */

const fs = require('fs');
const path = require('path');

const [,, type, name] = process.argv;

if (!type || !name) {
  console.log('Usage: node tools/generate.js <app|lib> <name>');
  process.exit(1);
}

const targetPath = type === 'app'
  ? path.join(__dirname, '..', 'apps', name)
  : path.join(__dirname, '..', 'libs', name);

if (fs.existsSync(targetPath)) {
  console.error(\`\${type} "\${name}" already exists\`);
  process.exit(1);
}

console.log(\`Creating \${type}: \${name}\`);
// Add generation logic here

console.log('Done!');
`;

  await writeFile(path.join(toolsPath, 'generate.js'), generatorContent);
  console.log(chalk.green('  ✓ tools/generate.js'));
}

export async function addWorkspace(basePath: string, type: 'app' | 'lib', name: string): Promise<void> {
  console.log(chalk.blue(`\nAdding ${type}: ${name}\n`));

  if (type === 'lib') {
    await generateSharedLib(basePath, name);
  } else {
    await generateSampleApp(basePath, name);
  }

  console.log(chalk.green(`\n✅ Added ${type}: ${name}`));
}
