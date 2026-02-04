/**
 * Circuit Breaker & Resilience Patterns Generator
 * Implements retry logic, timeout handling, and fallback strategies
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface ResilienceOptions {
  path?: string;
  includeCircuitBreaker?: boolean;
  includeRetry?: boolean;
  includeTimeout?: boolean;
  includeFallback?: boolean;
  includeBulkhead?: boolean;
}

export async function setupResiliencePatterns(
  basePath: string,
  options: ResilienceOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n🛡️ Setting up Resilience Patterns\n'));

  const sharedPath = path.join(basePath, 'src/shared/resilience');

  if (!fs.existsSync(sharedPath)) {
    fs.mkdirSync(sharedPath, { recursive: true });
  }

  // Generate circuit breaker
  fs.writeFileSync(path.join(sharedPath, 'circuit-breaker.ts'), generateCircuitBreaker());
  console.log(chalk.green(`  ✓ Created circuit breaker`));

  // Generate retry strategy
  fs.writeFileSync(path.join(sharedPath, 'retry.strategy.ts'), generateRetryStrategy());
  console.log(chalk.green(`  ✓ Created retry strategy`));

  // Generate timeout handler
  fs.writeFileSync(path.join(sharedPath, 'timeout.handler.ts'), generateTimeoutHandler());
  console.log(chalk.green(`  ✓ Created timeout handler`));

  // Generate fallback decorator
  fs.writeFileSync(path.join(sharedPath, 'fallback.decorator.ts'), generateFallbackDecorator());
  console.log(chalk.green(`  ✓ Created fallback decorator`));

  // Generate bulkhead pattern
  fs.writeFileSync(path.join(sharedPath, 'bulkhead.ts'), generateBulkhead());
  console.log(chalk.green(`  ✓ Created bulkhead pattern`));

  // Generate resilience module
  fs.writeFileSync(path.join(sharedPath, 'resilience.module.ts'), generateResilienceModule());
  console.log(chalk.green(`  ✓ Created resilience module`));

  // Generate resilience decorators
  fs.writeFileSync(path.join(sharedPath, 'resilience.decorators.ts'), generateResilienceDecorators());
  console.log(chalk.green(`  ✓ Created resilience decorators`));

  console.log(chalk.bold.green('\n✅ Resilience patterns ready!\n'));
}

function generateCircuitBreaker(): string {
  return `/**
 * Circuit Breaker Implementation
 * Prevents cascading failures in distributed systems
 */

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // ms before trying again
  resetTimeout?: number;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  onSuccess?: () => void;
  onFailure?: (error: Error) => void;
}

export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number = 0;
  private nextAttempt: number = 0;

  constructor(
    private readonly options: CircuitBreakerOptions,
    private readonly eventEmitter?: EventEmitter2,
  ) {}

  get currentState(): CircuitState {
    return this.state;
  }

  get isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  get isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  get isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new CircuitOpenError(
          \`Circuit \${this.options.name} is open. Retry after \${this.nextAttempt - Date.now()}ms\`,
        );
      }
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }

    this.options.onSuccess?.();
  }

  private onFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (
      this.state === CircuitState.CLOSED &&
      this.failureCount >= this.options.failureThreshold
    ) {
      this.transitionTo(CircuitState.OPEN);
    }

    this.options.onFailure?.(error);
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.nextAttempt = Date.now() + this.options.timeout;
    }

    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    }

    this.logger.log(\`Circuit \${this.options.name}: \${oldState} -> \${newState}\`);

    this.options.onStateChange?.(oldState, newState);
    this.eventEmitter?.emit('circuit-breaker.state-change', {
      name: this.options.name,
      from: oldState,
      to: newState,
      timestamp: new Date(),
    });
  }

  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  getStats(): CircuitBreakerStats {
    return {
      name: this.options.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : null,
      nextAttempt: this.nextAttempt ? new Date(this.nextAttempt) : null,
    };
  }
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  nextAttempt: Date | null;
}

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Circuit Breaker Registry
 */
export class CircuitBreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(private readonly eventEmitter?: EventEmitter2) {}

  getOrCreate(options: CircuitBreakerOptions): CircuitBreaker {
    let breaker = this.breakers.get(options.name);
    if (!breaker) {
      breaker = new CircuitBreaker(options, this.eventEmitter);
      this.breakers.set(options.name, breaker);
    }
    return breaker;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getAll(): CircuitBreaker[] {
    return Array.from(this.breakers.values());
  }

  getAllStats(): CircuitBreakerStats[] {
    return this.getAll().map(b => b.getStats());
  }

  resetAll(): void {
    this.breakers.forEach(b => b.reset());
  }
}
`;
}

function generateRetryStrategy(): string {
  return `/**
 * Retry Strategy Implementation
 * Configurable retry logic with backoff strategies
 */

import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts: number;
  delay: number; // base delay in ms
  backoffMultiplier?: number;
  maxDelay?: number;
  retryOn?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  jitter?: boolean;
}

export type BackoffStrategy = 'fixed' | 'exponential' | 'linear' | 'fibonacci';

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delay: 1000,
  backoffMultiplier: 2,
  maxDelay: 30000,
  jitter: true,
};

export class RetryStrategy {
  private readonly logger = new Logger(RetryStrategy.name);
  private readonly options: RetryOptions;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === this.options.maxAttempts) {
          break;
        }

        if (this.options.retryOn && !this.options.retryOn(lastError)) {
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);
        this.logger.warn(
          \`Attempt \${attempt} failed. Retrying in \${delay}ms...\`,
        );

        this.options.onRetry?.(attempt, lastError, delay);
        await this.sleep(delay);
      }
    }

    throw new RetryExhaustedError(
      \`All \${this.options.maxAttempts} retry attempts failed\`,
      lastError!,
    );
  }

  private calculateDelay(attempt: number): number {
    let delay = this.options.delay * Math.pow(this.options.backoffMultiplier || 2, attempt - 1);

    if (this.options.maxDelay) {
      delay = Math.min(delay, this.options.maxDelay);
    }

    if (this.options.jitter) {
      delay = delay * (0.5 + Math.random());
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class RetryExhaustedError extends Error {
  constructor(message: string, public readonly lastError: Error) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

/**
 * Retry with exponential backoff
 */
export function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  return new RetryStrategy(options).execute(fn);
}

/**
 * Retry decorator factory
 */
export function Retry(options?: Partial<RetryOptions>): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const strategy = new RetryStrategy(options);

    descriptor.value = async function (...args: any[]) {
      return strategy.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Fibonacci backoff calculator
 */
export function fibonacciDelay(attempt: number, baseDelay: number): number {
  const fib = [1, 1];
  for (let i = 2; i <= attempt; i++) {
    fib[i] = fib[i - 1] + fib[i - 2];
  }
  return fib[attempt] * baseDelay;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'];
  const retryableMessages = ['timeout', 'network', 'connection', '503', '502', '429'];

  if ((error as any).code && retryableCodes.includes((error as any).code)) {
    return true;
  }

  const message = error.message.toLowerCase();
  return retryableMessages.some(m => message.includes(m));
}
`;
}

function generateTimeoutHandler(): string {
  return `/**
 * Timeout Handler Implementation
 * Prevents hanging operations with configurable timeouts
 */

import { Logger } from '@nestjs/common';

export interface TimeoutOptions {
  timeout: number; // ms
  onTimeout?: () => void;
  message?: string;
}

export class TimeoutHandler {
  private readonly logger = new Logger(TimeoutHandler.name);

  async execute<T>(fn: () => Promise<T>, options: TimeoutOptions): Promise<T> {
    const { timeout, onTimeout, message } = options;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        onTimeout?.();
        reject(new TimeoutError(message || \`Operation timed out after \${timeout}ms\`));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Execute with timeout
 */
export function withTimeout<T>(
  fn: () => Promise<T>,
  timeout: number,
  message?: string,
): Promise<T> {
  return new TimeoutHandler().execute(fn, { timeout, message });
}

/**
 * Timeout decorator factory
 */
export function Timeout(ms: number, message?: string): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const handler = new TimeoutHandler();

    descriptor.value = async function (...args: any[]) {
      return handler.execute(
        () => originalMethod.apply(this, args),
        { timeout: ms, message: message || \`\${String(propertyKey)} timed out after \${ms}ms\` },
      );
    };

    return descriptor;
  };
}

/**
 * Race multiple promises with timeout
 */
export async function raceWithTimeout<T>(
  promises: Promise<T>[],
  timeout: number,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new TimeoutError(\`Race timed out after \${timeout}ms\`)), timeout);
  });

  return Promise.race([...promises, timeoutPromise]);
}

/**
 * Deadline-based timeout
 */
export class Deadline {
  private readonly deadline: number;

  constructor(timeout: number) {
    this.deadline = Date.now() + timeout;
  }

  get remaining(): number {
    return Math.max(0, this.deadline - Date.now());
  }

  get exceeded(): boolean {
    return Date.now() > this.deadline;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.exceeded) {
      throw new TimeoutError('Deadline already exceeded');
    }
    return withTimeout(fn, this.remaining);
  }
}
`;
}

function generateFallbackDecorator(): string {
  return `/**
 * Fallback Pattern Implementation
 * Provides graceful degradation when primary operations fail
 */

import { Logger } from '@nestjs/common';

export interface FallbackOptions<T> {
  fallback: T | (() => T) | (() => Promise<T>);
  onFallback?: (error: Error) => void;
  shouldFallback?: (error: Error) => boolean;
}

export class FallbackHandler<T> {
  private readonly logger = new Logger(FallbackHandler.name);

  constructor(private readonly options: FallbackOptions<T>) {}

  async execute(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (this.options.shouldFallback && !this.options.shouldFallback(error as Error)) {
        throw error;
      }

      this.logger.warn(\`Operation failed, using fallback: \${(error as Error).message}\`);
      this.options.onFallback?.(error as Error);

      return this.resolveFallback();
    }
  }

  private async resolveFallback(): Promise<T> {
    const { fallback } = this.options;

    if (typeof fallback === 'function') {
      return (fallback as () => T | Promise<T>)();
    }

    return fallback;
  }
}

/**
 * Fallback decorator factory
 */
export function Fallback<T>(
  fallbackValue: T | (() => T) | (() => Promise<T>),
  options?: Omit<FallbackOptions<T>, 'fallback'>,
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const handler = new FallbackHandler({ fallback: fallbackValue, ...options });

    descriptor.value = async function (...args: any[]) {
      return handler.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Execute with fallback
 */
export function withFallback<T>(
  fn: () => Promise<T>,
  fallback: T | (() => T) | (() => Promise<T>),
): Promise<T> {
  return new FallbackHandler({ fallback }).execute(fn);
}

/**
 * Cache-based fallback
 */
export class CachedFallback<T> {
  private cache: T | null = null;
  private cacheTime: number = 0;

  constructor(private readonly ttl: number = 60000) {}

  async execute(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      this.cache = result;
      this.cacheTime = Date.now();
      return result;
    } catch (error) {
      if (this.cache !== null && Date.now() - this.cacheTime < this.ttl) {
        return this.cache;
      }
      throw error;
    }
  }

  invalidate(): void {
    this.cache = null;
    this.cacheTime = 0;
  }
}

/**
 * Multi-tier fallback
 */
export class FallbackChain<T> {
  private readonly handlers: Array<() => Promise<T>> = [];

  addHandler(handler: () => Promise<T>): this {
    this.handlers.push(handler);
    return this;
  }

  async execute(): Promise<T> {
    let lastError: Error | null = null;

    for (const handler of this.handlers) {
      try {
        return await handler();
      } catch (error) {
        lastError = error as Error;
      }
    }

    throw new FallbackExhaustedError('All fallback handlers failed', lastError!);
  }
}

export class FallbackExhaustedError extends Error {
  constructor(message: string, public readonly lastError: Error) {
    super(message);
    this.name = 'FallbackExhaustedError';
  }
}
`;
}

function generateBulkhead(): string {
  return `/**
 * Bulkhead Pattern Implementation
 * Isolates failures by limiting concurrent operations
 */

import { Logger } from '@nestjs/common';

export interface BulkheadOptions {
  name: string;
  maxConcurrent: number;
  maxQueue?: number;
  timeout?: number;
  onReject?: () => void;
}

export class Bulkhead {
  private readonly logger = new Logger(Bulkhead.name);
  private activeCount = 0;
  private readonly queue: Array<{
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    fn: () => Promise<any>;
    timer?: NodeJS.Timeout;
  }> = [];

  constructor(private readonly options: BulkheadOptions) {}

  get availableSlots(): number {
    return this.options.maxConcurrent - this.activeCount;
  }

  get queueSize(): number {
    return this.queue.length;
  }

  get isFull(): boolean {
    return this.activeCount >= this.options.maxConcurrent;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount < this.options.maxConcurrent) {
      return this.executeNow(fn);
    }

    if (this.options.maxQueue && this.queue.length >= this.options.maxQueue) {
      this.options.onReject?.();
      throw new BulkheadRejectError(
        \`Bulkhead \${this.options.name} is full (active: \${this.activeCount}, queued: \${this.queue.length})\`,
      );
    }

    return this.enqueue(fn);
  }

  private async executeNow<T>(fn: () => Promise<T>): Promise<T> {
    this.activeCount++;

    try {
      return await fn();
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const item: any = { resolve, reject, fn };

      if (this.options.timeout) {
        item.timer = setTimeout(() => {
          const index = this.queue.indexOf(item);
          if (index !== -1) {
            this.queue.splice(index, 1);
            reject(new BulkheadTimeoutError(\`Bulkhead \${this.options.name} queue timeout\`));
          }
        }, this.options.timeout);
      }

      this.queue.push(item);
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.activeCount >= this.options.maxConcurrent) {
      return;
    }

    const item = this.queue.shift()!;
    if (item.timer) {
      clearTimeout(item.timer);
    }

    this.executeNow(item.fn)
      .then(item.resolve)
      .catch(item.reject);
  }

  getStats(): BulkheadStats {
    return {
      name: this.options.name,
      activeCount: this.activeCount,
      queueSize: this.queue.length,
      maxConcurrent: this.options.maxConcurrent,
      maxQueue: this.options.maxQueue || 0,
      availableSlots: this.availableSlots,
    };
  }
}

export interface BulkheadStats {
  name: string;
  activeCount: number;
  queueSize: number;
  maxConcurrent: number;
  maxQueue: number;
  availableSlots: number;
}

export class BulkheadRejectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadRejectError';
  }
}

export class BulkheadTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadTimeoutError';
  }
}

/**
 * Bulkhead Registry
 */
export class BulkheadRegistry {
  private readonly bulkheads = new Map<string, Bulkhead>();

  getOrCreate(options: BulkheadOptions): Bulkhead {
    let bulkhead = this.bulkheads.get(options.name);
    if (!bulkhead) {
      bulkhead = new Bulkhead(options);
      this.bulkheads.set(options.name, bulkhead);
    }
    return bulkhead;
  }

  get(name: string): Bulkhead | undefined {
    return this.bulkheads.get(name);
  }

  getAllStats(): BulkheadStats[] {
    return Array.from(this.bulkheads.values()).map(b => b.getStats());
  }
}

/**
 * Bulkhead decorator factory
 */
export function BulkheadLimit(options: BulkheadOptions): MethodDecorator {
  const bulkhead = new Bulkhead(options);

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return bulkhead.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
`;
}

function generateResilienceModule(): string {
  return `import { Module, Global, DynamicModule } from '@nestjs/common';
import { CircuitBreakerRegistry } from './circuit-breaker';
import { BulkheadRegistry } from './bulkhead';

export interface ResilienceModuleOptions {
  circuitBreaker?: {
    defaultFailureThreshold?: number;
    defaultSuccessThreshold?: number;
    defaultTimeout?: number;
  };
  bulkhead?: {
    defaultMaxConcurrent?: number;
    defaultMaxQueue?: number;
  };
}

@Global()
@Module({})
export class ResilienceModule {
  static forRoot(options: ResilienceModuleOptions = {}): DynamicModule {
    return {
      module: ResilienceModule,
      providers: [
        {
          provide: 'RESILIENCE_OPTIONS',
          useValue: options,
        },
        {
          provide: CircuitBreakerRegistry,
          useFactory: () => new CircuitBreakerRegistry(),
        },
        {
          provide: BulkheadRegistry,
          useFactory: () => new BulkheadRegistry(),
        },
      ],
      exports: [CircuitBreakerRegistry, BulkheadRegistry],
    };
  }
}
`;
}

function generateResilienceDecorators(): string {
  return `/**
 * Combined Resilience Decorators
 * Apply multiple resilience patterns at once
 */

import { CircuitBreaker, CircuitBreakerOptions } from './circuit-breaker';
import { RetryStrategy, RetryOptions } from './retry.strategy';
import { TimeoutHandler, TimeoutOptions } from './timeout.handler';
import { FallbackHandler, FallbackOptions } from './fallback.decorator';
import { Bulkhead, BulkheadOptions } from './bulkhead';

export interface ResilientOptions {
  circuitBreaker?: Partial<CircuitBreakerOptions>;
  retry?: Partial<RetryOptions>;
  timeout?: number;
  fallback?: any;
  bulkhead?: Partial<BulkheadOptions>;
}

/**
 * Combined resilience decorator
 * Applies circuit breaker, retry, timeout, fallback, and bulkhead
 */
export function Resilient(options: ResilientOptions): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);

    // Create handlers
    const circuitBreaker = options.circuitBreaker
      ? new CircuitBreaker({
          name: \`\${target.constructor.name}.\${methodName}\`,
          failureThreshold: options.circuitBreaker.failureThreshold || 5,
          successThreshold: options.circuitBreaker.successThreshold || 2,
          timeout: options.circuitBreaker.timeout || 30000,
          ...options.circuitBreaker,
        })
      : null;

    const retry = options.retry ? new RetryStrategy(options.retry) : null;
    const timeout = options.timeout ? new TimeoutHandler() : null;
    const fallback = options.fallback !== undefined
      ? new FallbackHandler({ fallback: options.fallback })
      : null;
    const bulkhead = options.bulkhead
      ? new Bulkhead({
          name: \`\${target.constructor.name}.\${methodName}\`,
          maxConcurrent: options.bulkhead.maxConcurrent || 10,
          ...options.bulkhead,
        })
      : null;

    descriptor.value = async function (...args: any[]) {
      let fn = () => originalMethod.apply(this, args);

      // Apply patterns in order: bulkhead -> circuit breaker -> retry -> timeout -> fallback
      if (bulkhead) {
        const innerFn = fn;
        fn = () => bulkhead.execute(innerFn);
      }

      if (circuitBreaker) {
        const innerFn = fn;
        fn = () => circuitBreaker.execute(innerFn);
      }

      if (retry) {
        const innerFn = fn;
        fn = () => retry.execute(innerFn);
      }

      if (timeout) {
        const innerFn = fn;
        fn = () => timeout.execute(innerFn, { timeout: options.timeout! });
      }

      if (fallback) {
        const innerFn = fn;
        fn = () => fallback.execute(innerFn);
      }

      return fn();
    };

    return descriptor;
  };
}

/**
 * Apply circuit breaker to a class method
 */
export function WithCircuitBreaker(options: Partial<CircuitBreakerOptions> = {}): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const breaker = new CircuitBreaker({
      name: \`\${target.constructor.name}.\${String(propertyKey)}\`,
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      ...options,
    });

    descriptor.value = async function (...args: any[]) {
      return breaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
`;
}
