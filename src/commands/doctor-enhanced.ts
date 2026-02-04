import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface DoctorOptions {
  fix?: boolean;
  verbose?: boolean;
}

interface DiagnosticResult {
  category: string;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
  autoFixable?: boolean;
}

interface DoctorReport {
  passed: number;
  warnings: number;
  errors: number;
  results: DiagnosticResult[];
}

export async function runEnhancedDoctor(basePath: string, options: DoctorOptions = {}): Promise<DoctorReport> {
  const report: DoctorReport = {
    passed: 0,
    warnings: 0,
    errors: 0,
    results: [],
  };

  console.log(chalk.bold.blue('\n🩺 Running Enhanced DDD Doctor...\n'));

  // Run all diagnostic checks
  await checkProjectStructure(basePath, report);
  await checkDddPatterns(basePath, report);
  await checkTypeScriptStrictness(basePath, report);
  await checkNamingConventions(basePath, report);
  await checkTestCoverage(basePath, report);
  await checkImportPatterns(basePath, report);
  await checkEntityIntegrity(basePath, report);
  await checkModuleBoundaries(basePath, report);

  // Print results
  printReport(report, options.verbose);

  // Auto-fix if requested
  if (options.fix) {
    await applyFixes(report);
  }

  return report;
}

async function checkProjectStructure(basePath: string, report: DoctorReport): Promise<void> {
  const requiredDirs = [
    'src/modules',
    'src/shared',
  ];

  const recommendedDirs = [
    'src/shared/domain',
    'src/shared/infrastructure',
    'src/shared/application',
  ];

  for (const dir of requiredDirs) {
    const fullPath = path.join(basePath, dir);
    if (!fs.existsSync(fullPath)) {
      report.errors++;
      report.results.push({
        category: 'Structure',
        rule: 'required-directory',
        severity: 'error',
        message: `Missing required directory: ${dir}`,
        suggestion: `Run: mkdir -p ${dir}`,
        autoFixable: true,
      });
    } else {
      report.passed++;
    }
  }

  for (const dir of recommendedDirs) {
    const fullPath = path.join(basePath, dir);
    if (!fs.existsSync(fullPath)) {
      report.warnings++;
      report.results.push({
        category: 'Structure',
        rule: 'recommended-directory',
        severity: 'warning',
        message: `Missing recommended directory: ${dir}`,
        suggestion: `Consider adding ${dir} for better DDD organization`,
      });
    }
  }
}

async function checkDddPatterns(basePath: string, report: DoctorReport): Promise<void> {
  const modulesPath = path.join(basePath, 'src/modules');
  if (!fs.existsSync(modulesPath)) return;

  const modules = fs.readdirSync(modulesPath).filter(f =>
    fs.statSync(path.join(modulesPath, f)).isDirectory()
  );

  for (const moduleName of modules) {
    const modulePath = path.join(modulesPath, moduleName);

    // Check for domain layer
    const domainPath = path.join(modulePath, 'domain');
    if (!fs.existsSync(domainPath)) {
      report.warnings++;
      report.results.push({
        category: 'DDD Pattern',
        rule: 'missing-domain-layer',
        severity: 'warning',
        message: `Module "${moduleName}" missing domain layer`,
        file: modulePath,
        suggestion: 'Add domain/ directory with entities, value-objects, and domain services',
      });
    }

    // Check for entity immutability patterns
    const entitiesPath = path.join(domainPath, 'entities');
    if (fs.existsSync(entitiesPath)) {
      await checkEntityImmutability(entitiesPath, moduleName, report);
    }

    // Check for proper aggregate roots
    await checkAggregateRoots(domainPath, moduleName, report);

    // Check repository interface in domain layer
    await checkRepositoryPattern(modulePath, moduleName, report);
  }
}

async function checkEntityImmutability(entitiesPath: string, moduleName: string, report: DoctorReport): Promise<void> {
  const files = fs.readdirSync(entitiesPath).filter(f => f.endsWith('.ts'));

  for (const file of files) {
    const filePath = path.join(entitiesPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for public setters (anti-pattern in DDD)
    const publicSetterMatch = content.match(/public\s+set\s+\w+/g);
    if (publicSetterMatch) {
      report.warnings++;
      report.results.push({
        category: 'DDD Pattern',
        rule: 'entity-immutability',
        severity: 'warning',
        message: `Entity has public setters (consider using methods for state changes)`,
        file: filePath,
        suggestion: 'Replace public setters with domain methods that enforce business rules',
      });
    }

    // Check for direct property assignment patterns
    if (content.includes('public ') && !content.includes('readonly')) {
      const publicPropsMatch = content.match(/public\s+(?!readonly)\w+\s*[;:]/g);
      if (publicPropsMatch && publicPropsMatch.length > 0) {
        report.warnings++;
        report.results.push({
          category: 'DDD Pattern',
          rule: 'entity-encapsulation',
          severity: 'warning',
          message: `Entity has mutable public properties`,
          file: filePath,
          suggestion: 'Use private/readonly properties with getter methods',
        });
      }
    }
  }
}

async function checkAggregateRoots(domainPath: string, moduleName: string, report: DoctorReport): Promise<void> {
  if (!fs.existsSync(domainPath)) return;

  const files = getAllTypeScriptFiles(domainPath);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');

    // Check if entity extends AggregateRoot when it should
    if (content.includes('class ') && content.includes('Entity')) {
      const hasAggregateRoot = content.includes('extends AggregateRoot') ||
                               content.includes('extends BaseEntity');
      const hasDomainEvents = content.includes('domainEvents') ||
                              content.includes('addDomainEvent');

      if (hasDomainEvents && !hasAggregateRoot) {
        report.warnings++;
        report.results.push({
          category: 'DDD Pattern',
          rule: 'aggregate-root',
          severity: 'warning',
          message: `Entity uses domain events but doesn't extend AggregateRoot`,
          file,
          suggestion: 'Extend AggregateRoot base class for entities that emit domain events',
        });
      }
    }
  }
}

async function checkRepositoryPattern(modulePath: string, moduleName: string, report: DoctorReport): Promise<void> {
  const domainPath = path.join(modulePath, 'domain');
  const infraPath = path.join(modulePath, 'infrastructure');

  // Check for repository interface in domain layer
  const domainRepoFiles = fs.existsSync(domainPath)
    ? getAllTypeScriptFiles(domainPath).filter(f => f.includes('repository'))
    : [];

  const infraRepoFiles = fs.existsSync(infraPath)
    ? getAllTypeScriptFiles(infraPath).filter(f => f.includes('repository'))
    : [];

  if (infraRepoFiles.length > 0 && domainRepoFiles.length === 0) {
    report.warnings++;
    report.results.push({
      category: 'DDD Pattern',
      rule: 'repository-interface',
      severity: 'warning',
      message: `Module "${moduleName}" has repository implementation but no interface in domain layer`,
      suggestion: 'Define repository interface in domain layer, implement in infrastructure',
    });
  }
}

async function checkTypeScriptStrictness(basePath: string, report: DoctorReport): Promise<void> {
  const tsconfigPath = path.join(basePath, 'tsconfig.json');

  if (!fs.existsSync(tsconfigPath)) {
    report.errors++;
    report.results.push({
      category: 'TypeScript',
      rule: 'tsconfig-exists',
      severity: 'error',
      message: 'Missing tsconfig.json',
      suggestion: 'Run: npx tsc --init',
    });
    return;
  }

  try {
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
    const compilerOptions = tsconfig.compilerOptions || {};

    const strictOptions = [
      { option: 'strict', recommended: true },
      { option: 'noImplicitAny', recommended: true },
      { option: 'strictNullChecks', recommended: true },
      { option: 'noUnusedLocals', recommended: true },
      { option: 'noUnusedParameters', recommended: true },
    ];

    for (const { option, recommended } of strictOptions) {
      if (compilerOptions[option] !== recommended) {
        report.warnings++;
        report.results.push({
          category: 'TypeScript',
          rule: `strict-${option}`,
          severity: 'warning',
          message: `TypeScript option "${option}" is not set to ${recommended}`,
          file: tsconfigPath,
          suggestion: `Add "${option}": ${recommended} to compilerOptions`,
          autoFixable: true,
        });
      } else {
        report.passed++;
      }
    }
  } catch (error) {
    report.errors++;
    report.results.push({
      category: 'TypeScript',
      rule: 'tsconfig-valid',
      severity: 'error',
      message: 'Invalid tsconfig.json',
    });
  }
}

async function checkNamingConventions(basePath: string, report: DoctorReport): Promise<void> {
  const modulesPath = path.join(basePath, 'src/modules');
  if (!fs.existsSync(modulesPath)) return;

  const files = getAllTypeScriptFiles(modulesPath);

  for (const file of files) {
    const fileName = path.basename(file);
    const content = fs.readFileSync(file, 'utf-8');

    // Check file naming conventions
    if (fileName.includes('Entity') && !fileName.endsWith('.entity.ts')) {
      report.warnings++;
      report.results.push({
        category: 'Naming',
        rule: 'file-naming',
        severity: 'warning',
        message: `Entity file should end with .entity.ts`,
        file,
        suggestion: `Rename to ${fileName.replace('.ts', '.entity.ts')}`,
      });
    }

    // Check class naming
    const classMatch = content.match(/export\s+class\s+(\w+)/g);
    if (classMatch) {
      for (const match of classMatch) {
        const className = match.replace('export class ', '');

        // Check PascalCase
        if (className[0] !== className[0].toUpperCase()) {
          report.errors++;
          report.results.push({
            category: 'Naming',
            rule: 'class-pascal-case',
            severity: 'error',
            message: `Class name "${className}" should be PascalCase`,
            file,
          });
        }
      }
    }
  }
}

async function checkTestCoverage(basePath: string, report: DoctorReport): Promise<void> {
  const modulesPath = path.join(basePath, 'src/modules');
  if (!fs.existsSync(modulesPath)) return;

  const modules = fs.readdirSync(modulesPath).filter(f =>
    fs.statSync(path.join(modulesPath, f)).isDirectory()
  );

  for (const moduleName of modules) {
    const modulePath = path.join(modulesPath, moduleName);
    const sourceFiles = getAllTypeScriptFiles(modulePath).filter(f =>
      !f.includes('.spec.ts') && !f.includes('.test.ts')
    );
    const testFiles = getAllTypeScriptFiles(modulePath).filter(f =>
      f.includes('.spec.ts') || f.includes('.test.ts')
    );

    // Check for service tests
    const services = sourceFiles.filter(f => f.includes('.service.ts'));
    for (const service of services) {
      const testFile = service.replace('.service.ts', '.service.spec.ts');
      if (!fs.existsSync(testFile)) {
        report.warnings++;
        report.results.push({
          category: 'Testing',
          rule: 'service-test',
          severity: 'warning',
          message: `Service missing unit test`,
          file: service,
          suggestion: `Create ${path.basename(testFile)}`,
        });
      }
    }

    // Check for domain entity tests
    const entities = sourceFiles.filter(f => f.includes('.entity.ts'));
    for (const entity of entities) {
      const testFile = entity.replace('.entity.ts', '.entity.spec.ts');
      if (!fs.existsSync(testFile)) {
        report.results.push({
          category: 'Testing',
          rule: 'entity-test',
          severity: 'info',
          message: `Entity missing unit test (recommended for complex domain logic)`,
          file: entity,
        });
      }
    }
  }
}

async function checkImportPatterns(basePath: string, report: DoctorReport): Promise<void> {
  const modulesPath = path.join(basePath, 'src/modules');
  if (!fs.existsSync(modulesPath)) return;

  const modules = fs.readdirSync(modulesPath).filter(f =>
    fs.statSync(path.join(modulesPath, f)).isDirectory()
  );

  for (const moduleName of modules) {
    const modulePath = path.join(modulesPath, moduleName);
    const domainPath = path.join(modulePath, 'domain');

    if (!fs.existsSync(domainPath)) continue;

    const domainFiles = getAllTypeScriptFiles(domainPath);

    for (const file of domainFiles) {
      const content = fs.readFileSync(file, 'utf-8');

      // Check for infrastructure imports in domain layer (violation)
      if (content.includes("from '../infrastructure") ||
          content.includes("from './infrastructure") ||
          content.includes('from "@nestjs/typeorm"') ||
          content.includes('from "typeorm"')) {
        report.errors++;
        report.results.push({
          category: 'Architecture',
          rule: 'domain-purity',
          severity: 'error',
          message: `Domain layer has infrastructure/ORM imports`,
          file,
          suggestion: 'Domain layer should not depend on infrastructure. Use interfaces/ports.',
        });
      }

      // Check for direct HTTP/controller imports in domain
      if (content.includes('@nestjs/common') &&
          (content.includes('Controller') || content.includes('Get') || content.includes('Post'))) {
        report.errors++;
        report.results.push({
          category: 'Architecture',
          rule: 'domain-purity',
          severity: 'error',
          message: `Domain layer has HTTP/controller imports`,
          file,
          suggestion: 'Move HTTP-related code to application or presentation layer',
        });
      }
    }
  }
}

async function checkEntityIntegrity(basePath: string, report: DoctorReport): Promise<void> {
  const modulesPath = path.join(basePath, 'src/modules');
  if (!fs.existsSync(modulesPath)) return;

  const files = getAllTypeScriptFiles(modulesPath).filter(f => f.includes('.entity.ts'));

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');

    // Check for ID field
    if (!content.includes('@PrimaryGeneratedColumn') &&
        !content.includes('@PrimaryColumn') &&
        !content.includes('id:') &&
        !content.includes('_id:')) {
      report.warnings++;
      report.results.push({
        category: 'Entity',
        rule: 'entity-id',
        severity: 'warning',
        message: `Entity may be missing primary key`,
        file,
        suggestion: 'Ensure entity has a primary key field',
      });
    }

    // Check for createdAt/updatedAt
    if (!content.includes('createdAt') && !content.includes('created_at')) {
      report.results.push({
        category: 'Entity',
        rule: 'entity-timestamps',
        severity: 'info',
        message: `Entity missing createdAt timestamp`,
        file,
        suggestion: 'Consider adding createdAt/updatedAt for auditing',
      });
    }
  }
}

async function checkModuleBoundaries(basePath: string, report: DoctorReport): Promise<void> {
  const modulesPath = path.join(basePath, 'src/modules');
  if (!fs.existsSync(modulesPath)) return;

  const modules = fs.readdirSync(modulesPath).filter(f =>
    fs.statSync(path.join(modulesPath, f)).isDirectory()
  );

  for (const moduleName of modules) {
    const modulePath = path.join(modulesPath, moduleName);
    const files = getAllTypeScriptFiles(modulePath);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');

      // Check for cross-module imports (potential boundary violation)
      for (const otherModule of modules) {
        if (otherModule === moduleName) continue;

        const importPattern = new RegExp(`from ['"].*/${otherModule}/(?!.*\\.module)`, 'g');
        if (importPattern.test(content)) {
          // Check if it's importing from domain (allowed) or internal (violation)
          const internalImport = content.includes(`/${otherModule}/application/`) ||
                                 content.includes(`/${otherModule}/infrastructure/`);

          if (internalImport) {
            report.warnings++;
            report.results.push({
              category: 'Architecture',
              rule: 'module-boundaries',
              severity: 'warning',
              message: `Cross-module import from internal layer of "${otherModule}"`,
              file,
              suggestion: `Import from module's public API or shared kernel instead`,
            });
          }
        }
      }
    }
  }
}

function getAllTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTypeScriptFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function applyFixes(report: DoctorReport): Promise<void> {
  const fixableResults = report.results.filter(r => r.autoFixable);

  if (fixableResults.length === 0) {
    console.log(chalk.gray('\nNo auto-fixable issues found.'));
    return;
  }

  console.log(chalk.yellow(`\n🔧 Applying ${fixableResults.length} auto-fixes...`));

  for (const result of fixableResults) {
    if (result.rule === 'required-directory' && result.suggestion) {
      const dir = result.suggestion.replace('Run: mkdir -p ', '');
      fs.mkdirSync(dir, { recursive: true });
      console.log(chalk.green(`  ✓ Created directory: ${dir}`));
    }
  }
}

function printReport(report: DoctorReport, verbose?: boolean): void {
  // Group by category
  const byCategory = new Map<string, DiagnosticResult[]>();
  for (const result of report.results) {
    if (!byCategory.has(result.category)) {
      byCategory.set(result.category, []);
    }
    byCategory.get(result.category)!.push(result);
  }

  for (const [category, results] of byCategory) {
    console.log(chalk.bold(`\n📁 ${category}`));

    for (const result of results) {
      const icon = result.severity === 'error' ? '❌' :
                   result.severity === 'warning' ? '⚠️' : 'ℹ️';
      const color = result.severity === 'error' ? chalk.red :
                    result.severity === 'warning' ? chalk.yellow : chalk.gray;

      console.log(color(`  ${icon} ${result.message}`));

      if (verbose) {
        if (result.file) {
          console.log(chalk.gray(`     File: ${result.file}`));
        }
        if (result.suggestion) {
          console.log(chalk.cyan(`     💡 ${result.suggestion}`));
        }
      }
    }
  }

  // Summary
  console.log(chalk.bold('\n─────────────────────────────────────'));
  console.log(chalk.bold('Summary:'));
  console.log(chalk.green(`  ✓ Passed: ${report.passed}`));
  console.log(chalk.yellow(`  ⚠ Warnings: ${report.warnings}`));
  console.log(chalk.red(`  ✗ Errors: ${report.errors}`));
  console.log(chalk.bold('─────────────────────────────────────\n'));

  if (report.errors > 0) {
    console.log(chalk.red('❌ Doctor found issues that should be addressed.'));
  } else if (report.warnings > 0) {
    console.log(chalk.yellow('⚠️  Doctor found warnings. Consider addressing them.'));
  } else {
    console.log(chalk.green('✅ All checks passed! Your DDD structure looks healthy.'));
  }
}
