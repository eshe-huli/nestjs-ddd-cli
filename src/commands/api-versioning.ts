/**
 * API Versioning & Backward Compatibility Engine
 * Generates versioned APIs with deprecation handling
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface ApiVersioningOptions {
  path?: string;
  module?: string;
  strategy?: 'uri' | 'header' | 'query';
  currentVersion?: string;
}

export async function setupApiVersioning(
  basePath: string,
  options: ApiVersioningOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n📦 Setting up API Versioning\n'));

  const sharedPath = path.join(basePath, 'src/shared/versioning');

  if (!fs.existsSync(sharedPath)) {
    fs.mkdirSync(sharedPath, { recursive: true });
  }

  // Generate versioning module
  const moduleContent = generateVersioningModule(options);
  fs.writeFileSync(path.join(sharedPath, 'versioning.module.ts'), moduleContent);
  console.log(chalk.green(`  ✓ Created versioning module`));

  // Generate version interceptor
  const interceptorContent = generateVersionInterceptor();
  fs.writeFileSync(path.join(sharedPath, 'version.interceptor.ts'), interceptorContent);
  console.log(chalk.green(`  ✓ Created version interceptor`));

  // Generate deprecation handler
  const deprecationContent = generateDeprecationHandler();
  fs.writeFileSync(path.join(sharedPath, 'deprecation.handler.ts'), deprecationContent);
  console.log(chalk.green(`  ✓ Created deprecation handler`));

  // Generate versioned controller decorator
  const decoratorContent = generateVersionedDecorator();
  fs.writeFileSync(path.join(sharedPath, 'versioned.decorator.ts'), decoratorContent);
  console.log(chalk.green(`  ✓ Created versioned decorator`));

  // Generate DTO migrator
  const migratorContent = generateDtoMigrator();
  fs.writeFileSync(path.join(sharedPath, 'dto-migrator.ts'), migratorContent);
  console.log(chalk.green(`  ✓ Created DTO migrator`));

  // Generate version registry
  const registryContent = generateVersionRegistry();
  fs.writeFileSync(path.join(sharedPath, 'version.registry.ts'), registryContent);
  console.log(chalk.green(`  ✓ Created version registry`));

  console.log(chalk.bold.green('\n✅ API versioning setup complete!\n'));
}

function generateVersioningModule(options: ApiVersioningOptions): string {
  const strategy = options.strategy || 'uri';
  const version = options.currentVersion || '1';

  return `import { Module, Global, DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { VersionInterceptor } from './version.interceptor';
import { DeprecationHandler } from './deprecation.handler';
import { VersionRegistry } from './version.registry';
import { DtoMigrator } from './dto-migrator';

export interface VersioningModuleOptions {
  strategy: 'uri' | 'header' | 'query';
  defaultVersion: string;
  supportedVersions: string[];
  deprecatedVersions?: string[];
  sunsetVersions?: { version: string; sunsetDate: Date }[];
}

@Global()
@Module({})
export class VersioningModule {
  static forRoot(options: VersioningModuleOptions): DynamicModule {
    return {
      module: VersioningModule,
      providers: [
        {
          provide: 'VERSIONING_OPTIONS',
          useValue: options,
        },
        VersionRegistry,
        DtoMigrator,
        DeprecationHandler,
        {
          provide: APP_INTERCEPTOR,
          useClass: VersionInterceptor,
        },
      ],
      exports: [VersionRegistry, DtoMigrator, DeprecationHandler],
    };
  }
}

/**
 * Default versioning configuration
 */
export const DEFAULT_VERSIONING_OPTIONS: VersioningModuleOptions = {
  strategy: '${strategy}',
  defaultVersion: '${version}',
  supportedVersions: ['1', '2'],
  deprecatedVersions: [],
  sunsetVersions: [],
};
`;
}

function generateVersionInterceptor(): string {
  return `import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DeprecationHandler } from './deprecation.handler';

@Injectable()
export class VersionInterceptor implements NestInterceptor {
  constructor(
    @Inject('VERSIONING_OPTIONS') private readonly options: any,
    private readonly deprecationHandler: DeprecationHandler,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const version = this.extractVersion(request);

    // Set version header in response
    response.setHeader('X-API-Version', version);

    // Check for deprecation
    const deprecationInfo = this.deprecationHandler.check(version);
    if (deprecationInfo.deprecated) {
      response.setHeader('X-API-Deprecated', 'true');
      response.setHeader('X-API-Sunset', deprecationInfo.sunsetDate?.toISOString() || '');
      response.setHeader('X-API-Deprecation-Notice', deprecationInfo.message || '');
    }

    // Add supported versions header
    response.setHeader('X-API-Supported-Versions', this.options.supportedVersions.join(', '));

    return next.handle().pipe(
      tap(() => {
        // Log version usage for analytics
        this.logVersionUsage(version, request.path);
      }),
    );
  }

  private extractVersion(request: any): string {
    switch (this.options.strategy) {
      case 'header':
        return request.headers['x-api-version'] || this.options.defaultVersion;
      case 'query':
        return request.query.version || this.options.defaultVersion;
      case 'uri':
      default:
        // Extract from URL path like /v1/resource
        const match = request.path.match(/\\/v(\\d+)\\//);
        return match ? match[1] : this.options.defaultVersion;
    }
  }

  private logVersionUsage(version: string, path: string): void {
    // Implement version usage logging/analytics
  }
}
`;
}

function generateDeprecationHandler(): string {
  return `import { Injectable, Inject, Logger } from '@nestjs/common';

export interface DeprecationInfo {
  deprecated: boolean;
  sunsetDate?: Date;
  message?: string;
  replacementVersion?: string;
}

@Injectable()
export class DeprecationHandler {
  private readonly logger = new Logger(DeprecationHandler.name);

  constructor(@Inject('VERSIONING_OPTIONS') private readonly options: any) {}

  /**
   * Check if a version is deprecated
   */
  check(version: string): DeprecationInfo {
    // Check if version is in deprecated list
    if (this.options.deprecatedVersions?.includes(version)) {
      const sunsetInfo = this.options.sunsetVersions?.find(
        (s: any) => s.version === version,
      );

      return {
        deprecated: true,
        sunsetDate: sunsetInfo?.sunsetDate,
        message: \`API version \${version} is deprecated. Please upgrade to version \${this.options.defaultVersion}.\`,
        replacementVersion: this.options.defaultVersion,
      };
    }

    return { deprecated: false };
  }

  /**
   * Check if a version is sunsetted (no longer available)
   */
  isSunsetted(version: string): boolean {
    const sunsetInfo = this.options.sunsetVersions?.find(
      (s: any) => s.version === version,
    );

    if (sunsetInfo && new Date() > sunsetInfo.sunsetDate) {
      return true;
    }

    return false;
  }

  /**
   * Get deprecation notice for documentation
   */
  getDeprecationNotice(version: string): string | null {
    const info = this.check(version);
    if (!info.deprecated) return null;

    let notice = \`This API version (\${version}) is deprecated.\`;

    if (info.sunsetDate) {
      notice += \` It will be removed on \${info.sunsetDate.toISOString().split('T')[0]}.\`;
    }

    if (info.replacementVersion) {
      notice += \` Please migrate to version \${info.replacementVersion}.\`;
    }

    return notice;
  }
}

/**
 * Deprecated decorator for marking deprecated endpoints
 */
export function Deprecated(options?: {
  version?: string;
  replacement?: string;
  sunsetDate?: Date;
}): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    Reflect.defineMetadata('deprecated', true, target, propertyKey);
    Reflect.defineMetadata('deprecatedOptions', options || {}, target, propertyKey);
    return descriptor;
  };
}
`;
}

function generateVersionedDecorator(): string {
  return `import { Controller, applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiHeader } from '@nestjs/swagger';

/**
 * Versioned controller decorator
 * Creates a controller with version prefix
 */
export function VersionedController(
  path: string,
  version: string | string[],
  options?: { deprecated?: boolean },
): ClassDecorator {
  const versions = Array.isArray(version) ? version : [version];

  return applyDecorators(
    Controller({
      path,
      version: versions,
    }),
    SetMetadata('apiVersion', versions),
    ApiTags(\`v\${versions.join(', v')} - \${path}\`),
    ApiHeader({
      name: 'X-API-Version',
      description: 'API version',
      required: false,
    }),
    ...(options?.deprecated
      ? [SetMetadata('deprecated', true)]
      : []),
  );
}

/**
 * Version decorator for individual endpoints
 */
export function Version(version: string | string[]): MethodDecorator {
  return SetMetadata('version', Array.isArray(version) ? version : [version]);
}

/**
 * Sunset decorator for endpoints being removed
 */
export function Sunset(date: Date, message?: string): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    Reflect.defineMetadata('sunsetDate', date, target, propertyKey);
    Reflect.defineMetadata('sunsetMessage', message, target, propertyKey);
    return descriptor;
  };
}

/**
 * Since decorator for documenting when an endpoint was added
 */
export function Since(version: string): MethodDecorator {
  return SetMetadata('sinceVersion', version);
}

/**
 * Until decorator for documenting when an endpoint will be removed
 */
export function Until(version: string): MethodDecorator {
  return SetMetadata('untilVersion', version);
}
`;
}

function generateDtoMigrator(): string {
  return `import { Injectable, Logger } from '@nestjs/common';

/**
 * DTO Migrator
 * Handles transformation between different API versions
 */
@Injectable()
export class DtoMigrator {
  private readonly logger = new Logger(DtoMigrator.name);
  private readonly migrations = new Map<string, MigrationDefinition[]>();

  /**
   * Register a migration between versions
   */
  register<TFrom, TTo>(
    dtoName: string,
    fromVersion: string,
    toVersion: string,
    migrate: (data: TFrom) => TTo,
    rollback?: (data: TTo) => TFrom,
  ): void {
    const key = \`\${dtoName}:\${fromVersion}:\${toVersion}\`;
    const existing = this.migrations.get(dtoName) || [];

    existing.push({
      fromVersion,
      toVersion,
      migrate,
      rollback,
    });

    this.migrations.set(dtoName, existing);
    this.logger.debug(\`Registered migration: \${key}\`);
  }

  /**
   * Migrate DTO from one version to another
   */
  migrate<T>(dtoName: string, data: any, fromVersion: string, toVersion: string): T {
    if (fromVersion === toVersion) {
      return data as T;
    }

    const migrations = this.migrations.get(dtoName);
    if (!migrations) {
      this.logger.warn(\`No migrations found for \${dtoName}\`);
      return data as T;
    }

    // Find migration path
    const path = this.findMigrationPath(migrations, fromVersion, toVersion);
    if (!path.length) {
      throw new Error(\`No migration path found from v\${fromVersion} to v\${toVersion} for \${dtoName}\`);
    }

    // Apply migrations in sequence
    let result = data;
    for (const migration of path) {
      result = migration.migrate(result);
    }

    return result as T;
  }

  /**
   * Rollback DTO from newer version to older
   */
  rollback<T>(dtoName: string, data: any, fromVersion: string, toVersion: string): T {
    if (fromVersion === toVersion) {
      return data as T;
    }

    const migrations = this.migrations.get(dtoName);
    if (!migrations) {
      return data as T;
    }

    // Find rollback path (reverse)
    const path = this.findMigrationPath(migrations, toVersion, fromVersion);
    if (!path.length) {
      throw new Error(\`No rollback path found from v\${fromVersion} to v\${toVersion} for \${dtoName}\`);
    }

    // Apply rollbacks in reverse sequence
    let result = data;
    for (const migration of path.reverse()) {
      if (!migration.rollback) {
        throw new Error(\`Rollback not supported for \${dtoName} migration\`);
      }
      result = migration.rollback(result);
    }

    return result as T;
  }

  private findMigrationPath(
    migrations: MigrationDefinition[],
    fromVersion: string,
    toVersion: string,
  ): MigrationDefinition[] {
    // Simple linear path finding (for more complex scenarios, use graph algorithms)
    const path: MigrationDefinition[] = [];
    let currentVersion = fromVersion;

    while (currentVersion !== toVersion) {
      const migration = migrations.find(m => m.fromVersion === currentVersion);
      if (!migration) break;

      path.push(migration);
      currentVersion = migration.toVersion;
    }

    return path;
  }
}

interface MigrationDefinition {
  fromVersion: string;
  toVersion: string;
  migrate: (data: any) => any;
  rollback?: (data: any) => any;
}

/**
 * DTO version decorator
 */
export function DtoVersion(version: string): ClassDecorator {
  return function (target: Function) {
    Reflect.defineMetadata('dtoVersion', version, target);
  };
}

/**
 * Property migration decorator
 */
export function Migrated(options: {
  from?: string;
  to?: string;
  transformer?: (value: any) => any;
}): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    const existing = Reflect.getMetadata('migratedProperties', target.constructor) || [];
    existing.push({ propertyKey, ...options });
    Reflect.defineMetadata('migratedProperties', existing, target.constructor);
  };
}
`;
}

function generateVersionRegistry(): string {
  return `import { Injectable, Inject, Logger } from '@nestjs/common';

/**
 * Version Registry
 * Tracks API versions and their metadata
 */
@Injectable()
export class VersionRegistry {
  private readonly logger = new Logger(VersionRegistry.name);
  private readonly versions = new Map<string, VersionMetadata>();

  constructor(@Inject('VERSIONING_OPTIONS') private readonly options: any) {
    this.initializeVersions();
  }

  private initializeVersions(): void {
    for (const version of this.options.supportedVersions) {
      this.versions.set(version, {
        version,
        status: this.getVersionStatus(version),
        releaseDate: new Date(), // Should be loaded from config
        endpoints: [],
      });
    }
  }

  private getVersionStatus(version: string): VersionStatus {
    if (this.options.deprecatedVersions?.includes(version)) {
      return 'deprecated';
    }
    if (version === this.options.defaultVersion) {
      return 'current';
    }
    return 'supported';
  }

  /**
   * Register an endpoint for a version
   */
  registerEndpoint(version: string, endpoint: EndpointMetadata): void {
    const versionMeta = this.versions.get(version);
    if (versionMeta) {
      versionMeta.endpoints.push(endpoint);
    }
  }

  /**
   * Get all versions with their metadata
   */
  getAllVersions(): VersionMetadata[] {
    return Array.from(this.versions.values());
  }

  /**
   * Get specific version metadata
   */
  getVersion(version: string): VersionMetadata | undefined {
    return this.versions.get(version);
  }

  /**
   * Check if version is supported
   */
  isSupported(version: string): boolean {
    return this.options.supportedVersions.includes(version);
  }

  /**
   * Get current/default version
   */
  getCurrentVersion(): string {
    return this.options.defaultVersion;
  }

  /**
   * Generate version documentation
   */
  generateDocs(): VersionDocumentation {
    return {
      currentVersion: this.options.defaultVersion,
      supportedVersions: this.options.supportedVersions,
      deprecatedVersions: this.options.deprecatedVersions || [],
      versions: this.getAllVersions().map(v => ({
        version: v.version,
        status: v.status,
        releaseDate: v.releaseDate?.toISOString(),
        endpointCount: v.endpoints.length,
      })),
    };
  }
}

export type VersionStatus = 'current' | 'supported' | 'deprecated' | 'sunset';

export interface VersionMetadata {
  version: string;
  status: VersionStatus;
  releaseDate?: Date;
  sunsetDate?: Date;
  endpoints: EndpointMetadata[];
}

export interface EndpointMetadata {
  path: string;
  method: string;
  handler: string;
  deprecated?: boolean;
  since?: string;
  until?: string;
}

export interface VersionDocumentation {
  currentVersion: string;
  supportedVersions: string[];
  deprecatedVersions: string[];
  versions: {
    version: string;
    status: VersionStatus;
    releaseDate?: string;
    endpointCount: number;
  }[];
}
`;
}

// Helper functions
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
