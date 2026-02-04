import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { toPascalCase, toCamelCase, toKebabCase } from '../utils/naming.utils';

export interface MetricsPrometheusOptions {
  module?: string;
  customMetrics?: string[];
  includeDefaultMetrics?: boolean;
}

export async function setupMetricsPrometheus(
  basePath: string,
  options: MetricsPrometheusOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n📊 Setting up Prometheus Metrics\n'));

  const moduleName = options.module || 'shared';
  const pascalName = toPascalCase(moduleName);
  const camelName = toCamelCase(moduleName);
  const kebabName = toKebabCase(moduleName);
  const customMetrics = options.customMetrics || [];
  const includeDefaultMetrics = options.includeDefaultMetrics !== false;

  const baseDir = path.join(basePath, 'src', kebabName, 'infrastructure', 'metrics');
  fs.mkdirSync(baseDir, { recursive: true });

  // Metrics registry
  const metricsRegistryContent = `import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Gauge,
  Histogram,
  Summary,
  collectDefaultMetrics,
  Metric,
} from 'prom-client';

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricConfig {
  name: string;
  help: string;
  type: MetricType;
  labelNames?: string[];
  buckets?: number[]; // For histograms
  percentiles?: number[]; // For summaries
}

/**
 * Prometheus metrics registry and factory
 */
@Injectable()
export class MetricsRegistry implements OnModuleInit {
  private readonly registry: Registry;
  private readonly metrics: Map<string, Metric<string>> = new Map();

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({
      app: process.env.APP_NAME || '${kebabName}',
      env: process.env.NODE_ENV || 'development',
    });
  }

  async onModuleInit(): Promise<void> {
    ${includeDefaultMetrics ? `// Collect default Node.js metrics
    collectDefaultMetrics({
      register: this.registry,
      prefix: '${camelName}_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });` : '// Default metrics disabled'}
  }

  /**
   * Get the Prometheus registry
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsAsJson(): Promise<object> {
    return this.registry.getMetricsAsJSON();
  }

  /**
   * Create or get a counter
   */
  counter(config: Omit<MetricConfig, 'type'>): Counter<string> {
    const key = \`counter_\${config.name}\`;

    if (!this.metrics.has(key)) {
      const counter = new Counter({
        name: config.name,
        help: config.help,
        labelNames: config.labelNames || [],
        registers: [this.registry],
      });
      this.metrics.set(key, counter);
    }

    return this.metrics.get(key) as Counter<string>;
  }

  /**
   * Create or get a gauge
   */
  gauge(config: Omit<MetricConfig, 'type'>): Gauge<string> {
    const key = \`gauge_\${config.name}\`;

    if (!this.metrics.has(key)) {
      const gauge = new Gauge({
        name: config.name,
        help: config.help,
        labelNames: config.labelNames || [],
        registers: [this.registry],
      });
      this.metrics.set(key, gauge);
    }

    return this.metrics.get(key) as Gauge<string>;
  }

  /**
   * Create or get a histogram
   */
  histogram(config: Omit<MetricConfig, 'type'> & { buckets?: number[] }): Histogram<string> {
    const key = \`histogram_\${config.name}\`;

    if (!this.metrics.has(key)) {
      const histogram = new Histogram({
        name: config.name,
        help: config.help,
        labelNames: config.labelNames || [],
        buckets: config.buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        registers: [this.registry],
      });
      this.metrics.set(key, histogram);
    }

    return this.metrics.get(key) as Histogram<string>;
  }

  /**
   * Create or get a summary
   */
  summary(config: Omit<MetricConfig, 'type'> & { percentiles?: number[] }): Summary<string> {
    const key = \`summary_\${config.name}\`;

    if (!this.metrics.has(key)) {
      const summary = new Summary({
        name: config.name,
        help: config.help,
        labelNames: config.labelNames || [],
        percentiles: config.percentiles || [0.5, 0.9, 0.95, 0.99],
        registers: [this.registry],
      });
      this.metrics.set(key, summary);
    }

    return this.metrics.get(key) as Summary<string>;
  }

  /**
   * Remove a metric
   */
  removeMetric(name: string): void {
    this.registry.removeSingleMetric(name);
    // Remove from all type keys
    ['counter', 'gauge', 'histogram', 'summary'].forEach((type) => {
      this.metrics.delete(\`\${type}_\${name}\`);
    });
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.registry.clear();
    this.metrics.clear();
  }
}
`;
  fs.writeFileSync(path.join(baseDir, 'metrics-registry.ts'), metricsRegistryContent);

  // HTTP metrics interceptor
  const httpMetricsContent = `import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsRegistry } from './metrics-registry';
import { Counter, Histogram } from 'prom-client';

/**
 * HTTP request metrics interceptor
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  private readonly requestCounter: Counter<string>;
  private readonly requestDuration: Histogram<string>;
  private readonly requestSize: Histogram<string>;
  private readonly responseSize: Histogram<string>;

  constructor(private readonly metricsRegistry: MetricsRegistry) {
    this.requestCounter = this.metricsRegistry.counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
    });

    this.requestDuration = this.metricsRegistry.histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.requestSize = this.metricsRegistry.histogram({
      name: 'http_request_size_bytes',
      help: 'HTTP request size in bytes',
      labelNames: ['method', 'path'],
      buckets: [100, 1000, 10000, 100000, 1000000],
    });

    this.responseSize = this.metricsRegistry.histogram({
      name: 'http_response_size_bytes',
      help: 'HTTP response size in bytes',
      labelNames: ['method', 'path', 'status'],
      buckets: [100, 1000, 10000, 100000, 1000000],
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = process.hrtime();

    const method = request.method;
    const path = this.normalizePath(request.route?.path || request.url);

    // Record request size
    const contentLength = parseInt(request.headers['content-length'] || '0', 10);
    if (contentLength > 0) {
      this.requestSize.observe({ method, path }, contentLength);
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.recordMetrics(method, path, response.statusCode, startTime, data);
        },
        error: (error) => {
          const status = error.status || 500;
          this.recordMetrics(method, path, status, startTime);
        },
      }),
    );
  }

  private recordMetrics(
    method: string,
    path: string,
    status: number,
    startTime: [number, number],
    data?: any,
  ): void {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;

    const labels = { method, path, status: status.toString() };

    this.requestCounter.inc(labels);
    this.requestDuration.observe(labels, duration);

    // Estimate response size
    if (data) {
      const responseSize = JSON.stringify(data).length;
      this.responseSize.observe(labels, responseSize);
    }
  }

  private normalizePath(path: string): string {
    // Replace dynamic segments with placeholders
    return path
      .replace(/\\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
      .replace(/\\/\\d+/g, '/:id')
      .replace(/\\?.*/g, ''); // Remove query string
  }
}
`;
  fs.writeFileSync(path.join(baseDir, 'http-metrics.interceptor.ts'), httpMetricsContent);

  // Business metrics service
  const businessMetricsContent = `import { Injectable } from '@nestjs/common';
import { MetricsRegistry } from './metrics-registry';
import { Counter, Gauge, Histogram } from 'prom-client';

/**
 * Business-specific metrics for ${pascalName}
 */
@Injectable()
export class ${pascalName}MetricsService {
  // Counters
  private readonly operationsTotal: Counter<string>;
  private readonly errorsTotal: Counter<string>;
  private readonly eventsProcessed: Counter<string>;

  // Gauges
  private readonly activeUsers: Gauge<string>;
  private readonly queueSize: Gauge<string>;
  private readonly cacheHitRatio: Gauge<string>;

  // Histograms
  private readonly operationDuration: Histogram<string>;
  private readonly payloadSize: Histogram<string>;

  constructor(private readonly metricsRegistry: MetricsRegistry) {
    // Initialize counters
    this.operationsTotal = this.metricsRegistry.counter({
      name: '${camelName}_operations_total',
      help: 'Total number of ${camelName} operations',
      labelNames: ['operation', 'status'],
    });

    this.errorsTotal = this.metricsRegistry.counter({
      name: '${camelName}_errors_total',
      help: 'Total number of ${camelName} errors',
      labelNames: ['operation', 'error_type'],
    });

    this.eventsProcessed = this.metricsRegistry.counter({
      name: '${camelName}_events_processed_total',
      help: 'Total number of events processed',
      labelNames: ['event_type'],
    });

    // Initialize gauges
    this.activeUsers = this.metricsRegistry.gauge({
      name: '${camelName}_active_users',
      help: 'Number of currently active users',
    });

    this.queueSize = this.metricsRegistry.gauge({
      name: '${camelName}_queue_size',
      help: 'Current size of processing queue',
      labelNames: ['queue_name'],
    });

    this.cacheHitRatio = this.metricsRegistry.gauge({
      name: '${camelName}_cache_hit_ratio',
      help: 'Cache hit ratio (0-1)',
      labelNames: ['cache_name'],
    });

    // Initialize histograms
    this.operationDuration = this.metricsRegistry.histogram({
      name: '${camelName}_operation_duration_seconds',
      help: 'Duration of ${camelName} operations',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    });

    this.payloadSize = this.metricsRegistry.histogram({
      name: '${camelName}_payload_size_bytes',
      help: 'Size of ${camelName} payloads',
      labelNames: ['operation'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
    });
  }

  // ==================
  // Counter Methods
  // ==================

  /**
   * Increment operation counter
   */
  recordOperation(operation: string, status: 'success' | 'failure'): void {
    this.operationsTotal.inc({ operation, status });
  }

  /**
   * Record an error
   */
  recordError(operation: string, errorType: string): void {
    this.errorsTotal.inc({ operation, error_type: errorType });
  }

  /**
   * Record event processing
   */
  recordEventProcessed(eventType: string): void {
    this.eventsProcessed.inc({ event_type: eventType });
  }

  // ==================
  // Gauge Methods
  // ==================

  /**
   * Set active users count
   */
  setActiveUsers(count: number): void {
    this.activeUsers.set(count);
  }

  /**
   * Update queue size
   */
  setQueueSize(queueName: string, size: number): void {
    this.queueSize.set({ queue_name: queueName }, size);
  }

  /**
   * Update cache hit ratio
   */
  setCacheHitRatio(cacheName: string, ratio: number): void {
    this.cacheHitRatio.set({ cache_name: cacheName }, Math.min(1, Math.max(0, ratio)));
  }

  // ==================
  // Histogram Methods
  // ==================

  /**
   * Record operation duration
   */
  recordOperationDuration(operation: string, durationSeconds: number): void {
    this.operationDuration.observe({ operation }, durationSeconds);
  }

  /**
   * Record payload size
   */
  recordPayloadSize(operation: string, sizeBytes: number): void {
    this.payloadSize.observe({ operation }, sizeBytes);
  }

  /**
   * Create a timer for measuring operation duration
   */
  startTimer(operation: string): () => void {
    const startTime = process.hrtime();
    return () => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      this.recordOperationDuration(operation, duration);
    };
  }
}
`;
  fs.writeFileSync(path.join(baseDir, `${kebabName}-metrics.service.ts`), businessMetricsContent);

  // Metrics controller
  const metricsControllerContent = `import { Controller, Get, Res, Header } from '@nestjs/common';
import { Response } from 'express';
import { MetricsRegistry } from './metrics-registry';

/**
 * Prometheus metrics endpoint
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsRegistry: MetricsRegistry) {}

  /**
   * Get metrics in Prometheus format
   */
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsRegistry.getMetrics();
    res.send(metrics);
  }

  /**
   * Get metrics as JSON (for debugging)
   */
  @Get('json')
  async getMetricsJson(): Promise<object> {
    return this.metricsRegistry.getMetricsAsJson();
  }
}
`;
  fs.writeFileSync(path.join(baseDir, 'metrics.controller.ts'), metricsControllerContent);

  // Metrics decorator
  const metricsDecoratorContent = `import { SetMetadata } from '@nestjs/common';

export const METRICS_KEY = 'metrics';

export interface MetricsOptions {
  name?: string;
  labels?: Record<string, string>;
  recordDuration?: boolean;
  recordPayloadSize?: boolean;
}

/**
 * Decorator to automatically record metrics for a method
 */
export function RecordMetrics(options: MetricsOptions = {}): MethodDecorator {
  return SetMetadata(METRICS_KEY, options);
}

/**
 * Decorator to skip metrics recording
 */
export function SkipMetrics(): MethodDecorator {
  return SetMetadata(METRICS_KEY, { skip: true });
}
`;
  fs.writeFileSync(path.join(baseDir, 'metrics.decorator.ts'), metricsDecoratorContent);

  // Metrics module
  const metricsModuleContent = `import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsRegistry } from './metrics-registry';
import { MetricsController } from './metrics.controller';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { ${pascalName}MetricsService } from './${kebabName}-metrics.service';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsRegistry,
    ${pascalName}MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
  exports: [MetricsRegistry, ${pascalName}MetricsService],
})
export class ${pascalName}MetricsModule {}
`;
  fs.writeFileSync(path.join(baseDir, 'metrics.module.ts'), metricsModuleContent);

  // Grafana dashboard JSON
  const grafanaDashboardContent = `{
  "annotations": {
    "list": []
  },
  "title": "${pascalName} Metrics Dashboard",
  "uid": "${kebabName}-metrics",
  "version": 1,
  "panels": [
    {
      "title": "Request Rate",
      "type": "graph",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
      "targets": [
        {
          "expr": "rate(http_requests_total{app=\\"${kebabName}\\"}[5m])",
          "legendFormat": "{{method}} {{path}}"
        }
      ]
    },
    {
      "title": "Request Duration (p99)",
      "type": "graph",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
      "targets": [
        {
          "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{app=\\"${kebabName}\\"}[5m]))",
          "legendFormat": "{{method}} {{path}}"
        }
      ]
    },
    {
      "title": "Error Rate",
      "type": "graph",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
      "targets": [
        {
          "expr": "rate(${camelName}_errors_total[5m])",
          "legendFormat": "{{operation}} - {{error_type}}"
        }
      ]
    },
    {
      "title": "Active Users",
      "type": "stat",
      "gridPos": { "h": 4, "w": 6, "x": 12, "y": 8 },
      "targets": [
        {
          "expr": "${camelName}_active_users",
          "legendFormat": "Active Users"
        }
      ]
    },
    {
      "title": "Cache Hit Ratio",
      "type": "gauge",
      "gridPos": { "h": 4, "w": 6, "x": 18, "y": 8 },
      "targets": [
        {
          "expr": "${camelName}_cache_hit_ratio",
          "legendFormat": "{{cache_name}}"
        }
      ]
    },
    {
      "title": "Memory Usage",
      "type": "graph",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 16 },
      "targets": [
        {
          "expr": "${camelName}_nodejs_heap_size_used_bytes / 1024 / 1024",
          "legendFormat": "Heap Used (MB)"
        },
        {
          "expr": "${camelName}_nodejs_external_memory_bytes / 1024 / 1024",
          "legendFormat": "External (MB)"
        }
      ]
    },
    {
      "title": "Event Loop Lag",
      "type": "graph",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 16 },
      "targets": [
        {
          "expr": "${camelName}_nodejs_eventloop_lag_seconds",
          "legendFormat": "Event Loop Lag"
        }
      ]
    }
  ]
}
`;
  fs.writeFileSync(path.join(baseDir, 'grafana-dashboard.json'), grafanaDashboardContent);

  console.log(chalk.green(`  ✓ Created metrics registry`));
  console.log(chalk.green(`  ✓ Created HTTP metrics interceptor`));
  console.log(chalk.green(`  ✓ Created ${kebabName}-metrics.service.ts`));
  console.log(chalk.green(`  ✓ Created metrics controller`));
  console.log(chalk.green(`  ✓ Created metrics decorator`));
  console.log(chalk.green(`  ✓ Created metrics module`));
  console.log(chalk.green(`  ✓ Created Grafana dashboard`));

  console.log(chalk.bold.green(`\n✅ Prometheus metrics setup complete for ${pascalName}`));
  console.log(chalk.cyan(`Generated files in: ${baseDir}`));
  console.log(chalk.gray('  - metrics-registry.ts (Prometheus registry)'));
  console.log(chalk.gray('  - http-metrics.interceptor.ts (HTTP metrics)'));
  console.log(chalk.gray(`  - ${kebabName}-metrics.service.ts (Business metrics)`));
  console.log(chalk.gray('  - metrics.controller.ts (/metrics endpoint)'));
  console.log(chalk.gray('  - metrics.decorator.ts (Metrics decorators)'));
  console.log(chalk.gray('  - metrics.module.ts (Module definition)'));
  console.log(chalk.gray('  - grafana-dashboard.json (Grafana dashboard)'));
}
