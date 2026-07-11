import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { fileExists } from '../utils/file.utils';

export interface DoctorOptions {
  path?: string;
  app?: string;
}

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export async function runDoctor(options: DoctorOptions) {
  console.log(chalk.blue('\n🩺 Running project health check...\n'));

  const basePath = options.path || process.cwd();
  const projectPath = await resolveNestProjectPath(basePath, options.app);
  const results: CheckResult[] = [];

  // Check package.json
  results.push(await checkFile(basePath, 'package.json', 'Package.json'));

  // Check tsconfig
  results.push(await checkFile(projectPath, 'tsconfig.json', 'TypeScript config'));

  // Check DDD config
  results.push(await checkFile(basePath, '.dddrc.json', 'DDD config', true));

  // Check NestJS structure
  results.push(await checkFile(projectPath, 'src/main.ts', 'NestJS entry point'));
  results.push(await checkFile(projectPath, 'src/app.module.ts', 'App module'));

  // Check DDD structure
  results.push(await checkDirectory(projectPath, 'src/modules', 'Modules directory'));
  results.push(await checkDirectory(projectPath, 'src/shared', 'Shared directory', true));
  results.push(await checkDirectory(projectPath, 'src/migrations', 'Migrations directory', true));

  // Check dependencies
  const dependencyRoots = projectPath === basePath ? [] : [basePath];
  results.push(
    await checkDependency(projectPath, '@nestjs/core', 'NestJS Core', false, dependencyRoots),
  );
  results.push(
    await checkDependency(projectPath, '@nestjs/cqrs', 'CQRS Module', false, dependencyRoots),
  );
  results.push(
    await checkDependency(
      projectPath,
      'class-validator',
      'Class Validator',
      false,
      dependencyRoots,
    ),
  );
  results.push(
    await checkDependency(
      projectPath,
      'class-transformer',
      'Class Transformer',
      false,
      dependencyRoots,
    ),
  );
  results.push(await checkDependency(projectPath, 'typeorm', 'TypeORM', true, dependencyRoots));

  // Check AI context
  results.push(await checkAnyFile(basePath, ['AGENTS.md', 'CLAUDE.md'], 'AI context file', true));

  // Print results
  console.log(chalk.bold('Results:\n'));

  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const result of results) {
    let icon: string;
    let colorFn: (text: string) => string;

    switch (result.status) {
      case 'pass':
        icon = '✓';
        colorFn = (text: string) => chalk.green(text);
        passCount++;
        break;
      case 'warn':
        icon = '⚠';
        colorFn = (text: string) => chalk.yellow(text);
        warnCount++;
        break;
      case 'fail':
        icon = '✗';
        colorFn = (text: string) => chalk.red(text);
        failCount++;
        break;
    }

    console.log(`  ${colorFn(icon)} ${result.name}: ${colorFn(result.message)}`);
  }

  console.log('\n' + chalk.bold('Summary:'));
  console.log(
    `  ${chalk.green(`${passCount} passed`)}, ${chalk.yellow(`${warnCount} warnings`)}, ${chalk.red(`${failCount} failed`)}`,
  );

  if (failCount > 0) {
    console.log(chalk.red('\n⚠️  Some checks failed. Run the suggested fixes above.'));
    return false;
  }

  if (warnCount > 0) {
    console.log(chalk.yellow('\n📝 Some optional features are not configured.'));
  } else {
    console.log(chalk.green('\n✅ Your project is healthy!'));
  }

  return true;
}

async function checkFile(
  basePath: string,
  filePath: string,
  name: string,
  optional = false,
): Promise<CheckResult> {
  const fullPath = path.join(basePath, filePath);
  const exists = await fileExists(fullPath);

  if (exists) {
    return { name, status: 'pass', message: 'Found' };
  }

  if (optional) {
    return { name, status: 'warn', message: `Not found (optional)` };
  }

  return { name, status: 'fail', message: `Not found - required` };
}

async function checkDirectory(
  basePath: string,
  dirPath: string,
  name: string,
  optional = false,
): Promise<CheckResult> {
  const fullPath = path.join(basePath, dirPath);
  const exists = await fileExists(fullPath);

  if (exists) {
    return { name, status: 'pass', message: 'Found' };
  }

  if (optional) {
    return { name, status: 'warn', message: `Not found - run 'ddd shared' to create` };
  }

  return { name, status: 'fail', message: `Not found - run 'ddd init' or create manually` };
}

export async function checkDependency(
  basePath: string,
  packageName: string,
  name: string,
  optional = false,
  fallbackPaths: string[] = [],
): Promise<CheckResult> {
  try {
    for (const packageRoot of [basePath, ...fallbackPaths]) {
      const packageJsonPath = path.resolve(packageRoot, 'package.json');
      if (!(await fileExists(packageJsonPath))) continue;
      const packageJson = await fs.readJson(packageJsonPath);
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (deps[packageName]) {
        return { name, status: 'pass', message: `Installed (${deps[packageName]})` };
      }
    }

    if (optional) {
      return { name, status: 'warn', message: `Not installed (optional)` };
    }

    return { name, status: 'fail', message: `Not installed - run 'npm install ${packageName}'` };
  } catch (error) {
    return { name, status: 'fail', message: 'Could not read package.json' };
  }
}

export async function resolveNestProjectPath(basePath: string, app?: string): Promise<string> {
  const absoluteBasePath = path.resolve(basePath);
  if (app) {
    const candidates = [
      path.resolve(absoluteBasePath, app),
      path.resolve(absoluteBasePath, 'apps', app),
    ];
    for (const candidate of candidates) {
      if (await fileExists(path.join(candidate, 'src', 'main.ts'))) return candidate;
    }
    return candidates[0]!;
  }
  if (await fileExists(path.join(absoluteBasePath, 'src', 'main.ts'))) return absoluteBasePath;
  const appsPath = path.join(absoluteBasePath, 'apps');
  if (!(await fileExists(appsPath))) return absoluteBasePath;
  const entries = await fs.readdir(appsPath, { withFileTypes: true });
  const candidates: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(appsPath, entry.name);
    if (await fileExists(path.join(candidate, 'src', 'main.ts'))) candidates.push(candidate);
  }
  return candidates.length === 1 ? candidates[0]! : absoluteBasePath;
}

async function checkAnyFile(
  basePath: string,
  filePaths: string[],
  name: string,
  optional = false,
): Promise<CheckResult> {
  for (const filePath of filePaths) {
    if (await fileExists(path.join(basePath, filePath)))
      return { name, status: 'pass', message: `Found (${filePath})` };
  }
  return optional
    ? { name, status: 'warn', message: 'Not found (optional)' }
    : { name, status: 'fail', message: 'Not found - required' };
}
