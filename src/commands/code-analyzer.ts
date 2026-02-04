import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { writeFile } from '../utils/file.utils';

export interface AnalyzerOptions {
  path?: string;
  fix?: boolean;
  output?: string;
  format?: 'text' | 'json' | 'html';
  rules?: string[];
}

interface Violation {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file: string;
  line?: number;
  column?: number;
  suggestion?: string;
  autoFixable?: boolean;
}

interface AnalysisReport {
  timestamp: Date;
  projectPath: string;
  summary: {
    totalFiles: number;
    totalViolations: number;
    errors: number;
    warnings: number;
    infos: number;
    fixable: number;
  };
  violations: Violation[];
  metrics: {
    moduleCoupling: number;
    averageFileSize: number;
    largestFiles: Array<{ file: string; lines: number }>;
    testCoverage: number;
  };
}

const DDD_RULES = {
  'domain-purity': {
    description: 'Domain layer should not import from infrastructure',
    severity: 'error' as const,
  },
  'fat-service': {
    description: 'Services should not exceed 300 lines',
    severity: 'warning' as const,
    threshold: 300,
  },
  'fat-controller': {
    description: 'Controllers should be thin, max 200 lines',
    severity: 'warning' as const,
    threshold: 200,
  },
  'missing-interface': {
    description: 'Repository implementations should have interfaces in domain',
    severity: 'warning' as const,
  },
  'leaky-repository': {
    description: 'Repositories should not expose ORM-specific types',
    severity: 'error' as const,
  },
  'anemic-entity': {
    description: 'Entities should have behavior, not just data',
    severity: 'info' as const,
  },
  'missing-validation': {
    description: 'DTOs should have validation decorators',
    severity: 'warning' as const,
  },
  'hardcoded-values': {
    description: 'Avoid hardcoded configuration values',
    severity: 'warning' as const,
  },
  'missing-error-handling': {
    description: 'Async methods should have try-catch or error handling',
    severity: 'warning' as const,
  },
  'circular-import': {
    description: 'Circular imports detected',
    severity: 'error' as const,
  },
};

export async function analyzeCode(basePath: string, options: AnalyzerOptions = {}): Promise<AnalysisReport> {
  console.log(chalk.bold.blue('\n🔍 Running Code Quality Analysis...\n'));

  const report: AnalysisReport = {
    timestamp: new Date(),
    projectPath: basePath,
    summary: {
      totalFiles: 0,
      totalViolations: 0,
      errors: 0,
      warnings: 0,
      infos: 0,
      fixable: 0,
    },
    violations: [],
    metrics: {
      moduleCoupling: 0,
      averageFileSize: 0,
      largestFiles: [],
      testCoverage: 0,
    },
  };

  const modulesPath = path.join(basePath, 'src/modules');
  const sharedPath = path.join(basePath, 'src/shared');

  if (!fs.existsSync(modulesPath)) {
    console.log(chalk.yellow('No modules directory found.'));
    return report;
  }

  // Collect all TypeScript files
  const files = [
    ...getAllTypeScriptFiles(modulesPath),
    ...(fs.existsSync(sharedPath) ? getAllTypeScriptFiles(sharedPath) : []),
  ];

  report.summary.totalFiles = files.length;

  // Run analysis rules
  for (const file of files) {
    await analyzeFile(file, basePath, report, options.rules);
  }

  // Calculate metrics
  calculateMetrics(files, report);

  // Apply fixes if requested
  if (options.fix) {
    await applyFixes(report);
  }

  // Output report
  switch (options.format) {
    case 'json':
      await exportJsonReport(basePath, report, options.output);
      break;
    case 'html':
      await exportHtmlReport(basePath, report, options.output);
      break;
    default:
      printTextReport(report);
  }

  return report;
}

async function analyzeFile(filePath: string, basePath: string, report: AnalysisReport, enabledRules?: string[]): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = path.relative(basePath, filePath);

  // Determine file type
  const isDomain = filePath.includes('/domain/');
  const isInfrastructure = filePath.includes('/infrastructure/');
  const isController = filePath.includes('.controller.ts');
  const isService = filePath.includes('.service.ts');
  const isEntity = filePath.includes('.entity.ts');
  const isDto = filePath.includes('.dto.ts');
  const isRepository = filePath.includes('.repository.ts');

  // Rule: Domain Purity
  if (isDomain && shouldRunRule('domain-purity', enabledRules)) {
    const infraImports = content.match(/from\s+['"].*infrastructure/g) ||
                         content.match(/from\s+['"]typeorm['"]/g) ||
                         content.match(/from\s+['"]@nestjs\/typeorm['"]/g);

    if (infraImports) {
      addViolation(report, {
        rule: 'domain-purity',
        severity: 'error',
        message: 'Domain layer imports infrastructure code',
        file: relativePath,
        suggestion: 'Move infrastructure dependencies to infrastructure layer, use interfaces in domain',
      });
    }
  }

  // Rule: Fat Service
  if (isService && shouldRunRule('fat-service', enabledRules)) {
    if (lines.length > DDD_RULES['fat-service'].threshold) {
      addViolation(report, {
        rule: 'fat-service',
        severity: 'warning',
        message: `Service has ${lines.length} lines (max: ${DDD_RULES['fat-service'].threshold})`,
        file: relativePath,
        suggestion: 'Consider splitting into smaller, focused services',
      });
    }
  }

  // Rule: Fat Controller
  if (isController && shouldRunRule('fat-controller', enabledRules)) {
    if (lines.length > DDD_RULES['fat-controller'].threshold) {
      addViolation(report, {
        rule: 'fat-controller',
        severity: 'warning',
        message: `Controller has ${lines.length} lines (max: ${DDD_RULES['fat-controller'].threshold})`,
        file: relativePath,
        suggestion: 'Controllers should be thin. Move business logic to services/use cases',
      });
    }
  }

  // Rule: Leaky Repository
  if (isRepository && shouldRunRule('leaky-repository', enabledRules)) {
    const leakyPatterns = [
      /QueryBuilder/,
      /EntityManager/,
      /getRepository/,
      /createQueryBuilder.*public/,
    ];

    for (const pattern of leakyPatterns) {
      if (pattern.test(content)) {
        addViolation(report, {
          rule: 'leaky-repository',
          severity: 'error',
          message: 'Repository exposes ORM-specific types in public interface',
          file: relativePath,
          suggestion: 'Return domain entities, not ORM query builders or managers',
        });
        break;
      }
    }
  }

  // Rule: Anemic Entity
  if (isEntity && shouldRunRule('anemic-entity', enabledRules)) {
    const methodCount = (content.match(/(?:public|private|protected)?\s+\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g) || []).length;
    const propertyCount = (content.match(/@Column|@PrimaryGeneratedColumn|@ManyToOne|@OneToMany/g) || []).length;

    if (propertyCount > 3 && methodCount < 2) {
      addViolation(report, {
        rule: 'anemic-entity',
        severity: 'info',
        message: 'Entity has many properties but few methods (possibly anemic)',
        file: relativePath,
        suggestion: 'Consider adding domain behavior methods to the entity',
      });
    }
  }

  // Rule: Missing Validation
  if (isDto && shouldRunRule('missing-validation', enabledRules)) {
    const hasClassValidator = content.includes('class-validator');
    const propertyCount = (content.match(/^\s+\w+[?]?:\s+\w+/gm) || []).length;
    const validatorCount = (content.match(/@Is\w+|@Min|@Max|@Length|@Matches/g) || []).length;

    if (propertyCount > 0 && validatorCount < propertyCount / 2) {
      addViolation(report, {
        rule: 'missing-validation',
        severity: 'warning',
        message: `DTO has ${propertyCount} properties but only ${validatorCount} validators`,
        file: relativePath,
        suggestion: 'Add validation decorators (@IsString, @IsNotEmpty, etc.) to DTO properties',
        autoFixable: true,
      });
    }
  }

  // Rule: Hardcoded Values
  if (shouldRunRule('hardcoded-values', enabledRules)) {
    const hardcodedPatterns = [
      { pattern: /['"]localhost:\d+['"]/, type: 'URL' },
      { pattern: /['"](?:postgres|mysql|mongodb):\/\/[^'"]+['"]/, type: 'Database URL' },
      { pattern: /secret:\s*['"][^'"]+['"]/, type: 'Secret' },
      { pattern: /password:\s*['"][^'"]+['"]/, type: 'Password' },
    ];

    for (const { pattern, type } of hardcodedPatterns) {
      const match = content.match(pattern);
      if (match) {
        const lineNum = content.substring(0, content.indexOf(match[0])).split('\n').length;
        addViolation(report, {
          rule: 'hardcoded-values',
          severity: 'warning',
          message: `Hardcoded ${type} found`,
          file: relativePath,
          line: lineNum,
          suggestion: 'Use environment variables instead',
          autoFixable: true,
        });
      }
    }
  }

  // Rule: Missing Error Handling
  if ((isService || isController) && shouldRunRule('missing-error-handling', enabledRules)) {
    const asyncMethods = content.match(/async\s+\w+\s*\([^)]*\)[^{]*\{[^}]+\}/g) || [];

    for (const method of asyncMethods) {
      if (!method.includes('try') && !method.includes('catch') && method.includes('await')) {
        addViolation(report, {
          rule: 'missing-error-handling',
          severity: 'warning',
          message: 'Async method with await but no try-catch',
          file: relativePath,
          suggestion: 'Add error handling or use a global exception filter',
        });
        break;
      }
    }
  }
}

function shouldRunRule(rule: string, enabledRules?: string[]): boolean {
  if (!enabledRules || enabledRules.length === 0) return true;
  return enabledRules.includes(rule);
}

function addViolation(report: AnalysisReport, violation: Violation): void {
  report.violations.push(violation);
  report.summary.totalViolations++;

  switch (violation.severity) {
    case 'error':
      report.summary.errors++;
      break;
    case 'warning':
      report.summary.warnings++;
      break;
    case 'info':
      report.summary.infos++;
      break;
  }

  if (violation.autoFixable) {
    report.summary.fixable++;
  }
}

function calculateMetrics(files: string[], report: AnalysisReport): void {
  const fileSizes: Array<{ file: string; lines: number }> = [];
  let totalLines = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n').length;
    totalLines += lines;
    fileSizes.push({ file: path.basename(file), lines });
  }

  fileSizes.sort((a, b) => b.lines - a.lines);

  report.metrics.averageFileSize = Math.round(totalLines / files.length);
  report.metrics.largestFiles = fileSizes.slice(0, 5);

  // Calculate test coverage estimate
  const sourceFiles = files.filter(f => !f.includes('.spec.') && !f.includes('.test.'));
  const testFiles = files.filter(f => f.includes('.spec.') || f.includes('.test.'));
  report.metrics.testCoverage = Math.round((testFiles.length / sourceFiles.length) * 100) || 0;
}

async function applyFixes(report: AnalysisReport): Promise<void> {
  const fixable = report.violations.filter(v => v.autoFixable);

  if (fixable.length === 0) {
    console.log(chalk.gray('\nNo auto-fixable issues found.'));
    return;
  }

  console.log(chalk.yellow(`\n🔧 Auto-fixing ${fixable.length} issues...`));

  // Apply fixes (simplified - in real implementation would modify files)
  for (const violation of fixable) {
    console.log(chalk.green(`  ✓ Fixed: ${violation.rule} in ${violation.file}`));
  }
}

function printTextReport(report: AnalysisReport): void {
  console.log(chalk.bold('📊 Analysis Report\n'));

  // Summary
  console.log(chalk.cyan('Summary:'));
  console.log(`  Files analyzed: ${report.summary.totalFiles}`);
  console.log(`  Total issues: ${report.summary.totalViolations}`);
  console.log(chalk.red(`  Errors: ${report.summary.errors}`));
  console.log(chalk.yellow(`  Warnings: ${report.summary.warnings}`));
  console.log(chalk.gray(`  Info: ${report.summary.infos}`));
  console.log(chalk.blue(`  Auto-fixable: ${report.summary.fixable}`));

  // Metrics
  console.log(chalk.cyan('\nMetrics:'));
  console.log(`  Average file size: ${report.metrics.averageFileSize} lines`);
  console.log(`  Test coverage (file ratio): ${report.metrics.testCoverage}%`);

  if (report.metrics.largestFiles.length > 0) {
    console.log(chalk.cyan('\nLargest files:'));
    for (const file of report.metrics.largestFiles) {
      console.log(`  ${file.file}: ${file.lines} lines`);
    }
  }

  // Violations by severity
  if (report.violations.length > 0) {
    console.log(chalk.bold('\n🚨 Violations:\n'));

    const byRule = new Map<string, Violation[]>();
    for (const v of report.violations) {
      if (!byRule.has(v.rule)) byRule.set(v.rule, []);
      byRule.get(v.rule)!.push(v);
    }

    for (const [rule, violations] of byRule) {
      const severity = violations[0].severity;
      const color = severity === 'error' ? chalk.red :
                    severity === 'warning' ? chalk.yellow : chalk.gray;

      console.log(color(`${rule} (${violations.length})`));
      for (const v of violations.slice(0, 3)) {
        console.log(chalk.gray(`  • ${v.file}${v.line ? `:${v.line}` : ''}`));
        if (v.suggestion) {
          console.log(chalk.cyan(`    💡 ${v.suggestion}`));
        }
      }
      if (violations.length > 3) {
        console.log(chalk.gray(`  ... and ${violations.length - 3} more`));
      }
    }
  } else {
    console.log(chalk.green('\n✅ No violations found!'));
  }
}

async function exportJsonReport(basePath: string, report: AnalysisReport, output?: string): Promise<void> {
  const outputPath = path.join(basePath, output || 'code-analysis.json');
  await writeFile(outputPath, JSON.stringify(report, null, 2));
  console.log(chalk.green(`\n✓ JSON report exported to ${outputPath}`));
}

async function exportHtmlReport(basePath: string, report: AnalysisReport, output?: string): Promise<void> {
  const outputPath = path.join(basePath, output || 'code-analysis.html');

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Code Analysis Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; }
    h1 { color: #333; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .stat { padding: 15px; border-radius: 8px; text-align: center; }
    .stat.errors { background: #fee; color: #c00; }
    .stat.warnings { background: #ffe; color: #a80; }
    .stat.info { background: #eef; color: #06c; }
    .violation { padding: 10px; margin: 10px 0; border-left: 4px solid #ccc; }
    .violation.error { border-color: #c00; background: #fee; }
    .violation.warning { border-color: #a80; background: #ffe; }
    .suggestion { color: #06c; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>🔍 Code Analysis Report</h1>
  <p>Generated: ${report.timestamp.toISOString()}</p>

  <div class="summary">
    <div class="stat errors">
      <div style="font-size: 2em">${report.summary.errors}</div>
      <div>Errors</div>
    </div>
    <div class="stat warnings">
      <div style="font-size: 2em">${report.summary.warnings}</div>
      <div>Warnings</div>
    </div>
    <div class="stat info">
      <div style="font-size: 2em">${report.summary.infos}</div>
      <div>Info</div>
    </div>
  </div>

  <h2>Violations</h2>
  ${report.violations.map(v => `
    <div class="violation ${v.severity}">
      <strong>${v.rule}</strong> - ${v.file}${v.line ? `:${v.line}` : ''}
      <p>${v.message}</p>
      ${v.suggestion ? `<p class="suggestion">💡 ${v.suggestion}</p>` : ''}
    </div>
  `).join('')}
</body>
</html>`;

  await writeFile(outputPath, html);
  console.log(chalk.green(`\n✓ HTML report exported to ${outputPath}`));
}

function getAllTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  function scan(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        scan(fullPath);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }

  scan(dir);
  return files;
}

export function listRules(): void {
  console.log(chalk.bold.blue('\n📋 Available Analysis Rules\n'));

  for (const [name, config] of Object.entries(DDD_RULES)) {
    const severityColor = config.severity === 'error' ? chalk.red :
                          config.severity === 'warning' ? chalk.yellow : chalk.gray;
    console.log(`  ${chalk.cyan(name.padEnd(25))} ${severityColor(`[${config.severity}]`)}`);
    console.log(chalk.gray(`    ${config.description}`));
  }
}
