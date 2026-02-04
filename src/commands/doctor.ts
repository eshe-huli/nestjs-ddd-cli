import * as path from 'path';
import chalk from 'chalk';
import { fileExists } from '../utils/file.utils';

export interface DoctorOptions {
  path?: string;
}

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export async function runDoctor(options: DoctorOptions) {
  console.log(chalk.blue('\n🩺 Running project health check...\n'));

  const basePath = options.path || process.cwd();
  const results: CheckResult[] = [];

  // Check package.json
  results.push(await checkFile(basePath, 'package.json', 'Package.json'));

  // Check tsconfig
  results.push(await checkFile(basePath, 'tsconfig.json', 'TypeScript config'));

  // Check DDD config
  results.push(await checkFile(basePath, '.dddrc.json', 'DDD config', true));

  // Check NestJS structure
  results.push(await checkFile(basePath, 'src/main.ts', 'NestJS entry point'));
  results.push(await checkFile(basePath, 'src/app.module.ts', 'App module'));

  // Check DDD structure
  results.push(await checkDirectory(basePath, 'src/modules', 'Modules directory'));
  results.push(await checkDirectory(basePath, 'src/shared', 'Shared directory', true));
  results.push(await checkDirectory(basePath, 'src/migrations', 'Migrations directory', true));

  // Check dependencies
  results.push(await checkDependency(basePath, '@nestjs/core', 'NestJS Core'));
  results.push(await checkDependency(basePath, '@nestjs/cqrs', 'CQRS Module'));
  results.push(await checkDependency(basePath, 'class-validator', 'Class Validator'));
  results.push(await checkDependency(basePath, 'class-transformer', 'Class Transformer'));
  results.push(await checkDependency(basePath, 'typeorm', 'TypeORM', true));

  // Check AI context
  results.push(await checkFile(basePath, 'CLAUDE.md', 'AI context file', true));

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
  console.log(`  ${chalk.green(`${passCount} passed`)}, ${chalk.yellow(`${warnCount} warnings`)}, ${chalk.red(`${failCount} failed`)}`);

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
  optional = false
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
  optional = false
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

async function checkDependency(
  basePath: string,
  packageName: string,
  name: string,
  optional = false
): Promise<CheckResult> {
  try {
    const packageJsonPath = path.join(basePath, 'package.json');
    const packageJson = require(packageJsonPath);

    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (deps[packageName]) {
      return { name, status: 'pass', message: `Installed (${deps[packageName]})` };
    }

    if (optional) {
      return { name, status: 'warn', message: `Not installed (optional)` };
    }

    return { name, status: 'fail', message: `Not installed - run 'npm install ${packageName}'` };
  } catch (error) {
    return { name, status: 'fail', message: 'Could not read package.json' };
  }
}
