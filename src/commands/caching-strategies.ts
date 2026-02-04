/**
 * Advanced Caching Strategies Generator
 * Cache-aside, write-through, invalidation patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface CachingOptions {
  path?: string;
  provider?: 'memory' | 'redis' | 'memcached';
}

export async function setupCachingStrategies(
  basePath: string,
  options: CachingOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n💾 Setting up Advanced Caching Strategies\n'));

  const sharedPath = path.join(basePath, 'src/shared/caching');

  if (!fs.existsSync(sharedPath)) {
    fs.mkdirSync(sharedPath, { recursive: true });
  }

  fs.writeFileSync(path.join(sharedPath, 'cache.service.ts'), generateCacheService());
  console.log(chalk.green(`  ✓ Created cache service`));

  fs.writeFileSync(path.join(sharedPath, 'cache-strategies.ts'), generateCacheStrategies());
  console.log(chalk.green(`  ✓ Created cache strategies`));

  fs.writeFileSync(path.join(sharedPath, 'cache-invalidation.ts'), generateCacheInvalidation());
  console.log(chalk.green(`  ✓ Created cache invalidation`));

  fs.writeFileSync(path.join(sharedPath, 'cache.decorator.ts'), generateCacheDecorator());
  console.log(chalk.green(`  ✓ Created cache decorator`));

  fs.writeFileSync(path.join(sharedPath, 'distributed-cache.ts'), generateDistributedCache());
  console.log(chalk.green(`  ✓ Created distributed cache`));

  fs.writeFileSync(path.join(sharedPath, 'cache.module.ts'), generateCacheModule());
  console.log(chalk.green(`  ✓ Created cache module`));

  console.log(chalk.bold.green('\n✅ Caching strategies ready!\n'));
}

function generateCacheService(): string {
  return `/**
 * Cache Service
 * Unified caching interface with multiple backends
 */

import { Injectable, Logger } from '@nestjs/common';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  refreshAhead?: boolean;
  staleWhileRevalidate?: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly tagIndex = new Map<string, Set<string>>();

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || 3600000; // 1 hour default
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttl,
      tags: options.tags,
    };

    this.cache.set(key, entry);

    // Index by tags
    if (options.tags) {
      for (const tag of options.tags) {
        let keys = this.tagIndex.get(tag);
        if (!keys) {
          keys = new Set();
          this.tagIndex.set(tag, keys);
        }
        keys.add(key);
      }
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry?.tags) {
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key);
      }
    }
    this.cache.delete(key);
  }

  /**
   * Delete all values with a tag
   */
  async deleteByTag(tag: string): Promise<number> {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    let count = 0;
    for (const key of keys) {
      this.cache.delete(key);
      count++;
    }

    this.tagIndex.delete(tag);
    return count;
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get or set (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.tagIndex.clear();
  }

  /**
   * Get cache stats
   */
  getStats(): CacheStats {
    let expired = 0;
    let valid = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      size: this.cache.size,
      valid,
      expired,
      tags: this.tagIndex.size,
    };
  }
}

export interface CacheStats {
  size: number;
  valid: number;
  expired: number;
  tags: number;
}
`;
}

function generateCacheStrategies(): string {
  return `/**
 * Cache Strategies
 * Different caching patterns for various use cases
 */

import { CacheService, CacheOptions } from './cache.service';

/**
 * Cache-Aside (Lazy Loading)
 */
export class CacheAsideStrategy<T> {
  constructor(
    private readonly cache: CacheService,
    private readonly keyPrefix: string,
  ) {}

  async get(id: string, loader: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const key = \`\${this.keyPrefix}:\${id}\`;
    return this.cache.getOrSet(key, loader, options);
  }

  async invalidate(id: string): Promise<void> {
    const key = \`\${this.keyPrefix}:\${id}\`;
    await this.cache.delete(key);
  }
}

/**
 * Write-Through
 */
export class WriteThroughStrategy<T> {
  constructor(
    private readonly cache: CacheService,
    private readonly keyPrefix: string,
    private readonly writer: (id: string, value: T) => Promise<void>,
  ) {}

  async write(id: string, value: T, options?: CacheOptions): Promise<void> {
    // Write to storage first
    await this.writer(id, value);
    // Then update cache
    const key = \`\${this.keyPrefix}:\${id}\`;
    await this.cache.set(key, value, options);
  }

  async get(id: string): Promise<T | null> {
    const key = \`\${this.keyPrefix}:\${id}\`;
    return this.cache.get(key);
  }
}

/**
 * Write-Behind (Write-Back)
 */
export class WriteBehindStrategy<T> {
  private readonly pending = new Map<string, { value: T; timer: NodeJS.Timeout }>();

  constructor(
    private readonly cache: CacheService,
    private readonly keyPrefix: string,
    private readonly writer: (id: string, value: T) => Promise<void>,
    private readonly delay: number = 5000,
  ) {}

  async write(id: string, value: T, options?: CacheOptions): Promise<void> {
    const key = \`\${this.keyPrefix}:\${id}\`;

    // Update cache immediately
    await this.cache.set(key, value, options);

    // Cancel pending write
    const pending = this.pending.get(id);
    if (pending) {
      clearTimeout(pending.timer);
    }

    // Schedule write
    const timer = setTimeout(async () => {
      await this.writer(id, value);
      this.pending.delete(id);
    }, this.delay);

    this.pending.set(id, { value, timer });
  }

  async flush(): Promise<void> {
    const writes = Array.from(this.pending.entries()).map(async ([id, { value, timer }]) => {
      clearTimeout(timer);
      await this.writer(id, value);
    });
    await Promise.all(writes);
    this.pending.clear();
  }
}

/**
 * Read-Through
 */
export class ReadThroughStrategy<T> {
  constructor(
    private readonly cache: CacheService,
    private readonly keyPrefix: string,
    private readonly loader: (id: string) => Promise<T | null>,
    private readonly defaultOptions?: CacheOptions,
  ) {}

  async get(id: string, options?: CacheOptions): Promise<T | null> {
    const key = \`\${this.keyPrefix}:\${id}\`;

    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await this.loader(id);
    if (value !== null) {
      await this.cache.set(key, value, options || this.defaultOptions);
    }

    return value;
  }
}

/**
 * Refresh-Ahead
 */
export class RefreshAheadStrategy<T> {
  private readonly refreshing = new Set<string>();

  constructor(
    private readonly cache: CacheService,
    private readonly keyPrefix: string,
    private readonly loader: (id: string) => Promise<T>,
    private readonly refreshThreshold: number = 0.8, // Refresh when 80% of TTL passed
  ) {}

  async get(id: string, ttl: number): Promise<T> {
    const key = \`\${this.keyPrefix}:\${id}\`;

    const cached = await this.cache.get<T>(key);
    if (cached !== null) {
      // Check if we should refresh
      this.maybeRefresh(id, key, ttl);
      return cached;
    }

    const value = await this.loader(id);
    await this.cache.set(key, value, { ttl });
    return value;
  }

  private async maybeRefresh(id: string, key: string, ttl: number): Promise<void> {
    if (this.refreshing.has(key)) return;

    // Refresh in background (implementation would check actual TTL remaining)
    this.refreshing.add(key);

    try {
      const value = await this.loader(id);
      await this.cache.set(key, value, { ttl });
    } finally {
      this.refreshing.delete(key);
    }
  }
}
`;
}

function generateCacheInvalidation(): string {
  return `/**
 * Cache Invalidation
 * Event-driven cache invalidation patterns
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheService } from './cache.service';

export interface InvalidationRule {
  event: string;
  pattern?: string;
  tags?: string[];
  handler?: (payload: any) => string[];
}

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private readonly rules: InvalidationRule[] = [];

  constructor(private readonly cache: CacheService) {}

  /**
   * Register invalidation rule
   */
  registerRule(rule: InvalidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Handle entity created event
   */
  @OnEvent('entity.created')
  async onEntityCreated(payload: { type: string; id: string }): Promise<void> {
    await this.invalidateByTag(\`\${payload.type}:list\`);
  }

  /**
   * Handle entity updated event
   */
  @OnEvent('entity.updated')
  async onEntityUpdated(payload: { type: string; id: string }): Promise<void> {
    await this.invalidateByTag(\`\${payload.type}:\${payload.id}\`);
    await this.invalidateByTag(\`\${payload.type}:list\`);
  }

  /**
   * Handle entity deleted event
   */
  @OnEvent('entity.deleted')
  async onEntityDeleted(payload: { type: string; id: string }): Promise<void> {
    await this.invalidateByTag(\`\${payload.type}:\${payload.id}\`);
    await this.invalidateByTag(\`\${payload.type}:list\`);
  }

  /**
   * Invalidate by tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    const count = await this.cache.deleteByTag(tag);
    this.logger.debug(\`Invalidated \${count} entries with tag: \${tag}\`);
    return count;
  }

  /**
   * Invalidate by pattern
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    // For memory cache, iterate and match
    // For Redis, use SCAN with pattern
    this.logger.debug(\`Invalidating pattern: \${pattern}\`);
  }

  /**
   * Process invalidation rules for an event
   */
  async processEvent(event: string, payload: any): Promise<void> {
    for (const rule of this.rules) {
      if (rule.event !== event) continue;

      if (rule.tags) {
        for (const tag of rule.tags) {
          await this.invalidateByTag(tag);
        }
      }

      if (rule.handler) {
        const keys = rule.handler(payload);
        for (const key of keys) {
          await this.cache.delete(key);
        }
      }
    }
  }
}

/**
 * Cache invalidation decorator
 */
export function InvalidatesCache(tags: string[]): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      // Get cache service from this context
      const cacheService = (this as any).cacheService;
      if (cacheService) {
        for (const tag of tags) {
          await cacheService.deleteByTag(tag);
        }
      }

      return result;
    };

    return descriptor;
  };
}
`;
}

function generateCacheDecorator(): string {
  return `/**
 * Cache Decorators
 * Method-level caching with decorators
 */

import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY = 'cache_key';
export const CACHE_TTL = 'cache_ttl';
export const CACHE_TAGS = 'cache_tags';

export interface CacheDecoratorOptions {
  key?: string | ((...args: any[]) => string);
  ttl?: number;
  tags?: string[];
  condition?: (...args: any[]) => boolean;
}

/**
 * Cache method result
 */
export function Cacheable(options: CacheDecoratorOptions = {}): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);
    const cache = new Map<string, { value: any; expiresAt: number }>();

    descriptor.value = async function (...args: any[]) {
      // Check condition
      if (options.condition && !options.condition(...args)) {
        return originalMethod.apply(this, args);
      }

      // Generate key
      const cacheKey = typeof options.key === 'function'
        ? options.key(...args)
        : options.key || \`\${target.constructor.name}:\${methodName}:\${JSON.stringify(args)}\`;

      // Check cache
      const cached = cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.value;
      }

      // Execute and cache
      const result = await originalMethod.apply(this, args);
      const ttl = options.ttl || 60000;

      cache.set(cacheKey, {
        value: result,
        expiresAt: Date.now() + ttl,
      });

      return result;
    };

    return descriptor;
  };
}

/**
 * Evict cache on method execution
 */
export function CacheEvict(options: { key?: string; tags?: string[]; allEntries?: boolean }): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      // Evict logic would be handled by interceptor or injected service
      const cacheService = (this as any).cacheService;
      if (cacheService) {
        if (options.allEntries) {
          await cacheService.clear();
        } else if (options.key) {
          await cacheService.delete(options.key);
        } else if (options.tags) {
          for (const tag of options.tags) {
            await cacheService.deleteByTag(tag);
          }
        }
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Cache with automatic refresh
 */
export function CacheRefresh(options: CacheDecoratorOptions & { refreshInterval: number }): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    let cachedValue: any = null;
    let lastRefresh: number = 0;

    // Background refresh
    setInterval(async () => {
      try {
        cachedValue = await originalMethod.apply(target);
        lastRefresh = Date.now();
      } catch (error) {
        // Keep stale value on error
      }
    }, options.refreshInterval);

    descriptor.value = async function (...args: any[]) {
      if (cachedValue !== null) {
        return cachedValue;
      }

      cachedValue = await originalMethod.apply(this, args);
      lastRefresh = Date.now();
      return cachedValue;
    };

    return descriptor;
  };
}
`;
}

function generateDistributedCache(): string {
  return `/**
 * Distributed Cache
 * Multi-node cache synchronization
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface DistributedCacheOptions {
  nodeId: string;
  syncInterval?: number;
  maxNodes?: number;
}

@Injectable()
export class DistributedCacheService {
  private readonly logger = new Logger(DistributedCacheService.name);
  private readonly localCache = new Map<string, any>();
  private readonly versions = new Map<string, number>();
  private readonly nodeId: string;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly options: DistributedCacheOptions,
  ) {
    this.nodeId = options.nodeId;
  }

  /**
   * Set value with distributed sync
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const version = (this.versions.get(key) || 0) + 1;
    this.versions.set(key, version);

    this.localCache.set(key, {
      value,
      version,
      expiresAt: ttl ? Date.now() + ttl : undefined,
    });

    // Broadcast to other nodes
    this.eventEmitter.emit('cache.sync', {
      type: 'set',
      key,
      value,
      version,
      ttl,
      nodeId: this.nodeId,
    });
  }

  /**
   * Get value
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.localCache.get(key);

    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.localCache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Delete value with distributed sync
   */
  async delete(key: string): Promise<void> {
    this.localCache.delete(key);
    this.versions.delete(key);

    this.eventEmitter.emit('cache.sync', {
      type: 'delete',
      key,
      nodeId: this.nodeId,
    });
  }

  /**
   * Handle sync from other nodes
   */
  handleSync(message: CacheSyncMessage): void {
    if (message.nodeId === this.nodeId) return;

    const currentVersion = this.versions.get(message.key) || 0;

    if (message.type === 'set' && message.version > currentVersion) {
      this.localCache.set(message.key, {
        value: message.value,
        version: message.version,
        expiresAt: message.ttl ? Date.now() + message.ttl : undefined,
      });
      this.versions.set(message.key, message.version);
    } else if (message.type === 'delete') {
      this.localCache.delete(message.key);
      this.versions.delete(message.key);
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.localCache.size;
  }
}

interface CacheSyncMessage {
  type: 'set' | 'delete';
  key: string;
  value?: any;
  version?: number;
  ttl?: number;
  nodeId: string;
}

/**
 * Two-tier cache (L1 local + L2 distributed)
 */
export class TwoTierCache {
  constructor(
    private readonly l1: Map<string, any>,
    private readonly l2: DistributedCacheService,
    private readonly l1Ttl: number = 10000,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    // Check L1
    const l1Entry = this.l1.get(key);
    if (l1Entry && Date.now() < l1Entry.expiresAt) {
      return l1Entry.value;
    }

    // Check L2
    const value = await this.l2.get<T>(key);
    if (value !== null) {
      // Populate L1
      this.l1.set(key, {
        value,
        expiresAt: Date.now() + this.l1Ttl,
      });
    }

    return value;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    // Set in both tiers
    this.l1.set(key, {
      value,
      expiresAt: Date.now() + this.l1Ttl,
    });
    await this.l2.set(key, value, ttl);
  }
}
`;
}

function generateCacheModule(): string {
  return `import { Module, Global, DynamicModule } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInvalidationService } from './cache-invalidation';
import { DistributedCacheService, DistributedCacheOptions } from './distributed-cache';

export interface CacheModuleOptions {
  provider?: 'memory' | 'redis';
  distributed?: DistributedCacheOptions;
  defaultTtl?: number;
}

@Global()
@Module({})
export class CacheModule {
  static forRoot(options: CacheModuleOptions = {}): DynamicModule {
    return {
      module: CacheModule,
      providers: [
        {
          provide: 'CACHE_OPTIONS',
          useValue: options,
        },
        CacheService,
        CacheInvalidationService,
        ...(options.distributed ? [{
          provide: DistributedCacheService,
          useFactory: (eventEmitter: any) =>
            new DistributedCacheService(eventEmitter, options.distributed!),
          inject: ['EventEmitter2'],
        }] : []),
      ],
      exports: [CacheService, CacheInvalidationService],
    };
  }
}
`;
}
