import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { writeFile, ensureDir } from '../utils/file.utils';

export interface PerfAnalyzerOptions {
  path?: string;
  output?: string;
  checkN1?: boolean;
  checkMemory?: boolean;
  checkBundle?: boolean;
}

interface PerfIssue {
  type: 'n+1' | 'memory-leak' | 'slow-query' | 'missing-index' | 'large-payload' | 'sync-operation';
  severity: 'critical' | 'warning' | 'info';
  file: string;
  line?: number;
  message: string;
  suggestion: string;
  codeSnippet?: string;
}

interface PerfReport {
  timestamp: Date;
  issues: PerfIssue[];
  summary: {
    critical: number;
    warnings: number;
    info: number;
  };
  recommendations: string[];
}

export async function analyzePerformance(basePath: string, options: PerfAnalyzerOptions = {}): Promise<void> {
  console.log(chalk.bold.blue('\n⚡ Performance Analysis\n'));

  const report: PerfReport = {
    timestamp: new Date(),
    issues: [],
    summary: { critical: 0, warnings: 0, info: 0 },
    recommendations: [],
  };

  const modulesPath = path.join(basePath, 'src/modules');

  if (!fs.existsSync(modulesPath)) {
    console.log(chalk.yellow('No modules directory found.'));
    return;
  }

  // Run analysis
  console.log(chalk.cyan('Scanning for performance issues...\n'));

  await checkN1Queries(modulesPath, report);
  await checkMemoryLeaks(modulesPath, report);
  await checkSlowPatterns(modulesPath, report);
  await checkMissingIndexes(modulesPath, report);
  await checkLargePayloads(modulesPath, report);
  await checkSyncOperations(modulesPath, report);

  // Generate recommendations
  generateRecommendations(report);

  // Update summary
  for (const issue of report.issues) {
    if (issue.severity === 'critical') report.summary.critical++;
    else if (issue.severity === 'warning') report.summary.warnings++;
    else report.summary.info++;
  }

  // Output report
  printReport(report);

  if (options.output) {
    const outputDir = path.join(basePath, path.dirname(options.output));
    await ensureDir(outputDir);
    await writeFile(
      path.join(basePath, options.output),
      JSON.stringify(report, null, 2)
    );
    console.log(chalk.green(`\nReport saved to ${options.output}`));
  }
}

async function checkN1Queries(modulesPath: string, report: PerfReport): Promise<void> {
  const files = getAllTypeScriptFiles(modulesPath);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), file);

    // Pattern 1: Loop with await inside
    const loopAwaitPattern = /for\s*\([^)]+\)\s*\{[\s\S]*?await\s+(?:this\.)?(?:\w+\.)?(?:find|query|get|fetch)/g;
    let match;

    while ((match = loopAwaitPattern.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      report.issues.push({
        type: 'n+1',
        severity: 'critical',
        file: relativePath,
        line: lineNum,
        message: 'Potential N+1 query: Database call inside loop',
        suggestion: 'Use batch loading, eager loading, or DataLoader pattern',
        codeSnippet: lines[lineNum - 1]?.trim(),
      });
    }

    // Pattern 2: forEach with async callback
    if (content.includes('.forEach(async')) {
      const lineNum = content.indexOf('.forEach(async');
      const lineNumber = content.substring(0, lineNum).split('\n').length;

      report.issues.push({
        type: 'n+1',
        severity: 'warning',
        file: relativePath,
        line: lineNumber,
        message: 'forEach with async callback may cause sequential queries',
        suggestion: 'Use Promise.all with map() for parallel execution',
      });
    }

    // Pattern 3: Nested relation loading
    const nestedLoadPattern = /\.find\w*\(\{[\s\S]*?relations:\s*\[[\s\S]*?\[/;
    if (nestedLoadPattern.test(content)) {
      report.issues.push({
        type: 'n+1',
        severity: 'warning',
        file: relativePath,
        message: 'Deep nested relations may cause performance issues',
        suggestion: 'Consider using query builder with explicit joins or GraphQL DataLoader',
      });
    }
  }
}

async function checkMemoryLeaks(modulesPath: string, report: PerfReport): Promise<void> {
  const files = getAllTypeScriptFiles(modulesPath);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(process.cwd(), file);

    // Pattern 1: Event listeners without cleanup
    if (content.includes('.on(') || content.includes('.addEventListener(')) {
      if (!content.includes('.off(') && !content.includes('.removeEventListener(') &&
          !content.includes('OnModuleDestroy') && !content.includes('onModuleDestroy')) {
        report.issues.push({
          type: 'memory-leak',
          severity: 'warning',
          file: relativePath,
          message: 'Event listener without cleanup',
          suggestion: 'Implement OnModuleDestroy to remove event listeners',
        });
      }
    }

    // Pattern 2: Intervals without cleanup
    if (content.includes('setInterval(')) {
      if (!content.includes('clearInterval(')) {
        report.issues.push({
          type: 'memory-leak',
          severity: 'warning',
          file: relativePath,
          message: 'setInterval without clearInterval',
          suggestion: 'Store interval ID and clear in OnModuleDestroy',
        });
      }
    }

    // Pattern 3: Subscriptions without unsubscribe
    if (content.includes('.subscribe(')) {
      if (!content.includes('.unsubscribe(') && !content.includes('takeUntil(')) {
        report.issues.push({
          type: 'memory-leak',
          severity: 'warning',
          file: relativePath,
          message: 'Observable subscription without unsubscribe',
          suggestion: 'Use takeUntil pattern or store subscription for cleanup',
        });
      }
    }

    // Pattern 4: Large arrays growing unbounded
    const unboundedArrayPattern = /private\s+\w+:\s*\w+\[\]\s*=\s*\[\][\s\S]*?\.push\(/;
    if (unboundedArrayPattern.test(content)) {
      if (!content.includes('.splice(') && !content.includes('.shift(') &&
          !content.includes('= []') && !content.includes('.length = ')) {
        report.issues.push({
          type: 'memory-leak',
          severity: 'info',
          file: relativePath,
          message: 'Array that grows without bounds',
          suggestion: 'Implement size limit or periodic cleanup',
        });
      }
    }
  }
}

async function checkSlowPatterns(modulesPath: string, report: PerfReport): Promise<void> {
  const files = getAllTypeScriptFiles(modulesPath);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(process.cwd(), file);

    // Pattern 1: SELECT * (implicit in findAll without select)
    if (content.includes('.find()') || content.includes('.findAll()')) {
      if (!content.includes('select:')) {
        report.issues.push({
          type: 'slow-query',
          severity: 'info',
          file: relativePath,
          message: 'Fetching all columns (SELECT *)',
          suggestion: 'Specify only needed columns with select option',
        });
      }
    }

    // Pattern 2: Missing pagination
    if (content.includes('.find(') && !content.includes('take:') &&
        !content.includes('limit:') && !content.includes('skip:')) {
      if (content.includes('Repository') || content.includes('.repository')) {
        report.issues.push({
          type: 'slow-query',
          severity: 'warning',
          file: relativePath,
          message: 'Query without pagination may return large datasets',
          suggestion: 'Add take/skip or limit/offset for pagination',
        });
      }
    }

    // Pattern 3: Synchronous file operations
    const syncOps = ['readFileSync', 'writeFileSync', 'existsSync', 'mkdirSync'];
    for (const op of syncOps) {
      if (content.includes(op) && !file.includes('.spec.') && !file.includes('.test.')) {
        report.issues.push({
          type: 'sync-operation',
          severity: 'warning',
          file: relativePath,
          message: `Synchronous file operation: ${op}`,
          suggestion: 'Use async version (readFile, writeFile, etc.) in production code',
        });
        break;
      }
    }

    // Pattern 4: JSON.parse without try-catch
    if (content.includes('JSON.parse(') && !content.includes('try')) {
      const lineNum = content.indexOf('JSON.parse(');
      const lineNumber = content.substring(0, lineNum).split('\n').length;

      report.issues.push({
        type: 'slow-query',
        severity: 'info',
        file: relativePath,
        line: lineNumber,
        message: 'JSON.parse without error handling',
        suggestion: 'Wrap in try-catch to handle malformed JSON',
      });
    }
  }
}

async function checkMissingIndexes(modulesPath: string, report: PerfReport): Promise<void> {
  const files = getAllTypeScriptFiles(modulesPath).filter(f => f.includes('.entity.ts'));

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(process.cwd(), file);

    // Check for columns that should be indexed
    const searchableFields = ['email', 'username', 'slug', 'status', 'type', 'category'];

    for (const field of searchableFields) {
      const fieldPattern = new RegExp(`@Column[^)]*\\)\\s*${field}\\s*:`, 'i');
      if (fieldPattern.test(content)) {
        if (!content.includes(`@Index`) || !content.includes(field)) {
          report.issues.push({
            type: 'missing-index',
            severity: 'info',
            file: relativePath,
            message: `Column "${field}" might benefit from an index`,
            suggestion: `Add @Index() decorator if this column is frequently queried`,
          });
        }
      }
    }

    // Check foreign keys
    if (content.includes('@ManyToOne') || content.includes('@OneToOne')) {
      const fkPattern = /@(?:ManyToOne|OneToOne)[^)]*\)[\s\S]*?(\w+Id):/g;
      let match;

      while ((match = fkPattern.exec(content)) !== null) {
        if (!content.includes(`@Index`) || !content.includes(match[1])) {
          report.issues.push({
            type: 'missing-index',
            severity: 'warning',
            file: relativePath,
            message: `Foreign key "${match[1]}" should have an index`,
            suggestion: 'Add @Index() to foreign key columns for better join performance',
          });
        }
      }
    }
  }
}

async function checkLargePayloads(modulesPath: string, report: PerfReport): Promise<void> {
  const files = getAllTypeScriptFiles(modulesPath).filter(f =>
    f.includes('.controller.ts') || f.includes('.resolver.ts')
  );

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(process.cwd(), file);

    // Check for endpoints returning arrays without limits
    if (content.includes('findAll') || content.includes('getAll') || content.includes('list')) {
      if (!content.includes('pagination') && !content.includes('PaginatedResponse') &&
          !content.includes('limit') && !content.includes('take')) {
        report.issues.push({
          type: 'large-payload',
          severity: 'warning',
          file: relativePath,
          message: 'Endpoint may return unbounded array',
          suggestion: 'Implement pagination to prevent large payloads',
        });
      }
    }

    // Check for returning full entities with relations
    if (content.includes('relations:') && content.includes('return')) {
      report.issues.push({
        type: 'large-payload',
        severity: 'info',
        file: relativePath,
        message: 'Returning entities with eager-loaded relations',
        suggestion: 'Consider using DTOs to control response payload size',
      });
    }
  }
}

async function checkSyncOperations(modulesPath: string, report: PerfReport): Promise<void> {
  const files = getAllTypeScriptFiles(modulesPath);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(process.cwd(), file);

    // Check for blocking crypto operations
    if (content.includes('crypto.') && (content.includes('Sync') || content.includes('pbkdf2Sync'))) {
      report.issues.push({
        type: 'sync-operation',
        severity: 'critical',
        file: relativePath,
        message: 'Synchronous crypto operation blocks event loop',
        suggestion: 'Use async versions (scrypt, pbkdf2) or move to worker thread',
      });
    }

    // Check for CPU-intensive operations
    const intensiveOps = ['while (true)', 'for (;;)', '.sort()', '.reverse()'];
    for (const op of intensiveOps) {
      if (content.includes(op) && !file.includes('.spec.')) {
        report.issues.push({
          type: 'sync-operation',
          severity: 'info',
          file: relativePath,
          message: `Potentially CPU-intensive operation: ${op}`,
          suggestion: 'Consider using worker threads for CPU-bound tasks',
        });
        break;
      }
    }
  }
}

function generateRecommendations(report: PerfReport): void {
  const issueTypes = new Set(report.issues.map(i => i.type));

  if (issueTypes.has('n+1')) {
    report.recommendations.push(
      'Install DataLoader for batching database queries',
      'Use eager loading sparingly and prefer explicit joins',
      'Consider implementing query result caching'
    );
  }

  if (issueTypes.has('memory-leak')) {
    report.recommendations.push(
      'Implement OnModuleDestroy interface for cleanup',
      'Use WeakMap/WeakSet for caches when appropriate',
      'Consider using memory profiling tools in development'
    );
  }

  if (issueTypes.has('missing-index')) {
    report.recommendations.push(
      'Review query execution plans with EXPLAIN ANALYZE',
      'Add indexes to frequently queried columns',
      'Consider composite indexes for multi-column queries'
    );
  }

  if (issueTypes.has('large-payload')) {
    report.recommendations.push(
      'Implement cursor-based pagination for large datasets',
      'Use DTOs to control response shape and size',
      'Consider GraphQL for clients to request only needed fields'
    );
  }
}

function printReport(report: PerfReport): void {
  console.log(chalk.bold('📊 Performance Report\n'));

  // Summary
  console.log(chalk.cyan('Summary:'));
  console.log(chalk.red(`  Critical: ${report.summary.critical}`));
  console.log(chalk.yellow(`  Warnings: ${report.summary.warnings}`));
  console.log(chalk.gray(`  Info: ${report.summary.info}`));

  // Issues by type
  const byType = new Map<string, PerfIssue[]>();
  for (const issue of report.issues) {
    if (!byType.has(issue.type)) byType.set(issue.type, []);
    byType.get(issue.type)!.push(issue);
  }

  if (report.issues.length > 0) {
    console.log(chalk.bold('\n🚨 Issues Found:\n'));

    for (const [type, issues] of byType) {
      const typeLabel = type.replace(/-/g, ' ').toUpperCase();
      console.log(chalk.cyan(`${typeLabel} (${issues.length})`));

      for (const issue of issues.slice(0, 5)) {
        const color = issue.severity === 'critical' ? chalk.red :
                      issue.severity === 'warning' ? chalk.yellow : chalk.gray;
        console.log(color(`  • ${issue.file}${issue.line ? `:${issue.line}` : ''}`));
        console.log(chalk.gray(`    ${issue.message}`));
        console.log(chalk.cyan(`    💡 ${issue.suggestion}`));
      }

      if (issues.length > 5) {
        console.log(chalk.gray(`    ... and ${issues.length - 5} more`));
      }
      console.log();
    }
  } else {
    console.log(chalk.green('\n✅ No performance issues found!'));
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    console.log(chalk.bold('💡 Recommendations:\n'));
    for (const rec of report.recommendations) {
      console.log(chalk.cyan(`  • ${rec}`));
    }
  }
}

function getAllTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  function scan(d: string) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') scan(p);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) files.push(p);
    }
  }
  scan(dir);
  return files;
}
