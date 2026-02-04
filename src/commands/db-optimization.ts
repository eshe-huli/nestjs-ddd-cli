import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { toPascalCase, toCamelCase, toKebabCase } from '../utils/naming.utils';

export interface DbOptimizationOptions {
  module?: string;
  orm?: 'typeorm' | 'prisma' | 'mikro-orm';
  includeDataLoader?: boolean;
  includeQueryAnalyzer?: boolean;
}

export async function setupDbOptimization(
  basePath: string,
  options: DbOptimizationOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n🗄️ Setting up Database Optimization\n'));

  const moduleName = options.module || 'shared';
  const pascalName = toPascalCase(moduleName);
  const camelName = toCamelCase(moduleName);
  const kebabName = toKebabCase(moduleName);
  const orm = options.orm || 'typeorm';
  const includeDataLoader = options.includeDataLoader !== false;
  const includeQueryAnalyzer = options.includeQueryAnalyzer !== false;

  const baseDir = path.join(basePath, 'src', kebabName, 'infrastructure', 'database');
  fs.mkdirSync(baseDir, { recursive: true });

  // DataLoader for N+1 prevention
  if (includeDataLoader) {
    const dataLoaderContent = `import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';

/**
 * Generic DataLoader factory for preventing N+1 queries
 * Creates request-scoped DataLoader instances
 */
@Injectable({ scope: Scope.REQUEST })
export class DataLoaderFactory {
  private loaders: Map<string, DataLoader<any, any>> = new Map();

  /**
   * Get or create a DataLoader for the specified key
   */
  getLoader<K, V>(
    key: string,
    batchFn: (keys: readonly K[]) => Promise<(V | Error)[]>,
    options?: DataLoader.Options<K, V>,
  ): DataLoader<K, V> {
    if (!this.loaders.has(key)) {
      this.loaders.set(
        key,
        new DataLoader<K, V>(batchFn, {
          cache: true,
          maxBatchSize: 100,
          ...options,
        }),
      );
    }
    return this.loaders.get(key) as DataLoader<K, V>;
  }

  /**
   * Clear all loaders (useful for mutations)
   */
  clearAll(): void {
    this.loaders.forEach((loader) => loader.clearAll());
  }

  /**
   * Clear specific loader
   */
  clear(key: string): void {
    const loader = this.loaders.get(key);
    if (loader) {
      loader.clearAll();
    }
  }
}

/**
 * DataLoader decorator for automatic batching
 */
export function BatchLoad(loaderKey: string): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const dataLoaderFactory = (this as any).dataLoaderFactory as DataLoaderFactory;

      if (!dataLoaderFactory) {
        // Fallback to original method if no DataLoader available
        return originalMethod.apply(this, args);
      }

      const loader = dataLoaderFactory.getLoader(
        loaderKey,
        async (keys: readonly any[]) => {
          // Call original method with all keys
          return originalMethod.call(this, keys);
        },
      );

      // If single ID, use load; if array, use loadMany
      const id = args[0];
      if (Array.isArray(id)) {
        return loader.loadMany(id);
      }
      return loader.load(id);
    };

    return descriptor;
  };
}

/**
 * ${pascalName} specific DataLoader service
 */
@Injectable({ scope: Scope.REQUEST })
export class ${pascalName}DataLoader {
  constructor(
    private readonly dataLoaderFactory: DataLoaderFactory,
    // Inject your repository here
    // private readonly ${camelName}Repository: ${pascalName}Repository,
  ) {}

  /**
   * Batch load ${camelName} by IDs
   */
  async loadById(id: string): Promise<any> {
    const loader = this.dataLoaderFactory.getLoader<string, any>(
      '${camelName}ById',
      async (ids: readonly string[]) => {
        // Replace with actual repository call
        // const entities = await this.${camelName}Repository.findByIds([...ids]);
        // return ids.map(id => entities.find(e => e.id === id) || new Error(\`${pascalName} \${id} not found\`));
        return ids.map(() => null);
      },
    );
    return loader.load(id);
  }

  /**
   * Batch load ${camelName} by foreign key
   */
  async loadByForeignKey(foreignKeyId: string): Promise<any[]> {
    const loader = this.dataLoaderFactory.getLoader<string, any[]>(
      '${camelName}ByForeignKey',
      async (foreignKeyIds: readonly string[]) => {
        // Replace with actual repository call
        // const entities = await this.${camelName}Repository.findByForeignKeys([...foreignKeyIds]);
        // return foreignKeyIds.map(fkId => entities.filter(e => e.foreignKeyId === fkId));
        return foreignKeyIds.map(() => []);
      },
    );
    return loader.load(foreignKeyId);
  }

  /**
   * Prime cache with known data
   */
  prime(id: string, data: any): void {
    const loader = this.dataLoaderFactory.getLoader<string, any>(
      '${camelName}ById',
      async () => [],
    );
    loader.prime(id, data);
  }

  /**
   * Clear cache after mutations
   */
  clearCache(id?: string): void {
    if (id) {
      const loader = this.dataLoaderFactory.getLoader<string, any>(
        '${camelName}ById',
        async () => [],
      );
      loader.clear(id);
    } else {
      this.dataLoaderFactory.clear('${camelName}ById');
      this.dataLoaderFactory.clear('${camelName}ByForeignKey');
    }
  }
}
`;
    fs.writeFileSync(path.join(baseDir, 'data-loader.ts'), dataLoaderContent);
  }

  // Query Analyzer
  if (includeQueryAnalyzer) {
    const queryAnalyzerContent = `import { Injectable, Logger } from '@nestjs/common';
${orm === 'typeorm' ? "import { DataSource, QueryRunner } from 'typeorm';" : ''}

interface QueryMetrics {
  query: string;
  duration: number;
  rowsAffected?: number;
  timestamp: Date;
  explain?: ExplainResult;
}

interface ExplainResult {
  type: string;
  possibleKeys?: string[];
  key?: string;
  rows?: number;
  filtered?: number;
  extra?: string;
}

interface SlowQueryReport {
  query: string;
  avgDuration: number;
  maxDuration: number;
  count: number;
  suggestion: string;
}

interface IndexSuggestion {
  table: string;
  columns: string[];
  reason: string;
  impact: 'high' | 'medium' | 'low';
}

/**
 * Query performance analyzer for identifying slow queries and optimization opportunities
 */
@Injectable()
export class QueryAnalyzerService {
  private readonly logger = new Logger(QueryAnalyzerService.name);
  private readonly queryMetrics: Map<string, QueryMetrics[]> = new Map();
  private readonly slowQueryThreshold: number;
  private readonly maxStoredQueries: number;

  constructor(
${orm === 'typeorm' ? '    private readonly dataSource: DataSource,' : ''}
  ) {
    this.slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '100', 10);
    this.maxStoredQueries = parseInt(process.env.MAX_STORED_QUERIES || '1000', 10);
  }

  /**
   * Record query execution metrics
   */
  recordQuery(query: string, duration: number, rowsAffected?: number): void {
    const normalizedQuery = this.normalizeQuery(query);

    if (!this.queryMetrics.has(normalizedQuery)) {
      this.queryMetrics.set(normalizedQuery, []);
    }

    const metrics = this.queryMetrics.get(normalizedQuery)!;
    metrics.push({
      query,
      duration,
      rowsAffected,
      timestamp: new Date(),
    });

    // Keep only recent queries
    if (metrics.length > this.maxStoredQueries) {
      metrics.shift();
    }

    // Log slow queries
    if (duration > this.slowQueryThreshold) {
      this.logger.warn(\`Slow query detected (\${duration}ms): \${query.substring(0, 200)}...\`);
    }
  }

  /**
   * Normalize query for grouping (remove specific values)
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/= \\d+/g, '= ?')
      .replace(/= '[^']*'/g, "= '?'")
      .replace(/IN \\([^)]+\\)/gi, 'IN (?)')
      .replace(/LIMIT \\d+/gi, 'LIMIT ?')
      .replace(/OFFSET \\d+/gi, 'OFFSET ?')
      .trim();
  }

  /**
   * Get slow query report
   */
  getSlowQueryReport(thresholdMs?: number): SlowQueryReport[] {
    const threshold = thresholdMs || this.slowQueryThreshold;
    const reports: SlowQueryReport[] = [];

    this.queryMetrics.forEach((metrics, normalizedQuery) => {
      const slowQueries = metrics.filter((m) => m.duration > threshold);

      if (slowQueries.length > 0) {
        const durations = slowQueries.map((m) => m.duration);
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const maxDuration = Math.max(...durations);

        reports.push({
          query: normalizedQuery,
          avgDuration: Math.round(avgDuration),
          maxDuration,
          count: slowQueries.length,
          suggestion: this.generateSuggestion(normalizedQuery, avgDuration),
        });
      }
    });

    return reports.sort((a, b) => b.avgDuration - a.avgDuration);
  }

  /**
   * Generate optimization suggestion for a query
   */
  private generateSuggestion(query: string, avgDuration: number): string {
    const suggestions: string[] = [];
    const upperQuery = query.toUpperCase();

    // Check for SELECT *
    if (upperQuery.includes('SELECT *')) {
      suggestions.push('Avoid SELECT *, specify only needed columns');
    }

    // Check for missing WHERE clause
    if (!upperQuery.includes('WHERE') && (upperQuery.includes('UPDATE') || upperQuery.includes('DELETE'))) {
      suggestions.push('Missing WHERE clause - full table scan');
    }

    // Check for LIKE with leading wildcard
    if (upperQuery.includes("LIKE '%") || upperQuery.includes("LIKE '?%")) {
      suggestions.push('Leading wildcard in LIKE prevents index usage');
    }

    // Check for OR conditions
    if (upperQuery.includes(' OR ')) {
      suggestions.push('Consider using UNION instead of OR for better index usage');
    }

    // Check for NOT IN
    if (upperQuery.includes('NOT IN')) {
      suggestions.push('Consider using NOT EXISTS instead of NOT IN');
    }

    // Check for functions on indexed columns
    if (/WHERE\\s+\\w+\\s*\\(/.test(query)) {
      suggestions.push('Functions on columns prevent index usage');
    }

    // Check for ORDER BY without LIMIT
    if (upperQuery.includes('ORDER BY') && !upperQuery.includes('LIMIT')) {
      suggestions.push('ORDER BY without LIMIT may cause full result set sorting');
    }

    // Duration-based suggestions
    if (avgDuration > 1000) {
      suggestions.push('Consider query restructuring or adding composite index');
    } else if (avgDuration > 500) {
      suggestions.push('Review indexes on filtered/joined columns');
    }

    return suggestions.length > 0 ? suggestions.join('; ') : 'Profile query execution plan for detailed analysis';
  }
${orm === 'typeorm' ? `
  /**
   * Analyze query with EXPLAIN
   */
  async explainQuery(query: string): Promise<ExplainResult | null> {
    try {
      const result = await this.dataSource.query(\`EXPLAIN \${query}\`);
      if (result && result.length > 0) {
        return {
          type: result[0].type || result[0].select_type,
          possibleKeys: result[0].possible_keys?.split(','),
          key: result[0].key,
          rows: result[0].rows,
          filtered: result[0].filtered,
          extra: result[0].Extra,
        };
      }
      return null;
    } catch (error) {
      this.logger.error(\`Failed to explain query: \${error}\`);
      return null;
    }
  }
` : ''}
  /**
   * Suggest indexes based on query patterns
   */
  suggestIndexes(): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];
    const tableColumns: Map<string, Set<string>> = new Map();

    // Analyze WHERE and JOIN clauses
    this.queryMetrics.forEach((metrics, normalizedQuery) => {
      const avgDuration = metrics.reduce((a, m) => a + m.duration, 0) / metrics.length;

      if (avgDuration > this.slowQueryThreshold) {
        // Extract table and column from WHERE clauses
        const whereMatches = normalizedQuery.matchAll(/FROM\\s+(\\w+).*?WHERE.*?(\\w+)\\s*=/gi);
        for (const match of whereMatches) {
          const table = match[1];
          const column = match[2];

          if (!tableColumns.has(table)) {
            tableColumns.set(table, new Set());
          }
          tableColumns.get(table)!.add(column);
        }

        // Extract JOIN conditions
        const joinMatches = normalizedQuery.matchAll(/JOIN\\s+(\\w+).*?ON.*?(\\w+)\\s*=/gi);
        for (const match of joinMatches) {
          const table = match[1];
          const column = match[2];

          if (!tableColumns.has(table)) {
            tableColumns.set(table, new Set());
          }
          tableColumns.get(table)!.add(column);
        }
      }
    });

    // Generate index suggestions
    tableColumns.forEach((columns, table) => {
      if (columns.size > 0) {
        suggestions.push({
          table,
          columns: Array.from(columns),
          reason: \`Frequently used in WHERE/JOIN conditions on slow queries\`,
          impact: columns.size > 2 ? 'high' : columns.size > 1 ? 'medium' : 'low',
        });
      }
    });

    return suggestions.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      return impactOrder[a.impact] - impactOrder[b.impact];
    });
  }

  /**
   * Get query statistics
   */
  getStatistics(): {
    totalQueries: number;
    uniqueQueries: number;
    slowQueries: number;
    avgDuration: number;
  } {
    let totalQueries = 0;
    let slowQueries = 0;
    let totalDuration = 0;

    this.queryMetrics.forEach((metrics) => {
      totalQueries += metrics.length;
      metrics.forEach((m) => {
        totalDuration += m.duration;
        if (m.duration > this.slowQueryThreshold) {
          slowQueries++;
        }
      });
    });

    return {
      totalQueries,
      uniqueQueries: this.queryMetrics.size,
      slowQueries,
      avgDuration: totalQueries > 0 ? Math.round(totalDuration / totalQueries) : 0,
    };
  }

  /**
   * Clear collected metrics
   */
  clearMetrics(): void {
    this.queryMetrics.clear();
  }
}
`;
    fs.writeFileSync(path.join(baseDir, 'query-analyzer.ts'), queryAnalyzerContent);

    // Query interceptor for automatic tracking
    const queryInterceptorContent = `import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { QueryAnalyzerService } from './query-analyzer';

/**
 * Interceptor to automatically track query execution times
 */
@Injectable()
export class QueryTrackingInterceptor implements NestInterceptor {
  constructor(private readonly queryAnalyzer: QueryAnalyzerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const request = context.switchToHttp().getRequest();
          const query = \`\${request.method} \${request.url}\`;

          // Track as a pseudo-query for endpoint performance
          this.queryAnalyzer.recordQuery(query, duration);
        },
        error: () => {
          const duration = Date.now() - startTime;
          const request = context.switchToHttp().getRequest();
          const query = \`\${request.method} \${request.url} [ERROR]\`;

          this.queryAnalyzer.recordQuery(query, duration);
        },
      }),
    );
  }
}
`;
    fs.writeFileSync(path.join(baseDir, 'query-tracking.interceptor.ts'), queryInterceptorContent);
  }

  // Connection pool optimizer
  const connectionPoolContent = `import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

interface PoolConfig {
  min: number;
  max: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  reapIntervalMs: number;
}

interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  avgAcquireTime: number;
}

/**
 * Connection pool optimizer with adaptive sizing
 */
@Injectable()
export class ConnectionPoolOptimizer implements OnModuleInit {
  private readonly logger = new Logger(ConnectionPoolOptimizer.name);
  private metrics: PoolMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    avgAcquireTime: 0,
  };
  private acquireTimes: number[] = [];
  private readonly maxAcquireTimeSamples = 100;

  async onModuleInit(): Promise<void> {
    this.logger.log('Connection pool optimizer initialized');
  }

  /**
   * Get optimal pool configuration based on workload
   */
  getOptimalConfig(currentConfig: PoolConfig, cpuCount: number = 4): PoolConfig {
    // Formula: connections = (core_count * 2) + effective_spindle_count
    // For SSDs, effective_spindle_count is typically 1
    const optimalMax = Math.min(cpuCount * 2 + 1, 20);
    const optimalMin = Math.max(Math.floor(optimalMax / 4), 2);

    return {
      min: optimalMin,
      max: optimalMax,
      acquireTimeoutMs: Math.max(currentConfig.acquireTimeoutMs, 10000),
      idleTimeoutMs: currentConfig.idleTimeoutMs || 30000,
      reapIntervalMs: currentConfig.reapIntervalMs || 1000,
    };
  }

  /**
   * Record connection acquire time
   */
  recordAcquireTime(timeMs: number): void {
    this.acquireTimes.push(timeMs);

    if (this.acquireTimes.length > this.maxAcquireTimeSamples) {
      this.acquireTimes.shift();
    }

    this.metrics.avgAcquireTime =
      this.acquireTimes.reduce((a, b) => a + b, 0) / this.acquireTimes.length;

    // Warn if acquire time is high
    if (timeMs > 1000) {
      this.logger.warn(\`High connection acquire time: \${timeMs}ms. Consider increasing pool size.\`);
    }
  }

  /**
   * Update pool metrics
   */
  updateMetrics(metrics: Partial<PoolMetrics>): void {
    this.metrics = { ...this.metrics, ...metrics };

    // Log warnings based on metrics
    if (this.metrics.waitingRequests > 0) {
      this.logger.warn(\`\${this.metrics.waitingRequests} requests waiting for connections\`);
    }

    if (this.metrics.activeConnections === this.metrics.totalConnections) {
      this.logger.warn('Connection pool exhausted - all connections in use');
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Should pool be scaled up?
   */
  shouldScaleUp(currentMax: number): boolean {
    const utilizationRatio = this.metrics.activeConnections / this.metrics.totalConnections;
    return (
      utilizationRatio > 0.8 ||
      this.metrics.waitingRequests > 0 ||
      this.metrics.avgAcquireTime > 500
    );
  }

  /**
   * Should pool be scaled down?
   */
  shouldScaleDown(currentMin: number): boolean {
    const utilizationRatio = this.metrics.activeConnections / this.metrics.totalConnections;
    return (
      utilizationRatio < 0.2 &&
      this.metrics.waitingRequests === 0 &&
      this.metrics.idleConnections > currentMin
    );
  }
}
`;
  fs.writeFileSync(path.join(baseDir, 'connection-pool-optimizer.ts'), connectionPoolContent);

  console.log(chalk.green(`  ✓ Created connection pool optimizer`));

  console.log(chalk.bold.green(`\n✅ Database optimization setup complete for ${pascalName}`));
  console.log(chalk.cyan(`Generated files in: ${baseDir}`));
  if (includeDataLoader) {
    console.log(chalk.gray('  - data-loader.ts (DataLoader factory and decorators)'));
  }
  if (includeQueryAnalyzer) {
    console.log(chalk.gray('  - query-analyzer.ts (Query performance analysis)'));
    console.log(chalk.gray('  - query-tracking.interceptor.ts (Automatic query tracking)'));
  }
  console.log(chalk.gray('  - connection-pool-optimizer.ts (Adaptive pool sizing)'));
}
