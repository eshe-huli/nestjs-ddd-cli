/**
 * Rate Limiting & Throttling Framework Generator
 * Generates comprehensive rate limiting infrastructure
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface RateLimitingOptions {
  path?: string;
  strategy?: 'token-bucket' | 'sliding-window' | 'fixed-window';
  storage?: 'memory' | 'redis';
}

export async function setupRateLimiting(
  basePath: string,
  options: RateLimitingOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n⏱️ Setting up Rate Limiting Framework\n'));

  const sharedPath = path.join(basePath, 'src/shared/rate-limiting');

  if (!fs.existsSync(sharedPath)) {
    fs.mkdirSync(sharedPath, { recursive: true });
  }

  // Generate rate limiting module
  const moduleContent = generateRateLimitingModule(options);
  fs.writeFileSync(path.join(sharedPath, 'rate-limiting.module.ts'), moduleContent);
  console.log(chalk.green(`  ✓ Created rate limiting module`));

  // Generate rate limiter service
  const serviceContent = generateRateLimiterService(options);
  fs.writeFileSync(path.join(sharedPath, 'rate-limiter.service.ts'), serviceContent);
  console.log(chalk.green(`  ✓ Created rate limiter service`));

  // Generate rate limit guard
  const guardContent = generateRateLimitGuard();
  fs.writeFileSync(path.join(sharedPath, 'rate-limit.guard.ts'), guardContent);
  console.log(chalk.green(`  ✓ Created rate limit guard`));

  // Generate throttle decorator
  const decoratorContent = generateThrottleDecorator();
  fs.writeFileSync(path.join(sharedPath, 'throttle.decorator.ts'), decoratorContent);
  console.log(chalk.green(`  ✓ Created throttle decorator`));

  // Generate quota manager
  const quotaContent = generateQuotaManager();
  fs.writeFileSync(path.join(sharedPath, 'quota-manager.ts'), quotaContent);
  console.log(chalk.green(`  ✓ Created quota manager`));

  // Generate metrics collector
  const metricsContent = generateMetricsCollector();
  fs.writeFileSync(path.join(sharedPath, 'metrics.collector.ts'), metricsContent);
  console.log(chalk.green(`  ✓ Created metrics collector`));

  console.log(chalk.bold.green('\n✅ Rate limiting framework ready!\n'));
}

function generateRateLimitingModule(options: RateLimitingOptions): string {
  return `import { Module, Global, DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimiterService } from './rate-limiter.service';
import { RateLimitGuard } from './rate-limit.guard';
import { QuotaManager } from './quota-manager';
import { MetricsCollector } from './metrics.collector';

export interface RateLimitingModuleOptions {
  strategy: 'token-bucket' | 'sliding-window' | 'fixed-window';
  storage: 'memory' | 'redis';
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  defaults: {
    ttl: number;
    limit: number;
  };
  skipIf?: (context: any) => boolean;
  keyGenerator?: (context: any) => string;
}

@Global()
@Module({})
export class RateLimitingModule {
  static forRoot(options: RateLimitingModuleOptions): DynamicModule {
    return {
      module: RateLimitingModule,
      providers: [
        {
          provide: 'RATE_LIMITING_OPTIONS',
          useValue: options,
        },
        RateLimiterService,
        QuotaManager,
        MetricsCollector,
        {
          provide: APP_GUARD,
          useClass: RateLimitGuard,
        },
      ],
      exports: [RateLimiterService, QuotaManager, MetricsCollector],
    };
  }

  static forFeature(config: FeatureRateLimitConfig): DynamicModule {
    return {
      module: RateLimitingModule,
      providers: [
        {
          provide: 'FEATURE_RATE_LIMIT_CONFIG',
          useValue: config,
        },
      ],
    };
  }
}

export interface FeatureRateLimitConfig {
  name: string;
  ttl: number;
  limit: number;
  keyPrefix?: string;
}
`;
}

function generateRateLimiterService(options: RateLimitingOptions): string {
  const strategy = options.strategy || 'sliding-window';

  return `import { Injectable, Inject, Logger } from '@nestjs/common';
import { MetricsCollector } from './metrics.collector';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export interface RateLimitConfig {
  key: string;
  limit: number;
  ttl: number; // in seconds
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly storage = new Map<string, RateLimitEntry>();

  constructor(
    @Inject('RATE_LIMITING_OPTIONS') private readonly options: any,
    private readonly metrics: MetricsCollector,
  ) {}

  /**
   * Check if request should be allowed
   */
  async check(config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - (config.ttl * 1000);

    let entry = this.storage.get(config.key);

    // Clean old entries
    if (entry) {
      entry.requests = entry.requests.filter(time => time > windowStart);
    }

    if (!entry) {
      entry = { requests: [], createdAt: now };
      this.storage.set(config.key, entry);
    }

    const currentCount = entry.requests.length;
    const remaining = Math.max(0, config.limit - currentCount);
    const resetAt = new Date(windowStart + (config.ttl * 1000));

    if (currentCount >= config.limit) {
      const retryAfter = Math.ceil((entry.requests[0] + (config.ttl * 1000) - now) / 1000);

      this.metrics.recordRateLimitHit(config.key, false);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    // Record request
    entry.requests.push(now);
    this.metrics.recordRateLimitHit(config.key, true);

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt,
    };
  }

  /**
   * Token bucket algorithm
   */
  async checkTokenBucket(config: RateLimitConfig & { refillRate: number }): Promise<RateLimitResult> {
    const now = Date.now();
    let entry = this.storage.get(config.key) as TokenBucketEntry | undefined;

    if (!entry) {
      entry = {
        tokens: config.limit,
        lastRefill: now,
        requests: [],
        createdAt: now,
      };
      this.storage.set(config.key, entry);
    }

    // Refill tokens
    const timePassed = (now - entry.lastRefill) / 1000;
    const tokensToAdd = Math.floor(timePassed * config.refillRate);

    if (tokensToAdd > 0) {
      entry.tokens = Math.min(config.limit, entry.tokens + tokensToAdd);
      entry.lastRefill = now;
    }

    if (entry.tokens < 1) {
      const timeToNextToken = Math.ceil((1 - entry.tokens) / config.refillRate);

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(now + timeToNextToken * 1000),
        retryAfter: timeToNextToken,
      };
    }

    entry.tokens--;

    return {
      allowed: true,
      remaining: Math.floor(entry.tokens),
      resetAt: new Date(now + config.ttl * 1000),
    };
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    this.storage.delete(key);
    this.logger.debug(\`Reset rate limit for: \${key}\`);
  }

  /**
   * Get current status for a key
   */
  async getStatus(key: string, config: RateLimitConfig): Promise<RateLimitStatus> {
    const entry = this.storage.get(key);
    const now = Date.now();
    const windowStart = now - (config.ttl * 1000);

    if (!entry) {
      return {
        key,
        current: 0,
        limit: config.limit,
        remaining: config.limit,
        resetAt: new Date(now + config.ttl * 1000),
      };
    }

    const validRequests = entry.requests.filter(time => time > windowStart);

    return {
      key,
      current: validRequests.length,
      limit: config.limit,
      remaining: Math.max(0, config.limit - validRequests.length),
      resetAt: new Date(windowStart + (config.ttl * 1000)),
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [key, entry] of this.storage.entries()) {
      if (now - entry.createdAt > maxAge && entry.requests.length === 0) {
        this.storage.delete(key);
      }
    }
  }
}

interface RateLimitEntry {
  requests: number[];
  createdAt: number;
}

interface TokenBucketEntry extends RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

export interface RateLimitStatus {
  key: string;
  current: number;
  limit: number;
  remaining: number;
  resetAt: Date;
}
`;
}

function generateRateLimitGuard(): string {
  return `import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiterService } from './rate-limiter.service';
import { MetricsCollector } from './metrics.collector';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimiter: RateLimiterService,
    private readonly metrics: MetricsCollector,
    @Inject('RATE_LIMITING_OPTIONS') private readonly options: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if rate limiting is disabled for this route
    const skipRateLimit = this.reflector.get<boolean>('skipRateLimit', context.getHandler());
    if (skipRateLimit) {
      return true;
    }

    // Check custom skip condition
    if (this.options.skipIf && this.options.skipIf(context)) {
      return true;
    }

    // Get rate limit config from decorator or use defaults
    const config = this.reflector.get<{ limit: number; ttl: number }>(
      'rateLimit',
      context.getHandler(),
    ) || this.options.defaults;

    // Generate key
    const key = this.generateKey(context);

    // Check rate limit
    const result = await this.rateLimiter.check({
      key,
      limit: config.limit,
      ttl: config.ttl,
    });

    // Set headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', config.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      response.setHeader('Retry-After', result.retryAfter);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfter: result.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private generateKey(context: ExecutionContext): string {
    if (this.options.keyGenerator) {
      return this.options.keyGenerator(context);
    }

    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection.remoteAddress;
    const userId = request.user?.id;
    const path = request.path;
    const method = request.method;

    // Use user ID if authenticated, otherwise IP
    const identifier = userId || ip;

    return \`rate_limit:\${identifier}:\${method}:\${path}\`;
  }
}
`;
}

function generateThrottleDecorator(): string {
  return `import { SetMetadata, applyDecorators } from '@nestjs/common';

/**
 * Rate limit decorator
 */
export function RateLimit(options: { limit: number; ttl: number }) {
  return SetMetadata('rateLimit', options);
}

/**
 * Skip rate limiting decorator
 */
export function SkipRateLimit() {
  return SetMetadata('skipRateLimit', true);
}

/**
 * Throttle decorator (alias for RateLimit)
 */
export function Throttle(limit: number, ttl: number) {
  return RateLimit({ limit, ttl });
}

/**
 * Throttle by user
 */
export function ThrottleByUser(limit: number, ttl: number) {
  return applyDecorators(
    SetMetadata('rateLimit', { limit, ttl }),
    SetMetadata('rateLimitKeyType', 'user'),
  );
}

/**
 * Throttle by IP
 */
export function ThrottleByIP(limit: number, ttl: number) {
  return applyDecorators(
    SetMetadata('rateLimit', { limit, ttl }),
    SetMetadata('rateLimitKeyType', 'ip'),
  );
}

/**
 * Throttle by API key
 */
export function ThrottleByApiKey(limit: number, ttl: number) {
  return applyDecorators(
    SetMetadata('rateLimit', { limit, ttl }),
    SetMetadata('rateLimitKeyType', 'apiKey'),
  );
}

/**
 * Burst limit decorator
 * Allows bursts up to burstLimit, then throttles
 */
export function BurstLimit(options: {
  burstLimit: number;
  sustainedLimit: number;
  ttl: number;
}) {
  return SetMetadata('burstLimit', options);
}

/**
 * Dynamic rate limit
 * Uses a function to determine the limit
 */
export function DynamicRateLimit(
  limiter: (context: any) => { limit: number; ttl: number },
) {
  return SetMetadata('dynamicRateLimit', limiter);
}
`;
}

function generateQuotaManager(): string {
  return `import { Injectable, Logger } from '@nestjs/common';

export interface QuotaConfig {
  name: string;
  limit: number;
  period: 'hourly' | 'daily' | 'monthly';
  hardLimit?: boolean;
}

export interface QuotaUsage {
  name: string;
  used: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  percentage: number;
}

@Injectable()
export class QuotaManager {
  private readonly logger = new Logger(QuotaManager.name);
  private readonly quotas = new Map<string, QuotaEntry>();

  /**
   * Register a quota
   */
  register(userId: string, config: QuotaConfig): void {
    const key = this.getKey(userId, config.name);
    const resetAt = this.calculateResetTime(config.period);

    this.quotas.set(key, {
      config,
      used: 0,
      resetAt,
    });
  }

  /**
   * Check and consume quota
   */
  async consume(
    userId: string,
    quotaName: string,
    amount: number = 1,
  ): Promise<{ allowed: boolean; usage: QuotaUsage }> {
    const key = this.getKey(userId, quotaName);
    let entry = this.quotas.get(key);

    if (!entry) {
      throw new Error(\`Quota '\${quotaName}' not registered for user \${userId}\`);
    }

    // Reset if period has passed
    if (new Date() > entry.resetAt) {
      entry.used = 0;
      entry.resetAt = this.calculateResetTime(entry.config.period);
    }

    const wouldExceed = entry.used + amount > entry.config.limit;

    if (wouldExceed && entry.config.hardLimit) {
      return {
        allowed: false,
        usage: this.getUsage(entry),
      };
    }

    entry.used += amount;

    return {
      allowed: !wouldExceed,
      usage: this.getUsage(entry),
    };
  }

  /**
   * Get quota usage
   */
  getUsage(entry: QuotaEntry): QuotaUsage;
  getUsage(userId: string, quotaName: string): QuotaUsage | null;
  getUsage(userIdOrEntry: string | QuotaEntry, quotaName?: string): QuotaUsage | null {
    if (typeof userIdOrEntry === 'object') {
      const entry = userIdOrEntry;
      return {
        name: entry.config.name,
        used: entry.used,
        limit: entry.config.limit,
        remaining: Math.max(0, entry.config.limit - entry.used),
        resetAt: entry.resetAt,
        percentage: (entry.used / entry.config.limit) * 100,
      };
    }

    const key = this.getKey(userIdOrEntry, quotaName!);
    const entry = this.quotas.get(key);
    return entry ? this.getUsage(entry) : null;
  }

  /**
   * Get all quotas for a user
   */
  getAllQuotas(userId: string): QuotaUsage[] {
    const usages: QuotaUsage[] = [];

    for (const [key, entry] of this.quotas.entries()) {
      if (key.startsWith(\`\${userId}:\`)) {
        usages.push(this.getUsage(entry));
      }
    }

    return usages;
  }

  /**
   * Reset quota
   */
  reset(userId: string, quotaName: string): void {
    const key = this.getKey(userId, quotaName);
    const entry = this.quotas.get(key);

    if (entry) {
      entry.used = 0;
      entry.resetAt = this.calculateResetTime(entry.config.period);
    }
  }

  private getKey(userId: string, quotaName: string): string {
    return \`\${userId}:\${quotaName}\`;
  }

  private calculateResetTime(period: 'hourly' | 'daily' | 'monthly'): Date {
    const now = new Date();

    switch (period) {
      case 'hourly':
        return new Date(now.getTime() + 3600000);
      case 'daily':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        nextMonth.setHours(0, 0, 0, 0);
        return nextMonth;
    }
  }
}

interface QuotaEntry {
  config: QuotaConfig;
  used: number;
  resetAt: Date;
}

/**
 * Quota decorator
 */
export function Quota(quotaName: string, amount: number = 1): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const original = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const quotaManager: QuotaManager = (this as any).quotaManager;
      const userId = args[0]?.user?.id; // Adjust based on your request structure

      if (quotaManager && userId) {
        const result = await quotaManager.consume(userId, quotaName, amount);
        if (!result.allowed) {
          throw new Error(\`Quota exceeded for \${quotaName}\`);
        }
      }

      return original.apply(this, args);
    };

    return descriptor;
  };
}
`;
}

function generateMetricsCollector(): string {
  return `import { Injectable, Logger } from '@nestjs/common';

export interface RateLimitMetrics {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  uniqueKeys: number;
  topBlockedKeys: { key: string; count: number }[];
  requestsPerMinute: number;
  blockRate: number;
}

@Injectable()
export class MetricsCollector {
  private readonly logger = new Logger(MetricsCollector.name);
  private readonly metrics: MetricEntry[] = [];
  private readonly keyStats = new Map<string, KeyStats>();
  private readonly maxEntries = 10000;

  /**
   * Record a rate limit check
   */
  recordRateLimitHit(key: string, allowed: boolean): void {
    const now = Date.now();

    this.metrics.push({
      timestamp: now,
      key,
      allowed,
    });

    // Update key stats
    const stats = this.keyStats.get(key) || { allowed: 0, blocked: 0 };
    if (allowed) {
      stats.allowed++;
    } else {
      stats.blocked++;
    }
    this.keyStats.set(key, stats);

    // Cleanup old entries
    this.cleanup();
  }

  /**
   * Get current metrics
   */
  getMetrics(windowMinutes: number = 5): RateLimitMetrics {
    const windowStart = Date.now() - (windowMinutes * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp > windowStart);

    const allowed = recentMetrics.filter(m => m.allowed).length;
    const blocked = recentMetrics.filter(m => !m.allowed).length;
    const total = recentMetrics.length;

    // Get top blocked keys
    const blockedByKey = new Map<string, number>();
    for (const metric of recentMetrics.filter(m => !m.allowed)) {
      blockedByKey.set(metric.key, (blockedByKey.get(metric.key) || 0) + 1);
    }

    const topBlockedKeys = Array.from(blockedByKey.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({ key, count }));

    return {
      totalRequests: total,
      allowedRequests: allowed,
      blockedRequests: blocked,
      uniqueKeys: new Set(recentMetrics.map(m => m.key)).size,
      topBlockedKeys,
      requestsPerMinute: total / windowMinutes,
      blockRate: total > 0 ? (blocked / total) * 100 : 0,
    };
  }

  /**
   * Get stats for a specific key
   */
  getKeyStats(key: string): KeyStats | null {
    return this.keyStats.get(key) || null;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics.length = 0;
    this.keyStats.clear();
  }

  private cleanup(): void {
    if (this.metrics.length > this.maxEntries) {
      this.metrics.splice(0, this.metrics.length - this.maxEntries);
    }
  }
}

interface MetricEntry {
  timestamp: number;
  key: string;
  allowed: boolean;
}

interface KeyStats {
  allowed: number;
  blocked: number;
}
`;
}
