/**
 * Distributed Tracing & Observability Generator
 * OpenTelemetry integration for microservices
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface ObservabilityOptions {
  path?: string;
  provider?: 'jaeger' | 'zipkin' | 'datadog' | 'otlp';
  serviceName?: string;
}

export async function setupObservability(
  basePath: string,
  options: ObservabilityOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n📊 Setting up Observability & Tracing\n'));

  const sharedPath = path.join(basePath, 'src/shared/observability');

  if (!fs.existsSync(sharedPath)) {
    fs.mkdirSync(sharedPath, { recursive: true });
  }

  // Generate tracing setup
  fs.writeFileSync(path.join(sharedPath, 'tracing.setup.ts'), generateTracingSetup(options));
  console.log(chalk.green(`  ✓ Created tracing setup`));

  // Generate span decorator
  fs.writeFileSync(path.join(sharedPath, 'span.decorator.ts'), generateSpanDecorator());
  console.log(chalk.green(`  ✓ Created span decorator`));

  // Generate trace interceptor
  fs.writeFileSync(path.join(sharedPath, 'trace.interceptor.ts'), generateTraceInterceptor());
  console.log(chalk.green(`  ✓ Created trace interceptor`));

  // Generate context propagation
  fs.writeFileSync(path.join(sharedPath, 'trace-context.ts'), generateTraceContext());
  console.log(chalk.green(`  ✓ Created trace context`));

  // Generate metrics collector
  fs.writeFileSync(path.join(sharedPath, 'metrics.ts'), generateMetrics());
  console.log(chalk.green(`  ✓ Created metrics`));

  // Generate observability module
  fs.writeFileSync(path.join(sharedPath, 'observability.module.ts'), generateObservabilityModule());
  console.log(chalk.green(`  ✓ Created observability module`));

  console.log(chalk.bold.green('\n✅ Observability & tracing ready!\n'));
}

function generateTracingSetup(options: ObservabilityOptions): string {
  const provider = options.provider || 'otlp';
  const serviceName = options.serviceName || 'my-service';

  return `/**
 * OpenTelemetry Tracing Setup
 * Initialize distributed tracing for the application
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { trace, context, SpanKind, SpanStatusCode, Span } from '@opentelemetry/api';

export interface TracingConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  exporterUrl?: string;
  samplingRatio?: number;
}

const DEFAULT_CONFIG: TracingConfig = {
  serviceName: '${serviceName}',
  serviceVersion: '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  exporterUrl: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  samplingRatio: 1.0,
};

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry tracing
 */
export async function initTracing(config: Partial<TracingConfig> = {}): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const exporter = new OTLPTraceExporter({
    url: finalConfig.exporterUrl,
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: finalConfig.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: finalConfig.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: finalConfig.environment,
    }),
    spanProcessor: new BatchSpanProcessor(exporter),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  await sdk.start();
  console.log('Tracing initialized for', finalConfig.serviceName);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await sdk?.shutdown();
  });
}

/**
 * Shutdown tracing
 */
export async function shutdownTracing(): Promise<void> {
  await sdk?.shutdown();
}

/**
 * Get the tracer
 */
export function getTracer(name: string = 'default') {
  return trace.getTracer(name);
}

/**
 * Create a new span
 */
export function createSpan(
  name: string,
  options: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  } = {},
): Span {
  const tracer = getTracer();
  return tracer.startSpan(name, {
    kind: options.kind || SpanKind.INTERNAL,
    attributes: options.attributes,
  });
}

/**
 * Run a function within a span
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  } = {},
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(name, {
    kind: options.kind || SpanKind.INTERNAL,
    attributes: options.attributes,
  });

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Get current span
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getSpan(context.active());
}

/**
 * Add attributes to current span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = getCurrentSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Record an event on current span
 */
export function recordSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
  const span = getCurrentSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}
`;
}

function generateSpanDecorator(): string {
  return `/**
 * Span Decorator
 * Automatically create spans for methods
 */

import { trace, SpanKind, SpanStatusCode, context } from '@opentelemetry/api';

export interface SpanOptions {
  name?: string;
  kind?: SpanKind;
  attributes?: Record<string, string | number | boolean>;
  recordArgs?: boolean;
  recordResult?: boolean;
}

/**
 * Span decorator for automatic span creation
 */
export function Span(options: SpanOptions = {}): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const spanName = options.name || \`\${className}.\${methodName}\`;

    descriptor.value = async function (...args: any[]) {
      const tracer = trace.getTracer('application');
      const span = tracer.startSpan(spanName, {
        kind: options.kind || SpanKind.INTERNAL,
        attributes: {
          'code.function': methodName,
          'code.namespace': className,
          ...options.attributes,
        },
      });

      if (options.recordArgs) {
        try {
          span.setAttribute('args', JSON.stringify(args));
        } catch {
          // Ignore serialization errors
        }
      }

      try {
        const result = await context.with(
          trace.setSpan(context.active(), span),
          () => originalMethod.apply(this, args),
        );

        if (options.recordResult) {
          try {
            span.setAttribute('result', JSON.stringify(result));
          } catch {
            // Ignore serialization errors
          }
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}

/**
 * Trace incoming requests
 */
export function TraceIncoming(options: SpanOptions = {}): MethodDecorator {
  return Span({ ...options, kind: SpanKind.SERVER });
}

/**
 * Trace outgoing requests
 */
export function TraceOutgoing(options: SpanOptions = {}): MethodDecorator {
  return Span({ ...options, kind: SpanKind.CLIENT });
}

/**
 * Trace internal operations
 */
export function TraceInternal(options: SpanOptions = {}): MethodDecorator {
  return Span({ ...options, kind: SpanKind.INTERNAL });
}
`;
}

function generateTraceInterceptor(): string {
  return `/**
 * Trace Interceptor
 * Automatically trace all HTTP requests
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { trace, SpanKind, SpanStatusCode, context } from '@opentelemetry/api';

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const request = ctx.switchToHttp().getRequest();
    const response = ctx.switchToHttp().getResponse();
    const tracer = trace.getTracer('http');

    const span = tracer.startSpan(\`HTTP \${request.method} \${request.route?.path || request.path}\`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'http.route': request.route?.path,
        'http.user_agent': request.headers['user-agent'],
        'http.client_ip': request.ip,
      },
    });

    // Add trace headers for propagation
    const traceId = span.spanContext().traceId;
    const spanId = span.spanContext().spanId;
    response.setHeader('X-Trace-Id', traceId);
    response.setHeader('X-Span-Id', spanId);

    return context.with(trace.setSpan(context.active(), span), () => {
      return next.handle().pipe(
        tap({
          next: () => {
            span.setAttribute('http.status_code', response.statusCode);
            span.setStatus({ code: SpanStatusCode.OK });
          },
          error: (error) => {
            span.setAttribute('http.status_code', error.status || 500);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            span.recordException(error);
          },
          complete: () => {
            span.end();
          },
        }),
      );
    });
  }
}

/**
 * Trace context middleware
 */
export function traceContextMiddleware(req: any, res: any, next: () => void): void {
  const tracer = trace.getTracer('http');
  const span = tracer.startSpan(\`\${req.method} \${req.path}\`, {
    kind: SpanKind.SERVER,
  });

  req.span = span;
  req.traceId = span.spanContext().traceId;

  res.on('finish', () => {
    span.setAttribute('http.status_code', res.statusCode);
    span.end();
  });

  context.with(trace.setSpan(context.active(), span), next);
}
`;
}

function generateTraceContext(): string {
  return `/**
 * Trace Context Propagation
 * Handle trace context across service boundaries
 */

import { trace, context, propagation, SpanContext } from '@opentelemetry/api';

export interface TraceHeaders {
  'traceparent'?: string;
  'tracestate'?: string;
  'x-trace-id'?: string;
  'x-span-id'?: string;
  'x-request-id'?: string;
}

/**
 * Extract trace context from headers
 */
export function extractTraceContext(headers: Record<string, string | string[] | undefined>): void {
  const carrier: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      carrier[key.toLowerCase()] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      carrier[key.toLowerCase()] = value[0];
    }
  }

  propagation.extract(context.active(), carrier);
}

/**
 * Inject trace context into headers
 */
export function injectTraceContext(headers: Record<string, string> = {}): Record<string, string> {
  propagation.inject(context.active(), headers);
  return headers;
}

/**
 * Get current trace ID
 */
export function getCurrentTraceId(): string | undefined {
  const span = trace.getSpan(context.active());
  return span?.spanContext().traceId;
}

/**
 * Get current span ID
 */
export function getCurrentSpanId(): string | undefined {
  const span = trace.getSpan(context.active());
  return span?.spanContext().spanId;
}

/**
 * Create trace headers for outgoing requests
 */
export function createTraceHeaders(): TraceHeaders {
  const headers: TraceHeaders = {};
  injectTraceContext(headers as any);

  const traceId = getCurrentTraceId();
  const spanId = getCurrentSpanId();

  if (traceId) headers['x-trace-id'] = traceId;
  if (spanId) headers['x-span-id'] = spanId;

  return headers;
}

/**
 * Correlation ID manager
 */
export class CorrelationIdManager {
  private static readonly CORRELATION_ID_KEY = 'correlation-id';

  static get(): string | undefined {
    const span = trace.getSpan(context.active());
    return span?.spanContext().traceId;
  }

  static set(id: string): void {
    const span = trace.getSpan(context.active());
    span?.setAttribute(this.CORRELATION_ID_KEY, id);
  }

  static generate(): string {
    return \`\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }
}

/**
 * Request context for passing trace info
 */
export class RequestContext {
  private static readonly storage = new Map<string, any>();

  static set(key: string, value: any): void {
    const traceId = getCurrentTraceId() || 'default';
    const contextKey = \`\${traceId}:\${key}\`;
    this.storage.set(contextKey, value);
  }

  static get<T>(key: string): T | undefined {
    const traceId = getCurrentTraceId() || 'default';
    const contextKey = \`\${traceId}:\${key}\`;
    return this.storage.get(contextKey) as T;
  }

  static clear(): void {
    const traceId = getCurrentTraceId() || 'default';
    for (const key of this.storage.keys()) {
      if (key.startsWith(\`\${traceId}:\`)) {
        this.storage.delete(key);
      }
    }
  }
}
`;
}

function generateMetrics(): string {
  return `/**
 * Metrics Collection
 * Custom metrics for observability
 */

import { metrics, Counter, Histogram, UpDownCounter, Gauge } from '@opentelemetry/api';

export interface MetricLabels {
  [key: string]: string | number;
}

/**
 * Metrics registry
 */
export class MetricsRegistry {
  private readonly meter = metrics.getMeter('application');
  private readonly counters = new Map<string, Counter>();
  private readonly histograms = new Map<string, Histogram>();
  private readonly gauges = new Map<string, any>();

  /**
   * Get or create a counter
   */
  counter(name: string, description?: string): Counter {
    let counter = this.counters.get(name);
    if (!counter) {
      counter = this.meter.createCounter(name, { description });
      this.counters.set(name, counter);
    }
    return counter;
  }

  /**
   * Get or create a histogram
   */
  histogram(name: string, description?: string): Histogram {
    let histogram = this.histograms.get(name);
    if (!histogram) {
      histogram = this.meter.createHistogram(name, { description });
      this.histograms.set(name, histogram);
    }
    return histogram;
  }

  /**
   * Increment a counter
   */
  increment(name: string, value: number = 1, labels?: MetricLabels): void {
    this.counter(name).add(value, labels);
  }

  /**
   * Record a histogram value
   */
  record(name: string, value: number, labels?: MetricLabels): void {
    this.histogram(name).record(value, labels);
  }

  /**
   * Time a function execution
   */
  async time<T>(name: string, fn: () => Promise<T>, labels?: MetricLabels): Promise<T> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      this.record(name, Date.now() - start, labels);
    }
  }
}

/**
 * Default metrics registry
 */
export const metricsRegistry = new MetricsRegistry();

/**
 * Metric decorator
 */
export function Metric(name: string, type: 'counter' | 'histogram' = 'histogram'): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const labels = {
        class: target.constructor.name,
        method: String(propertyKey),
      };

      if (type === 'counter') {
        metricsRegistry.increment(name, 1, labels);
        return originalMethod.apply(this, args);
      }

      return metricsRegistry.time(\`\${name}_duration_ms\`, () => originalMethod.apply(this, args), labels);
    };

    return descriptor;
  };
}

/**
 * Common application metrics
 */
export const AppMetrics = {
  httpRequestsTotal: (method: string, path: string, status: number) => {
    metricsRegistry.increment('http_requests_total', 1, { method, path, status: String(status) });
  },

  httpRequestDuration: (method: string, path: string, durationMs: number) => {
    metricsRegistry.record('http_request_duration_ms', durationMs, { method, path });
  },

  dbQueryDuration: (operation: string, table: string, durationMs: number) => {
    metricsRegistry.record('db_query_duration_ms', durationMs, { operation, table });
  },

  externalCallDuration: (service: string, operation: string, durationMs: number) => {
    metricsRegistry.record('external_call_duration_ms', durationMs, { service, operation });
  },

  errorCount: (type: string, service: string) => {
    metricsRegistry.increment('errors_total', 1, { type, service });
  },

  cacheHit: (cache: string) => {
    metricsRegistry.increment('cache_hits_total', 1, { cache });
  },

  cacheMiss: (cache: string) => {
    metricsRegistry.increment('cache_misses_total', 1, { cache });
  },
};
`;
}

function generateObservabilityModule(): string {
  return `import { Module, Global, DynamicModule, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TraceInterceptor } from './trace.interceptor';
import { initTracing, shutdownTracing, TracingConfig } from './tracing.setup';
import { MetricsRegistry, metricsRegistry } from './metrics';

export interface ObservabilityModuleOptions {
  tracing?: Partial<TracingConfig>;
  enableHttpTracing?: boolean;
}

@Global()
@Module({})
export class ObservabilityModule implements OnModuleInit, OnModuleDestroy {
  static options: ObservabilityModuleOptions = {};

  static forRoot(options: ObservabilityModuleOptions = {}): DynamicModule {
    this.options = options;

    const providers: any[] = [
      {
        provide: 'OBSERVABILITY_OPTIONS',
        useValue: options,
      },
      {
        provide: MetricsRegistry,
        useValue: metricsRegistry,
      },
    ];

    if (options.enableHttpTracing !== false) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: TraceInterceptor,
      });
    }

    return {
      module: ObservabilityModule,
      providers,
      exports: [MetricsRegistry],
    };
  }

  async onModuleInit() {
    if (ObservabilityModule.options.tracing) {
      await initTracing(ObservabilityModule.options.tracing);
    }
  }

  async onModuleDestroy() {
    await shutdownTracing();
  }
}
`;
}
