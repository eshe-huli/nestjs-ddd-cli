import * as path from 'path';
import chalk from 'chalk';
import { generateFromTemplate, ensureDir, writeFile, prepareTemplateData } from '../utils/file.utils';
import { installDependencies } from '../utils/dependency.utils';

// Import recipe implementations from separate files
import { applyMiddlewareRecipe } from './recipes/middleware.recipe';
import { applyWebSocketRecipe } from './recipes/websocket.recipe';
import { applyMultiTenancyRecipe } from './recipes/multi-tenancy.recipe';
import { applyOAuth2Recipe } from './recipes/oauth2.recipe';
import { applyMessageQueueRecipe } from './recipes/message-queue.recipe';
import { applyElasticsearchRecipe } from './recipes/elasticsearch.recipe';
import { applyEventSourcingRecipe } from './recipes/event-sourcing.recipe';

export interface RecipeOptions {
  path?: string;
  installDeps?: boolean;
}

const AVAILABLE_RECIPES = {
  'auth-jwt': {
    name: 'JWT Authentication',
    description: 'JWT-based authentication with guards and decorators',
    dependencies: ['@nestjs/jwt', '@nestjs/passport', 'passport', 'passport-jwt', 'bcrypt'],
    devDependencies: ['@types/passport-jwt', '@types/bcrypt'],
  },
  'pagination': {
    name: 'Pagination Utilities',
    description: 'Shared pagination DTOs and utilities',
    dependencies: [],
    devDependencies: [],
  },
  'soft-delete': {
    name: 'Soft Delete',
    description: 'Soft delete base class and repository mixin',
    dependencies: [],
    devDependencies: [],
  },
  'audit-log': {
    name: 'Audit Logging',
    description: 'Track entity changes with audit log',
    dependencies: [],
    devDependencies: [],
  },
  'caching': {
    name: 'Redis Caching',
    description: 'Redis-based caching with decorators',
    dependencies: ['@nestjs/cache-manager', 'cache-manager', 'cache-manager-redis-store', 'redis'],
    devDependencies: ['@types/cache-manager-redis-store'],
  },
  'file-upload': {
    name: 'File Upload',
    description: 'File upload service with local/S3 storage support',
    dependencies: ['@nestjs/platform-express', 'multer', '@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner', 'uuid'],
    devDependencies: ['@types/multer', '@types/uuid'],
  },
  'notifications': {
    name: 'Notifications',
    description: 'Multi-channel notification system (email, push, SMS)',
    dependencies: ['@nestjs/bull', 'bull', 'nodemailer', 'handlebars'],
    devDependencies: ['@types/nodemailer'],
  },
  'webhooks': {
    name: 'Webhooks',
    description: 'Webhook management with retry and signature verification',
    dependencies: ['axios', 'crypto'],
    devDependencies: [],
  },
  'filtering': {
    name: 'Advanced Filtering',
    description: 'Query builder utilities with operators (eq, gt, lt, like, in, between)',
    dependencies: [],
    devDependencies: [],
  },
  'rate-limiting': {
    name: 'Rate Limiting',
    description: 'Throttling with decorators, Redis-based rate limiting, and IP tracking',
    dependencies: ['@nestjs/throttler', 'ioredis'],
    devDependencies: [],
  },
  'health': {
    name: 'Health Checks & Monitoring',
    description: 'Health endpoints, structured logging, and monitoring utilities',
    dependencies: ['@nestjs/terminus', 'pino', 'pino-pretty', 'nestjs-pino'],
    devDependencies: [],
  },
  'api-versioning': {
    name: 'API Versioning',
    description: 'URL/Header-based versioning with deprecation support and migration helpers',
    dependencies: [],
    devDependencies: [],
  },
  'test-factories': {
    name: 'Test Factories & Fixtures',
    description: 'Faker-based factories, test data builders, database seeders, and mock utilities',
    dependencies: ['@faker-js/faker'],
    devDependencies: [],
  },
  'middleware': {
    name: 'Middleware, Guards & Interceptors',
    description: 'Common middleware, guards, and interceptors for NestJS applications',
    dependencies: [],
    devDependencies: [],
  },
  'websocket': {
    name: 'WebSocket & Real-Time',
    description: 'Socket.IO gateway, rooms, presence tracking, and real-time events',
    dependencies: ['@nestjs/websockets', '@nestjs/platform-socket.io', 'socket.io'],
    devDependencies: [],
  },
  'multi-tenancy': {
    name: 'Multi-Tenancy',
    description: 'SaaS multi-tenant architecture with tenant isolation and scoped repositories',
    dependencies: [],
    devDependencies: [],
  },
  'oauth2': {
    name: 'OAuth2 & Social Login',
    description: 'OAuth2/OIDC with Google, GitHub, and enterprise SSO support',
    dependencies: ['@nestjs/passport', 'passport-google-oauth20', 'passport-github2', 'openid-client'],
    devDependencies: ['@types/passport-google-oauth20', '@types/passport-github2'],
  },
  'message-queue': {
    name: 'Message Queue (RabbitMQ)',
    description: 'RabbitMQ integration with producers, consumers, dead letters, and retry patterns',
    dependencies: ['@nestjs/microservices', 'amqplib', 'amqp-connection-manager'],
    devDependencies: ['@types/amqplib'],
  },
  'elasticsearch': {
    name: 'Elasticsearch Search',
    description: 'Full-text search with Elasticsearch, indexing, and autocomplete',
    dependencies: ['@nestjs/elasticsearch', '@elastic/elasticsearch'],
    devDependencies: [],
  },
  'event-sourcing': {
    name: 'Event Sourcing',
    description: 'Event store, projections, snapshots, and event replay capabilities',
    dependencies: ['@nestjs/cqrs'],
    devDependencies: [],
  },
};

export async function applyRecipe(recipeName: string, options: RecipeOptions) {
  const recipe = AVAILABLE_RECIPES[recipeName as keyof typeof AVAILABLE_RECIPES];

  if (!recipe) {
    console.log(chalk.red(`Unknown recipe: ${recipeName}`));
    console.log(chalk.yellow('\nAvailable recipes:'));
    Object.entries(AVAILABLE_RECIPES).forEach(([key, value]) => {
      console.log(chalk.cyan(`  ${key.padEnd(15)} - ${value.description}`));
    });
    return;
  }

  console.log(chalk.blue(`\n🧪 Applying recipe: ${recipe.name}`));

  const basePath = options.path || process.cwd();

  // Install dependencies if requested
  if (options.installDeps && recipe.dependencies.length > 0) {
    console.log(chalk.cyan('  Installing dependencies...'));
    await installDependencies(basePath, recipe.dependencies);
    if (recipe.devDependencies.length > 0) {
      await installDependencies(basePath, recipe.devDependencies, true);
    }
  }

  // Apply the specific recipe
  switch (recipeName) {
    case 'auth-jwt':
      await applyAuthJwtRecipe(basePath);
      break;
    case 'pagination':
      await applyPaginationRecipe(basePath);
      break;
    case 'soft-delete':
      await applySoftDeleteRecipe(basePath);
      break;
    case 'audit-log':
      await applyAuditLogRecipe(basePath);
      break;
    case 'caching':
      await applyCachingRecipe(basePath);
      break;
    case 'file-upload':
      await applyFileUploadRecipe(basePath);
      break;
    case 'notifications':
      await applyNotificationsRecipe(basePath);
      break;
    case 'webhooks':
      await applyWebhooksRecipe(basePath);
      break;
    case 'filtering':
      await applyFilteringRecipe(basePath);
      break;
    case 'rate-limiting':
      await applyRateLimitingRecipe(basePath);
      break;
    case 'health':
      await applyHealthRecipe(basePath);
      break;
    case 'api-versioning':
      await applyApiVersioningRecipe(basePath);
      break;
    case 'test-factories':
      await applyTestFactoriesRecipe(basePath);
      break;
    case 'middleware':
      await applyMiddlewareRecipe(basePath);
      break;
    case 'websocket':
      await applyWebSocketRecipe(basePath);
      break;
    case 'multi-tenancy':
      await applyMultiTenancyRecipe(basePath);
      break;
    case 'oauth2':
      await applyOAuth2Recipe(basePath);
      break;
    case 'message-queue':
      await applyMessageQueueRecipe(basePath);
      break;
    case 'elasticsearch':
      await applyElasticsearchRecipe(basePath);
      break;
    case 'event-sourcing':
      await applyEventSourcingRecipe(basePath);
      break;
  }

  console.log(chalk.green(`\n✅ Recipe '${recipe.name}' applied successfully!`));

  if (recipe.dependencies.length > 0 && !options.installDeps) {
    console.log(chalk.yellow('\n📦 Required dependencies (run with --install-deps to auto-install):'));
    console.log(chalk.cyan(`  npm install ${recipe.dependencies.join(' ')}`));
    if (recipe.devDependencies.length > 0) {
      console.log(chalk.cyan(`  npm install -D ${recipe.devDependencies.join(' ')}`));
    }
  }
}

async function applyAuthJwtRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const authPath = path.join(sharedPath, 'auth');

  await ensureDir(authPath);
  await ensureDir(path.join(authPath, 'guards'));
  await ensureDir(path.join(authPath, 'decorators'));
  await ensureDir(path.join(authPath, 'strategies'));

  // JWT Strategy
  const jwtStrategyContent = `import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";

export interface JwtPayload {
  sub: string;
  email: string;
  roles?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException();
    }
    return { userId: payload.sub, email: payload.email, roles: payload.roles };
  }
}
`;
  await writeFile(path.join(authPath, 'strategies/jwt.strategy.ts'), jwtStrategyContent);

  // Auth Guard
  const authGuardContent = `import { Injectable, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
`;
  await writeFile(path.join(authPath, 'guards/jwt-auth.guard.ts'), authGuardContent);

  // Roles Guard
  const rolesGuardContent = `import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
`;
  await writeFile(path.join(authPath, 'guards/roles.guard.ts'), rolesGuardContent);

  // Decorators
  const publicDecoratorContent = `import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
`;
  await writeFile(path.join(authPath, 'decorators/public.decorator.ts'), publicDecoratorContent);

  const rolesDecoratorContent = `import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
`;
  await writeFile(path.join(authPath, 'decorators/roles.decorator.ts'), rolesDecoratorContent);

  const currentUserDecoratorContent = `import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface CurrentUserData {
  userId: string;
  email: string;
  roles?: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserData;

    return data ? user?.[data] : user;
  }
);
`;
  await writeFile(path.join(authPath, 'decorators/current-user.decorator.ts'), currentUserDecoratorContent);

  // Index exports
  const indexContent = `// Guards
export * from "./guards/jwt-auth.guard";
export * from "./guards/roles.guard";

// Decorators
export * from "./decorators/public.decorator";
export * from "./decorators/roles.decorator";
export * from "./decorators/current-user.decorator";

// Strategies
export * from "./strategies/jwt.strategy";
`;
  await writeFile(path.join(authPath, 'index.ts'), indexContent);

  console.log(chalk.green('  ✓ JWT Strategy'));
  console.log(chalk.green('  ✓ Auth Guards (JWT, Roles)'));
  console.log(chalk.green('  ✓ Decorators (Public, Roles, CurrentUser)'));
}

async function applyPaginationRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const paginationPath = path.join(sharedPath, 'pagination');

  await ensureDir(paginationPath);

  const paginationDtoContent = `import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsInt, Min, Max, IsString, IsIn } from "class-validator";
import { Type } from "class-transformer";

export class PaginationQueryDto {
  @ApiPropertyOptional({ description: "Page number", default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Items per page", default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: "Field to sort by", default: "createdAt" })
  @IsOptional()
  @IsString()
  sortBy?: string = "createdAt";

  @ApiPropertyOptional({ description: "Sort order", enum: ["ASC", "DESC"], default: "DESC" })
  @IsOptional()
  @IsIn(["ASC", "DESC"])
  sortOrder?: "ASC" | "DESC" = "DESC";

  get skip(): number {
    return ((this.page || 1) - 1) * (this.limit || 10);
  }

  get take(): number {
    return this.limit || 10;
  }
}

export class PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;

  constructor(total: number, page: number, limit: number) {
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNextPage = page < this.totalPages;
    this.hasPreviousPage = page > 1;
  }
}

export class PaginatedResponseDto<T> {
  items: T[];
  meta: PaginationMeta;

  constructor(items: T[], total: number, page: number, limit: number) {
    this.items = items;
    this.meta = new PaginationMeta(total, page, limit);
  }
}
`;
  await writeFile(path.join(paginationPath, 'pagination.dto.ts'), paginationDtoContent);

  const indexContent = `export * from "./pagination.dto";
`;
  await writeFile(path.join(paginationPath, 'index.ts'), indexContent);

  console.log(chalk.green('  ✓ PaginationQueryDto'));
  console.log(chalk.green('  ✓ PaginationMeta'));
  console.log(chalk.green('  ✓ PaginatedResponseDto'));
}

async function applySoftDeleteRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const basePath2 = path.join(sharedPath, 'base');

  await ensureDir(basePath2);

  const baseEntityContent = `import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Column,
} from "typeorm";

export abstract class BaseOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt?: Date;
}
`;
  await writeFile(path.join(basePath2, 'base-orm.entity.ts'), baseEntityContent);

  const baseRepoContent = `import { Repository, FindOptionsWhere, DeepPartial } from "typeorm";
import { BaseOrmEntity } from "./base-orm.entity";

export abstract class BaseRepository<T extends BaseOrmEntity> {
  constructor(protected readonly repository: Repository<T>) {}

  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({
      where: { id, deletedAt: null } as FindOptionsWhere<T>,
    });
  }

  async findAll(): Promise<T[]> {
    return this.repository.find({
      where: { deletedAt: null } as FindOptionsWhere<T>,
    });
  }

  async create(data: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async update(id: string, data: DeepPartial<T>): Promise<T | null> {
    await this.repository.update(id, data as any);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.update(id, {
      deletedAt: new Date(),
      isActive: false,
    } as any);
  }

  async hardDelete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async restore(id: string): Promise<void> {
    await this.repository.update(id, {
      deletedAt: null,
      isActive: true,
    } as any);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { id, deletedAt: null } as FindOptionsWhere<T>,
    });
    return count > 0;
  }
}
`;
  await writeFile(path.join(basePath2, 'base.repository.ts'), baseRepoContent);

  const indexContent = `export * from "./base-orm.entity";
export * from "./base.repository";
`;
  await writeFile(path.join(basePath2, 'index.ts'), indexContent);

  console.log(chalk.green('  ✓ BaseOrmEntity with soft delete'));
  console.log(chalk.green('  ✓ BaseRepository with CRUD + soft delete'));
}

async function applyAuditLogRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const auditPath = path.join(sharedPath, 'audit');

  await ensureDir(auditPath);

  const auditEntityContent = `import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "RESTORE";

@Entity("audit_logs")
export class AuditLogEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  entityName: string;

  @Column()
  entityId: string;

  @Column()
  action: AuditAction;

  @Column({ type: "jsonb", nullable: true })
  oldValues?: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  newValues?: Record<string, any>;

  @Column({ nullable: true })
  userId?: string;

  @Column({ nullable: true })
  userEmail?: string;

  @CreateDateColumn()
  createdAt: Date;
}
`;
  await writeFile(path.join(auditPath, 'audit-log.entity.ts'), auditEntityContent);

  const auditServiceContent = `import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogEntity, AuditAction } from "./audit-log.entity";

export interface AuditContext {
  userId?: string;
  userEmail?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepository: Repository<AuditLogEntity>
  ) {}

  async log(
    entityName: string,
    entityId: string,
    action: AuditAction,
    oldValues: Record<string, any> | null,
    newValues: Record<string, any> | null,
    context?: AuditContext
  ): Promise<void> {
    const auditLog = this.auditRepository.create({
      entityName,
      entityId,
      action,
      oldValues: oldValues || undefined,
      newValues: newValues || undefined,
      userId: context?.userId,
      userEmail: context?.userEmail,
    });

    await this.auditRepository.save(auditLog);
  }

  async getAuditHistory(entityName: string, entityId: string): Promise<AuditLogEntity[]> {
    return this.auditRepository.find({
      where: { entityName, entityId },
      order: { createdAt: "DESC" },
    });
  }
}
`;
  await writeFile(path.join(auditPath, 'audit.service.ts'), auditServiceContent);

  const indexContent = `export * from "./audit-log.entity";
export * from "./audit.service";
`;
  await writeFile(path.join(auditPath, 'index.ts'), indexContent);

  console.log(chalk.green('  ✓ AuditLogEntity'));
  console.log(chalk.green('  ✓ AuditService'));
}

async function applyCachingRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const cachePath = path.join(sharedPath, 'cache');

  await ensureDir(cachePath);

  const cacheDecoratorContent = `import { SetMetadata } from "@nestjs/common";

export const CACHE_KEY = "cache_key";
export const CACHE_TTL = "cache_ttl";

export interface CacheOptions {
  key?: string;
  ttl?: number; // seconds
}

export const Cacheable = (options: CacheOptions = {}) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY, options.key || \`\${target.constructor.name}:\${propertyKey}\`)(
      target,
      propertyKey,
      descriptor
    );
    SetMetadata(CACHE_TTL, options.ttl || 300)(target, propertyKey, descriptor);
  };
};

export const CacheInvalidate = (keys: string[]) => SetMetadata("cache_invalidate", keys);
`;
  await writeFile(path.join(cachePath, 'cache.decorator.ts'), cacheDecoratorContent);

  const cacheInterceptorContent = `import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject } from "@nestjs/common";
import { Cache } from "cache-manager";
import { CACHE_KEY, CACHE_TTL } from "./cache.decorator";

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private reflector: Reflector
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const cacheKey = this.reflector.get<string>(CACHE_KEY, context.getHandler());
    const cacheTtl = this.reflector.get<number>(CACHE_TTL, context.getHandler());

    if (!cacheKey) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const fullKey = \`\${cacheKey}:\${JSON.stringify(request.params)}:\${JSON.stringify(request.query)}\`;

    const cachedData = await this.cacheManager.get(fullKey);

    if (cachedData) {
      return of(cachedData);
    }

    return next.handle().pipe(
      tap(async (data) => {
        await this.cacheManager.set(fullKey, data, cacheTtl * 1000);
      })
    );
  }
}
`;
  await writeFile(path.join(cachePath, 'cache.interceptor.ts'), cacheInterceptorContent);

  const indexContent = `export * from "./cache.decorator";
export * from "./cache.interceptor";
`;
  await writeFile(path.join(cachePath, 'index.ts'), indexContent);

  console.log(chalk.green('  ✓ Cache decorators (Cacheable, CacheInvalidate)'));
  console.log(chalk.green('  ✓ CacheInterceptor'));
}

async function applyFileUploadRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const uploadPath = path.join(sharedPath, 'upload');

  await ensureDir(uploadPath);
  await ensureDir(path.join(uploadPath, 'strategies'));

  // Storage interface
  const storageInterfaceContent = `export interface StorageProvider {
  upload(file: Express.Multer.File, path?: string): Promise<UploadResult>;
  delete(fileKey: string): Promise<void>;
  getSignedUrl(fileKey: string, expiresIn?: number): Promise<string>;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
  originalName: string;
}

export interface UploadOptions {
  maxSize?: number; // bytes
  allowedMimeTypes?: string[];
  path?: string;
}
`;
  await writeFile(path.join(uploadPath, 'storage.interface.ts'), storageInterfaceContent);

  // Local storage strategy
  const localStorageContent = `import { Injectable } from "@nestjs/common";
import { StorageProvider, UploadResult } from "../storage.interface";
import * as fs from "fs/promises";
import * as path from "path";
import { v4 as uuid } from "uuid";

@Injectable()
export class LocalStorageStrategy implements StorageProvider {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || "./uploads";
    this.baseUrl = process.env.UPLOAD_BASE_URL || "http://localhost:3000/uploads";
  }

  async upload(file: Express.Multer.File, filePath?: string): Promise<UploadResult> {
    const ext = path.extname(file.originalname);
    const fileName = \`\${uuid()}\${ext}\`;
    const relativePath = filePath ? \`\${filePath}/\${fileName}\` : fileName;
    const fullPath = path.join(this.uploadDir, relativePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.buffer);

    return {
      key: relativePath,
      url: \`\${this.baseUrl}/\${relativePath}\`,
      size: file.size,
      mimeType: file.mimetype,
      originalName: file.originalname,
    };
  }

  async delete(fileKey: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, fileKey);
    await fs.unlink(fullPath);
  }

  async getSignedUrl(fileKey: string, _expiresIn?: number): Promise<string> {
    // Local storage doesn't need signed URLs
    return \`\${this.baseUrl}/\${fileKey}\`;
  }
}
`;
  await writeFile(path.join(uploadPath, 'strategies/local.strategy.ts'), localStorageContent);

  // S3 storage strategy
  const s3StorageContent = `import { Injectable } from "@nestjs/common";
import { StorageProvider, UploadResult } from "../storage.interface";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";
import * as path from "path";

@Injectable()
export class S3StorageStrategy implements StorageProvider {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    this.region = process.env.AWS_REGION || "us-east-1";
    this.bucket = process.env.AWS_S3_BUCKET || "uploads";

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }

  async upload(file: Express.Multer.File, filePath?: string): Promise<UploadResult> {
    const ext = path.extname(file.originalname);
    const fileName = \`\${uuid()}\${ext}\`;
    const key = filePath ? \`\${filePath}/\${fileName}\` : fileName;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname,
        },
      })
    );

    return {
      key,
      url: \`https://\${this.bucket}.s3.\${this.region}.amazonaws.com/\${key}\`,
      size: file.size,
      mimeType: file.mimetype,
      originalName: file.originalname,
    };
  }

  async delete(fileKey: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      })
    );
  }

  async getSignedUrl(fileKey: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
`;
  await writeFile(path.join(uploadPath, 'strategies/s3.strategy.ts'), s3StorageContent);

  // Upload service
  const uploadServiceContent = `import { Injectable, BadRequestException } from "@nestjs/common";
import { StorageProvider, UploadResult, UploadOptions } from "./storage.interface";
import { LocalStorageStrategy } from "./strategies/local.strategy";
import { S3StorageStrategy } from "./strategies/s3.strategy";

@Injectable()
export class UploadService {
  private readonly storageProvider: StorageProvider;

  constructor() {
    const storageType = process.env.STORAGE_TYPE || "local";
    this.storageProvider =
      storageType === "s3" ? new S3StorageStrategy() : new LocalStorageStrategy();
  }

  async uploadFile(
    file: Express.Multer.File,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    this.validateFile(file, options);
    return this.storageProvider.upload(file, options.path);
  }

  async uploadFiles(
    files: Express.Multer.File[],
    options: UploadOptions = {}
  ): Promise<UploadResult[]> {
    return Promise.all(files.map((file) => this.uploadFile(file, options)));
  }

  async deleteFile(fileKey: string): Promise<void> {
    return this.storageProvider.delete(fileKey);
  }

  async getSignedUrl(fileKey: string, expiresIn?: number): Promise<string> {
    return this.storageProvider.getSignedUrl(fileKey, expiresIn);
  }

  private validateFile(file: Express.Multer.File, options: UploadOptions): void {
    if (options.maxSize && file.size > options.maxSize) {
      throw new BadRequestException(
        \`File size exceeds maximum allowed size of \${options.maxSize} bytes\`
      );
    }

    if (
      options.allowedMimeTypes &&
      !options.allowedMimeTypes.includes(file.mimetype)
    ) {
      throw new BadRequestException(
        \`File type \${file.mimetype} is not allowed. Allowed types: \${options.allowedMimeTypes.join(", ")}\`
      );
    }
  }
}
`;
  await writeFile(path.join(uploadPath, 'upload.service.ts'), uploadServiceContent);

  // Index exports
  const indexContent = `export * from "./storage.interface";
export * from "./upload.service";
export * from "./strategies/local.strategy";
export * from "./strategies/s3.strategy";
`;
  await writeFile(path.join(uploadPath, 'index.ts'), indexContent);

  console.log(chalk.green('  ✓ StorageProvider interface'));
  console.log(chalk.green('  ✓ LocalStorageStrategy'));
  console.log(chalk.green('  ✓ S3StorageStrategy'));
  console.log(chalk.green('  ✓ UploadService'));
}

async function applyNotificationsRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const notifPath = path.join(sharedPath, 'notifications');

  await ensureDir(notifPath);
  await ensureDir(path.join(notifPath, 'channels'));
  await ensureDir(path.join(notifPath, 'templates'));

  // Notification interface
  const notifInterfaceContent = `export interface NotificationChannel {
  send(notification: Notification): Promise<void>;
}

export interface Notification {
  recipient: string;
  subject: string;
  content: string;
  template?: string;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
}

export type NotificationType = "email" | "push" | "sms" | "in-app";

export interface NotificationOptions {
  channels: NotificationType[];
  priority?: "low" | "normal" | "high";
  scheduledAt?: Date;
}
`;
  await writeFile(path.join(notifPath, 'notification.interface.ts'), notifInterfaceContent);

  // Email channel
  const emailChannelContent = `import { Injectable } from "@nestjs/common";
import { NotificationChannel, Notification } from "../notification.interface";
import * as nodemailer from "nodemailer";
import * as Handlebars from "handlebars";
import * as fs from "fs/promises";
import * as path from "path";

@Injectable()
export class EmailChannel implements NotificationChannel {
  private transporter: nodemailer.Transporter;
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async send(notification: Notification): Promise<void> {
    let html = notification.content;

    if (notification.template) {
      const template = await this.loadTemplate(notification.template);
      html = template(notification.data || {});
    }

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@example.com",
      to: notification.recipient,
      subject: notification.subject,
      html,
    });
  }

  private async loadTemplate(templateName: string): Promise<HandlebarsTemplateDelegate> {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templatePath = path.join(
      process.cwd(),
      "src/shared/notifications/templates",
      \`\${templateName}.hbs\`
    );

    const templateContent = await fs.readFile(templatePath, "utf-8");
    const compiled = Handlebars.compile(templateContent);
    this.templateCache.set(templateName, compiled);

    return compiled;
  }
}
`;
  await writeFile(path.join(notifPath, 'channels/email.channel.ts'), emailChannelContent);

  // In-app channel
  const inAppChannelContent = `import { Injectable } from "@nestjs/common";
import { NotificationChannel, Notification } from "../notification.interface";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class InAppChannel implements NotificationChannel {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async send(notification: Notification): Promise<void> {
    this.eventEmitter.emit("notification.created", {
      userId: notification.recipient,
      subject: notification.subject,
      content: notification.content,
      metadata: notification.metadata,
      createdAt: new Date(),
    });
  }
}
`;
  await writeFile(path.join(notifPath, 'channels/in-app.channel.ts'), inAppChannelContent);

  // Notification service
  const notifServiceContent = `import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import { Notification, NotificationOptions, NotificationType } from "./notification.interface";
import { EmailChannel } from "./channels/email.channel";
import { InAppChannel } from "./channels/in-app.channel";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectQueue("notifications") private notificationQueue: Queue,
    private readonly emailChannel: EmailChannel,
    private readonly inAppChannel: InAppChannel
  ) {}

  async send(notification: Notification, options: NotificationOptions): Promise<void> {
    if (options.scheduledAt) {
      const delay = options.scheduledAt.getTime() - Date.now();
      await this.notificationQueue.add(
        "send",
        { notification, options },
        { delay, priority: this.getPriority(options.priority) }
      );
      return;
    }

    await this.processNotification(notification, options);
  }

  async processNotification(notification: Notification, options: NotificationOptions): Promise<void> {
    for (const channel of options.channels) {
      try {
        await this.sendToChannel(channel, notification);
      } catch (error) {
        this.logger.error(\`Failed to send notification via \${channel}\`, error);
      }
    }
  }

  private async sendToChannel(channel: NotificationType, notification: Notification): Promise<void> {
    switch (channel) {
      case "email":
        await this.emailChannel.send(notification);
        break;
      case "in-app":
        await this.inAppChannel.send(notification);
        break;
      case "push":
        // Implement push notification
        this.logger.warn("Push notifications not yet implemented");
        break;
      case "sms":
        // Implement SMS notification
        this.logger.warn("SMS notifications not yet implemented");
        break;
    }
  }

  private getPriority(priority?: "low" | "normal" | "high"): number {
    switch (priority) {
      case "high":
        return 1;
      case "low":
        return 3;
      default:
        return 2;
    }
  }
}
`;
  await writeFile(path.join(notifPath, 'notification.service.ts'), notifServiceContent);

  // Sample template
  const welcomeTemplateContent = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #007bff; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome, {{name}}!</h1>
    </div>
    <div class="content">
      <p>Thank you for joining us. We're excited to have you on board.</p>
      {{#if actionUrl}}
      <p>
        <a href="{{actionUrl}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          {{actionText}}
        </a>
      </p>
      {{/if}}
    </div>
    <div class="footer">
      <p>&copy; {{year}} Your Company. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
  await writeFile(path.join(notifPath, 'templates/welcome.hbs'), welcomeTemplateContent);

  // Index exports
  const indexContent = `export * from "./notification.interface";
export * from "./notification.service";
export * from "./channels/email.channel";
export * from "./channels/in-app.channel";
`;
  await writeFile(path.join(notifPath, 'index.ts'), indexContent);

  console.log(chalk.green('  ✓ NotificationService'));
  console.log(chalk.green('  ✓ EmailChannel'));
  console.log(chalk.green('  ✓ InAppChannel'));
  console.log(chalk.green('  ✓ Welcome email template'));
}

async function applyWebhooksRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const webhookPath = path.join(sharedPath, 'webhooks');

  await ensureDir(webhookPath);

  // Webhook entity
  const webhookEntityContent = `import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export type WebhookEvent =
  | "entity.created"
  | "entity.updated"
  | "entity.deleted"
  | "user.registered"
  | "order.completed"
  | "payment.received";

@Entity("webhooks")
export class WebhookEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  url: string;

  @Column("simple-array")
  events: WebhookEvent[];

  @Column({ nullable: true })
  secret?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  failureCount: number;

  @Column({ type: "timestamp", nullable: true })
  lastTriggeredAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
`;
  await writeFile(path.join(webhookPath, 'webhook.entity.ts'), webhookEntityContent);

  // Webhook delivery entity
  const deliveryEntityContent = `import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { WebhookEntity } from "./webhook.entity";

export type DeliveryStatus = "pending" | "success" | "failed" | "retrying";

@Entity("webhook_deliveries")
export class WebhookDeliveryEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => WebhookEntity)
  @JoinColumn({ name: "webhook_id" })
  webhook: WebhookEntity;

  @Column()
  webhookId: string;

  @Column()
  event: string;

  @Column({ type: "jsonb" })
  payload: Record<string, any>;

  @Column({ default: "pending" })
  status: DeliveryStatus;

  @Column({ nullable: true })
  responseStatus?: number;

  @Column({ type: "text", nullable: true })
  responseBody?: string;

  @Column({ default: 0 })
  attempts: number;

  @Column({ type: "timestamp", nullable: true })
  nextRetryAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
`;
  await writeFile(path.join(webhookPath, 'webhook-delivery.entity.ts'), deliveryEntityContent);

  // Webhook service
  const webhookServiceContent = `import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WebhookEntity, WebhookEvent } from "./webhook.entity";
import { WebhookDeliveryEntity } from "./webhook-delivery.entity";
import axios from "axios";
import * as crypto from "crypto";

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly maxRetries = 3;
  private readonly retryDelays = [60, 300, 900]; // seconds

  constructor(
    @InjectRepository(WebhookEntity)
    private readonly webhookRepo: Repository<WebhookEntity>,
    @InjectRepository(WebhookDeliveryEntity)
    private readonly deliveryRepo: Repository<WebhookDeliveryEntity>
  ) {}

  async registerWebhook(
    name: string,
    url: string,
    events: WebhookEvent[],
    secret?: string
  ): Promise<WebhookEntity> {
    const webhook = this.webhookRepo.create({
      name,
      url,
      events,
      secret: secret || this.generateSecret(),
    });
    return this.webhookRepo.save(webhook);
  }

  async trigger(event: WebhookEvent, payload: Record<string, any>): Promise<void> {
    const webhooks = await this.webhookRepo.find({
      where: { isActive: true },
    });

    const relevantWebhooks = webhooks.filter((w) => w.events.includes(event));

    for (const webhook of relevantWebhooks) {
      await this.deliver(webhook, event, payload);
    }
  }

  private async deliver(
    webhook: WebhookEntity,
    event: string,
    payload: Record<string, any>
  ): Promise<void> {
    const delivery = this.deliveryRepo.create({
      webhookId: webhook.id,
      event,
      payload,
      status: "pending",
    });
    await this.deliveryRepo.save(delivery);

    await this.attemptDelivery(webhook, delivery);
  }

  private async attemptDelivery(
    webhook: WebhookEntity,
    delivery: WebhookDeliveryEntity
  ): Promise<void> {
    try {
      const signature = this.generateSignature(delivery.payload, webhook.secret);

      const response = await axios.post(webhook.url, delivery.payload, {
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": delivery.event,
          "X-Webhook-Delivery": delivery.id,
        },
        timeout: 30000,
      });

      delivery.status = "success";
      delivery.responseStatus = response.status;
      delivery.responseBody = JSON.stringify(response.data).slice(0, 1000);
      delivery.attempts += 1;

      webhook.lastTriggeredAt = new Date();
      webhook.failureCount = 0;

      await Promise.all([
        this.deliveryRepo.save(delivery),
        this.webhookRepo.save(webhook),
      ]);

      this.logger.log(\`Webhook delivered successfully: \${delivery.id}\`);
    } catch (error: any) {
      delivery.attempts += 1;
      delivery.responseStatus = error.response?.status;
      delivery.responseBody = error.message;

      if (delivery.attempts < this.maxRetries) {
        delivery.status = "retrying";
        delivery.nextRetryAt = new Date(
          Date.now() + this.retryDelays[delivery.attempts - 1] * 1000
        );
      } else {
        delivery.status = "failed";
        webhook.failureCount += 1;

        if (webhook.failureCount >= 10) {
          webhook.isActive = false;
          this.logger.warn(\`Webhook disabled due to failures: \${webhook.id}\`);
        }
      }

      await Promise.all([
        this.deliveryRepo.save(delivery),
        this.webhookRepo.save(webhook),
      ]);

      this.logger.error(\`Webhook delivery failed: \${delivery.id}\`, error.message);
    }
  }

  private generateSignature(payload: Record<string, any>, secret?: string): string {
    if (!secret) return "";
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(JSON.stringify(payload));
    return \`sha256=\${hmac.digest("hex")}\`;
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const expected = this.generateSignature(JSON.parse(payload), secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  async getDeliveries(webhookId: string): Promise<WebhookDeliveryEntity[]> {
    return this.deliveryRepo.find({
      where: { webhookId },
      order: { createdAt: "DESC" },
      take: 100,
    });
  }

  async retryDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
      relations: ["webhook"],
    });

    if (!delivery) {
      throw new Error("Delivery not found");
    }

    delivery.status = "pending";
    delivery.attempts = 0;
    await this.deliveryRepo.save(delivery);

    const webhook = await this.webhookRepo.findOne({
      where: { id: delivery.webhookId },
    });

    if (webhook) {
      await this.attemptDelivery(webhook, delivery);
    }
  }
}
`;
  await writeFile(path.join(webhookPath, 'webhook.service.ts'), webhookServiceContent);

  // Index exports
  const indexContent = `export * from "./webhook.entity";
export * from "./webhook-delivery.entity";
export * from "./webhook.service";
`;
  await writeFile(path.join(webhookPath, 'index.ts'), indexContent);

  console.log(chalk.green('  ✓ WebhookEntity'));
  console.log(chalk.green('  ✓ WebhookDeliveryEntity'));
  console.log(chalk.green('  ✓ WebhookService with retry logic'));
  console.log(chalk.green('  ✓ Signature verification'));
}

async function applyTestFactoriesRecipe(basePath: string) {
  const testPath = path.join(basePath, 'test');
  const factoriesPath = path.join(testPath, 'factories');
  const fixturesPath = path.join(testPath, 'fixtures');
  const mocksPath = path.join(testPath, 'mocks');
  const utilsPath = path.join(testPath, 'utils');

  await ensureDir(factoriesPath);
  await ensureDir(fixturesPath);
  await ensureDir(mocksPath);
  await ensureDir(utilsPath);

  // Base factory class
  const baseFactoryContent = `import { faker } from "@faker-js/faker";

/**
 * Base factory class for creating test data
 *
 * Usage:
 *   const factory = new UserFactory();
 *   const user = factory.make();           // Single instance
 *   const users = factory.makeMany(5);     // Multiple instances
 *   const saved = await factory.create();  // Persisted to DB
 */
export abstract class BaseFactory<T> {
  protected abstract definition(): T;

  /**
   * Create a single instance without persisting
   */
  make(overrides: Partial<T> = {}): T {
    return { ...this.definition(), ...overrides };
  }

  /**
   * Create multiple instances without persisting
   */
  makeMany(count: number, overrides: Partial<T> = {}): T[] {
    return Array.from({ length: count }, () => this.make(overrides));
  }

  /**
   * Create and persist a single instance
   * Override this in subclass to implement persistence
   */
  async create(overrides: Partial<T> = {}): Promise<T> {
    return this.make(overrides);
  }

  /**
   * Create and persist multiple instances
   */
  async createMany(count: number, overrides: Partial<T> = {}): Promise<T[]> {
    return Promise.all(
      Array.from({ length: count }, () => this.create(overrides))
    );
  }

  /**
   * Create instance with specific state
   */
  state(stateOverrides: Partial<T>): this {
    const original = this.definition.bind(this);
    this.definition = () => ({ ...original(), ...stateOverrides });
    return this;
  }
}

/**
 * Factory with repository support for database persistence
 */
export abstract class PersistentFactory<T, R = any> extends BaseFactory<T> {
  constructor(protected repository?: R) {
    super();
  }

  setRepository(repository: R): this {
    this.repository = repository;
    return this;
  }

  abstract persist(entity: T): Promise<T>;

  async create(overrides: Partial<T> = {}): Promise<T> {
    const entity = this.make(overrides);
    if (this.repository) {
      return this.persist(entity);
    }
    return entity;
  }
}

// Re-export faker for convenience
export { faker };
`;
  await writeFile(path.join(factoriesPath, 'base.factory.ts'), baseFactoryContent);

  // Example user factory
  const exampleFactoryContent = `import { faker } from "@faker-js/faker";
import { BaseFactory, PersistentFactory } from "./base.factory";

/**
 * Example interfaces - replace with your actual entity types
 */
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  isActive: boolean;
  role: "admin" | "user" | "guest";
  createdAt: Date;
  updatedAt: Date;
}

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  isPublished: boolean;
  tags: string[];
  createdAt: Date;
}

/**
 * User Factory
 */
export class UserFactory extends BaseFactory<User> {
  protected definition(): User {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email().toLowerCase(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      password: faker.internet.password({ length: 12 }),
      isActive: true,
      role: "user",
      createdAt: faker.date.past(),
      updatedAt: new Date(),
    };
  }

  /**
   * Create an admin user
   */
  admin(): this {
    return this.state({ role: "admin" });
  }

  /**
   * Create an inactive user
   */
  inactive(): this {
    return this.state({ isActive: false });
  }

  /**
   * Create a user with specific email domain
   */
  withDomain(domain: string): this {
    return this.state({
      email: \`\${faker.internet.username()}@\${domain}\`.toLowerCase(),
    });
  }

  /**
   * Create a recently registered user
   */
  recent(): this {
    return this.state({
      createdAt: faker.date.recent({ days: 7 }),
    });
  }
}

/**
 * Post Factory
 */
export class PostFactory extends BaseFactory<Post> {
  protected definition(): Post {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.sentence(),
      content: faker.lorem.paragraphs(3),
      authorId: faker.string.uuid(),
      isPublished: false,
      tags: faker.helpers.arrayElements(
        ["tech", "news", "tutorial", "review", "opinion"],
        { min: 1, max: 3 }
      ),
      createdAt: faker.date.past(),
    };
  }

  /**
   * Create a published post
   */
  published(): this {
    return this.state({ isPublished: true });
  }

  /**
   * Create a post by specific author
   */
  byAuthor(authorId: string): this {
    return this.state({ authorId });
  }

  /**
   * Create a post with specific tags
   */
  withTags(...tags: string[]): this {
    return this.state({ tags });
  }
}

// Export singleton instances for convenience
export const userFactory = new UserFactory();
export const postFactory = new PostFactory();
`;
  await writeFile(path.join(factoriesPath, 'example.factory.ts'), exampleFactoryContent);

  // Test data builder pattern
  const builderContent = `import { faker } from "@faker-js/faker";

/**
 * Test Data Builder Pattern
 *
 * More flexible than factories for complex object construction
 *
 * Usage:
 *   const user = new UserBuilder()
 *     .withEmail("test@example.com")
 *     .asAdmin()
 *     .build();
 */
export class TestDataBuilder<T> {
  protected data: Partial<T> = {};

  constructor(protected defaults: () => T) {}

  /**
   * Set a specific field value
   */
  with<K extends keyof T>(key: K, value: T[K]): this {
    this.data[key] = value;
    return this;
  }

  /**
   * Set multiple fields at once
   */
  withOverrides(overrides: Partial<T>): this {
    this.data = { ...this.data, ...overrides };
    return this;
  }

  /**
   * Build the final object
   */
  build(): T {
    return { ...this.defaults(), ...this.data };
  }

  /**
   * Build multiple objects
   */
  buildMany(count: number): T[] {
    return Array.from({ length: count }, () => this.build());
  }

  /**
   * Reset builder state
   */
  reset(): this {
    this.data = {};
    return this;
  }
}

/**
 * Example User Builder
 */
export class UserBuilder extends TestDataBuilder<{
  id: string;
  email: string;
  name: string;
  role: string;
  isVerified: boolean;
}> {
  constructor() {
    super(() => ({
      id: faker.string.uuid(),
      email: faker.internet.email(),
      name: faker.person.fullName(),
      role: "user",
      isVerified: false,
    }));
  }

  withEmail(email: string): this {
    return this.with("email", email);
  }

  withName(name: string): this {
    return this.with("name", name);
  }

  asAdmin(): this {
    return this.with("role", "admin");
  }

  verified(): this {
    return this.with("isVerified", true);
  }
}
`;
  await writeFile(path.join(factoriesPath, 'builder.ts'), builderContent);

  // Database fixture utilities
  const fixtureUtilsContent = `import { DataSource, Repository, ObjectLiteral } from "typeorm";

/**
 * Database Fixture Manager
 *
 * Handles test database setup, seeding, and cleanup
 */
export class FixtureManager {
  private loadedFixtures: Map<string, any[]> = new Map();

  constructor(private dataSource: DataSource) {}

  /**
   * Load fixtures from a fixture class
   */
  async load<T extends ObjectLiteral>(
    repository: Repository<T>,
    data: Partial<T>[]
  ): Promise<T[]> {
    const entities = data.map((item) => repository.create(item));
    const saved = await repository.save(entities);

    const key = repository.metadata.name;
    this.loadedFixtures.set(key, [
      ...(this.loadedFixtures.get(key) || []),
      ...saved,
    ]);

    return saved;
  }

  /**
   * Get loaded fixtures by entity name
   */
  get<T>(entityName: string): T[] {
    return (this.loadedFixtures.get(entityName) || []) as T[];
  }

  /**
   * Clear all data from specified tables
   */
  async clear(...entityNames: string[]): Promise<void> {
    for (const name of entityNames) {
      const repository = this.dataSource.getRepository(name);
      await repository.clear();
      this.loadedFixtures.delete(name);
    }
  }

  /**
   * Clear all loaded fixtures
   */
  async clearAll(): Promise<void> {
    // Disable foreign key checks temporarily
    await this.dataSource.query("SET CONSTRAINTS ALL DEFERRED");

    for (const [name] of this.loadedFixtures) {
      try {
        const repository = this.dataSource.getRepository(name);
        await repository.clear();
      } catch (error) {
        console.warn(\`Failed to clear \${name}:\`, error);
      }
    }

    await this.dataSource.query("SET CONSTRAINTS ALL IMMEDIATE");
    this.loadedFixtures.clear();
  }

  /**
   * Reset database to clean state
   */
  async reset(): Promise<void> {
    await this.clearAll();
    await this.dataSource.synchronize(true);
  }
}

/**
 * Fixture definition interface
 */
export interface Fixture<T = any> {
  name: string;
  entity: new () => T;
  data: () => Partial<T>[];
  dependencies?: string[];
}

/**
 * Fixture loader for managing fixture dependencies
 */
export class FixtureLoader {
  private fixtures: Map<string, Fixture> = new Map();
  private loaded: Set<string> = new Set();

  register(fixture: Fixture): this {
    this.fixtures.set(fixture.name, fixture);
    return this;
  }

  async load(
    name: string,
    manager: FixtureManager,
    dataSource: DataSource
  ): Promise<any[]> {
    if (this.loaded.has(name)) {
      return manager.get(name);
    }

    const fixture = this.fixtures.get(name);
    if (!fixture) {
      throw new Error(\`Fixture "\${name}" not found\`);
    }

    // Load dependencies first
    if (fixture.dependencies) {
      for (const dep of fixture.dependencies) {
        await this.load(dep, manager, dataSource);
      }
    }

    const repository = dataSource.getRepository(fixture.entity);
    const result = await manager.load(repository, fixture.data());
    this.loaded.add(name);

    return result;
  }

  reset(): void {
    this.loaded.clear();
  }
}
`;
  await writeFile(path.join(fixturesPath, 'fixture.utils.ts'), fixtureUtilsContent);

  // Example fixtures
  const exampleFixturesContent = `import { faker } from "@faker-js/faker";
import { Fixture } from "./fixture.utils";

/**
 * Example fixture definitions
 * Replace with your actual entities
 */

export const usersFixture: Fixture = {
  name: "users",
  entity: class User {} as any, // Replace with actual entity
  data: () => [
    {
      id: "user-1",
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      isActive: true,
    },
    {
      id: "user-2",
      email: "user@example.com",
      firstName: "Regular",
      lastName: "User",
      role: "user",
      isActive: true,
    },
    {
      id: "user-3",
      email: "inactive@example.com",
      firstName: "Inactive",
      lastName: "User",
      role: "user",
      isActive: false,
    },
  ],
};

export const postsFixture: Fixture = {
  name: "posts",
  entity: class Post {} as any, // Replace with actual entity
  dependencies: ["users"],
  data: () => [
    {
      id: "post-1",
      title: "First Post",
      content: "This is the first post content",
      authorId: "user-1",
      isPublished: true,
    },
    {
      id: "post-2",
      title: "Draft Post",
      content: "This is a draft",
      authorId: "user-2",
      isPublished: false,
    },
  ],
};

/**
 * Generate dynamic fixtures with faker
 */
export function generateUsersFixture(count: number): Fixture {
  return {
    name: \`users_\${count}\`,
    entity: class User {} as any,
    data: () =>
      Array.from({ length: count }, (_, i) => ({
        id: faker.string.uuid(),
        email: faker.internet.email(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        role: i === 0 ? "admin" : "user",
        isActive: faker.datatype.boolean({ probability: 0.9 }),
      })),
  };
}
`;
  await writeFile(path.join(fixturesPath, 'example.fixtures.ts'), exampleFixturesContent);

  // Mock utilities
  const mockUtilsContent = `/**
 * Mock Utilities for Testing
 */

/**
 * Create a mock repository with common TypeORM methods
 */
export function createMockRepository<T = any>() {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: "mock-id", ...entity })),
    create: jest.fn().mockImplementation((dto) => dto),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    restore: jest.fn().mockResolvedValue({ affected: 1 }),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
    manager: {
      transaction: jest.fn((cb) => cb({
        save: jest.fn(),
        remove: jest.fn(),
      })),
    },
  };
}

/**
 * Create a mock query builder
 */
export function createMockQueryBuilder<T = any>() {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getCount: jest.fn().mockResolvedValue(0),
    getRawOne: jest.fn().mockResolvedValue(null),
    getRawMany: jest.fn().mockResolvedValue([]),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  return qb;
}

/**
 * Create a mock Prisma client
 */
export function createMockPrismaClient() {
  const createModelMock = () => ({
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "mock-id", ...data })),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({}),
    groupBy: jest.fn().mockResolvedValue([]),
  });

  return {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn((cb) => cb({})),
    // Add model mocks as needed
    user: createModelMock(),
    post: createModelMock(),
  };
}

/**
 * Create a mock service with all methods as jest functions
 */
export function createMockService<T extends object>(
  methods: (keyof T)[]
): jest.Mocked<T> {
  const mock: any = {};
  for (const method of methods) {
    mock[method] = jest.fn();
  }
  return mock;
}

/**
 * Create a mock request object
 */
export function createMockRequest(overrides: any = {}) {
  return {
    user: { id: "user-1", email: "test@example.com", roles: ["user"] },
    params: {},
    query: {},
    body: {},
    headers: {},
    ip: "127.0.0.1",
    ...overrides,
  };
}

/**
 * Create a mock response object
 */
export function createMockResponse() {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Create a mock execution context for guards/interceptors
 */
export function createMockExecutionContext(request: any = {}, response: any = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => createMockRequest(request),
      getResponse: () => createMockResponse(),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    getArgs: () => [],
    getArgByIndex: () => ({}),
    switchToRpc: () => ({}),
    switchToWs: () => ({}),
    getType: () => "http",
  };
}
`;
  await writeFile(path.join(mocksPath, 'mock.utils.ts'), mockUtilsContent);

  // Test setup utilities
  const testSetupContent = `import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DataSource } from "typeorm";

/**
 * Test Setup Utilities
 */

/**
 * Create a testing module with common configuration
 */
export async function createTestingModule(
  imports: any[] = [],
  providers: any[] = [],
  controllers: any[] = []
): Promise<TestingModule> {
  return Test.createTestingModule({
    imports,
    providers,
    controllers,
  }).compile();
}

/**
 * Create and configure a test application
 */
export async function createTestApp(
  module: TestingModule,
  options: {
    validation?: boolean;
    prefix?: string;
  } = {}
): Promise<INestApplication> {
  const app = module.createNestApplication();

  if (options.validation !== false) {
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );
  }

  if (options.prefix) {
    app.setGlobalPrefix(options.prefix);
  }

  await app.init();
  return app;
}

/**
 * Clean up test resources
 */
export async function cleanupTest(
  app?: INestApplication,
  dataSource?: DataSource
): Promise<void> {
  if (dataSource?.isInitialized) {
    await dataSource.destroy();
  }
  if (app) {
    await app.close();
  }
}

/**
 * Wait for condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(\`Condition not met within \${timeout}ms\`);
}

/**
 * Retry async operation
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delay = 100
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
`;
  await writeFile(path.join(utilsPath, 'test-setup.utils.ts'), testSetupContent);

  // Index exports
  const factoriesIndexContent = `export * from "./base.factory";
export * from "./example.factory";
export * from "./builder";
`;
  await writeFile(path.join(factoriesPath, 'index.ts'), factoriesIndexContent);

  const fixturesIndexContent = `export * from "./fixture.utils";
export * from "./example.fixtures";
`;
  await writeFile(path.join(fixturesPath, 'index.ts'), fixturesIndexContent);

  const mocksIndexContent = `export * from "./mock.utils";
`;
  await writeFile(path.join(mocksPath, 'index.ts'), mocksIndexContent);

  const utilsIndexContent = `export * from "./test-setup.utils";
`;
  await writeFile(path.join(utilsPath, 'index.ts'), utilsIndexContent);

  // Main test index
  const mainIndexContent = `export * from "./factories";
export * from "./fixtures";
export * from "./mocks";
export * from "./utils";
`;
  await writeFile(path.join(testPath, 'index.ts'), mainIndexContent);

  console.log(chalk.green('  ✓ Base factory class with state support'));
  console.log(chalk.green('  ✓ Example factories (User, Post) with fluent API'));
  console.log(chalk.green('  ✓ Test data builder pattern'));
  console.log(chalk.green('  ✓ Database fixture manager with dependencies'));
  console.log(chalk.green('  ✓ Mock utilities (Repository, QueryBuilder, Prisma, Request/Response)'));
  console.log(chalk.green('  ✓ Test setup utilities (createTestApp, cleanup, waitFor, retry)'));
}

async function applyApiVersioningRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const versioningPath = path.join(sharedPath, 'versioning');

  await ensureDir(versioningPath);
  await ensureDir(path.join(versioningPath, 'decorators'));
  await ensureDir(path.join(versioningPath, 'interceptors'));

  // Version configuration
  const versionConfigContent = `/**
 * API Versioning Configuration
 *
 * Supports multiple versioning strategies:
 * - URI: /api/v1/users, /api/v2/users
 * - Header: X-API-Version: 1
 * - Media Type: Accept: application/vnd.api.v1+json
 * - Query: /api/users?version=1
 */

export enum VersioningStrategy {
  URI = "uri",
  HEADER = "header",
  MEDIA_TYPE = "media_type",
  QUERY = "query",
}

export interface ApiVersion {
  version: string;
  deprecatedAt?: Date;
  sunsetAt?: Date;
  replacedBy?: string;
  changelog?: string;
}

export const API_VERSIONS: ApiVersion[] = [
  {
    version: "1",
    deprecatedAt: undefined,
    sunsetAt: undefined,
    replacedBy: undefined,
  },
  // Add new versions here:
  // {
  //   version: "2",
  //   deprecatedAt: undefined,
  //   sunsetAt: undefined,
  //   replacedBy: undefined,
  // },
];

export const CURRENT_VERSION = "1";
export const SUPPORTED_VERSIONS = API_VERSIONS.map((v) => v.version);
export const DEFAULT_VERSION = "1";

/**
 * Get version info by version number
 */
export function getVersionInfo(version: string): ApiVersion | undefined {
  return API_VERSIONS.find((v) => v.version === version);
}

/**
 * Check if a version is deprecated
 */
export function isVersionDeprecated(version: string): boolean {
  const info = getVersionInfo(version);
  return info?.deprecatedAt ? new Date() >= info.deprecatedAt : false;
}

/**
 * Check if a version is sunset (no longer supported)
 */
export function isVersionSunset(version: string): boolean {
  const info = getVersionInfo(version);
  return info?.sunsetAt ? new Date() >= info.sunsetAt : false;
}

/**
 * Get days until sunset for a version
 */
export function getDaysUntilSunset(version: string): number | null {
  const info = getVersionInfo(version);
  if (!info?.sunsetAt) return null;
  const diff = info.sunsetAt.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
`;
  await writeFile(path.join(versioningPath, 'version.config.ts'), versionConfigContent);

  // Version decorator
  const versionDecoratorContent = `import { SetMetadata, applyDecorators } from "@nestjs/common";
import { ApiHeader, ApiOperation } from "@nestjs/swagger";

export const API_VERSION_KEY = "api_version";
export const DEPRECATED_VERSION_KEY = "deprecated_version";
export const MIN_VERSION_KEY = "min_version";
export const MAX_VERSION_KEY = "max_version";

/**
 * Mark a controller or method as available in specific version(s)
 * @param versions - Version(s) this endpoint is available in
 */
export const ApiVersion = (...versions: string[]) =>
  SetMetadata(API_VERSION_KEY, versions);

/**
 * Mark an endpoint as deprecated
 * @param message - Deprecation message
 * @param replacedBy - The new endpoint/version to use
 * @param sunsetDate - When this endpoint will be removed
 */
export const DeprecatedVersion = (
  message: string,
  replacedBy?: string,
  sunsetDate?: Date
) =>
  applyDecorators(
    SetMetadata(DEPRECATED_VERSION_KEY, { message, replacedBy, sunsetDate }),
    ApiOperation({
      deprecated: true,
      description: \`**DEPRECATED**: \${message}\${replacedBy ? \` Use \${replacedBy} instead.\` : ""}\`,
    })
  );

/**
 * Require minimum API version
 */
export const MinVersion = (version: string) =>
  SetMetadata(MIN_VERSION_KEY, version);

/**
 * Require maximum API version (useful for sunset endpoints)
 */
export const MaxVersion = (version: string) =>
  SetMetadata(MAX_VERSION_KEY, version);

/**
 * Combined decorator for versioned endpoint with Swagger docs
 */
export const VersionedEndpoint = (version: string, deprecated = false) =>
  applyDecorators(
    ApiVersion(version),
    ApiHeader({
      name: "X-API-Version",
      description: \`API Version (current: \${version})\`,
      required: false,
    }),
    ...(deprecated ? [DeprecatedVersion(\`This endpoint is deprecated in v\${version}\`)] : [])
  );
`;
  await writeFile(path.join(versioningPath, 'decorators/version.decorator.ts'), versionDecoratorContent);

  // Version interceptor
  const versionInterceptorContent = `import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Reflector } from "@nestjs/core";
import {
  DEPRECATED_VERSION_KEY,
  API_VERSION_KEY,
} from "../decorators/version.decorator";
import { getVersionInfo, isVersionDeprecated } from "../version.config";

@Injectable()
export class VersionHeaderInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();
    const request = context.switchToHttp().getRequest();

    // Get current API version from request
    const apiVersion = request.apiVersion || request.headers["x-api-version"] || "1";

    // Get version metadata from handler/controller
    const versions = this.reflector.getAllAndOverride<string[]>(API_VERSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const deprecationInfo = this.reflector.getAllAndOverride<any>(
      DEPRECATED_VERSION_KEY,
      [context.getHandler(), context.getClass()]
    );

    return next.handle().pipe(
      tap(() => {
        // Always add current version header
        response.setHeader("X-API-Version", apiVersion);

        // Add supported versions header
        if (versions) {
          response.setHeader("X-API-Supported-Versions", versions.join(", "));
        }

        // Add deprecation headers if applicable
        if (deprecationInfo || isVersionDeprecated(apiVersion)) {
          const versionInfo = getVersionInfo(apiVersion);

          response.setHeader("Deprecation", "true");

          if (deprecationInfo?.sunsetDate || versionInfo?.sunsetAt) {
            const sunsetDate = deprecationInfo?.sunsetDate || versionInfo?.sunsetAt;
            response.setHeader("Sunset", sunsetDate.toUTCString());
          }

          if (deprecationInfo?.replacedBy || versionInfo?.replacedBy) {
            const replacement = deprecationInfo?.replacedBy || versionInfo?.replacedBy;
            response.setHeader("Link", \`<\${replacement}>; rel="successor-version"\`);
          }

          // Add warning header for deprecated APIs
          const message = deprecationInfo?.message || "This API version is deprecated";
          response.setHeader(
            "Warning",
            \`299 - "\${message}"\`
          );
        }
      })
    );
  }
}
`;
  await writeFile(path.join(versioningPath, 'interceptors/version-header.interceptor.ts'), versionInterceptorContent);

  // Version guard
  const versionGuardContent = `import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  API_VERSION_KEY,
  MIN_VERSION_KEY,
  MAX_VERSION_KEY,
} from "../decorators/version.decorator";
import {
  SUPPORTED_VERSIONS,
  isVersionSunset,
  getVersionInfo,
} from "../version.config";

@Injectable()
export class ApiVersionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Extract version from various sources
    const version = this.extractVersion(request);
    request.apiVersion = version;

    // Check if version is supported
    if (!SUPPORTED_VERSIONS.includes(version)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: "Unsupported API Version",
          message: \`API version '\${version}' is not supported. Supported versions: \${SUPPORTED_VERSIONS.join(", ")}\`,
          supportedVersions: SUPPORTED_VERSIONS,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // Check if version is sunset
    if (isVersionSunset(version)) {
      const versionInfo = getVersionInfo(version);
      throw new HttpException(
        {
          statusCode: HttpStatus.GONE,
          error: "API Version Sunset",
          message: \`API version '\${version}' is no longer supported.\`,
          sunsetDate: versionInfo?.sunsetAt,
          replacedBy: versionInfo?.replacedBy,
        },
        HttpStatus.GONE
      );
    }

    // Check version constraints from decorators
    const allowedVersions = this.reflector.getAllAndOverride<string[]>(
      API_VERSION_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (allowedVersions && !allowedVersions.includes(version)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: "Version Not Available",
          message: \`This endpoint is not available in API version '\${version}'. Available in: \${allowedVersions.join(", ")}\`,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // Check min version
    const minVersion = this.reflector.getAllAndOverride<string>(MIN_VERSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (minVersion && this.compareVersions(version, minVersion) < 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: "Version Too Low",
          message: \`This endpoint requires API version \${minVersion} or higher.\`,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // Check max version
    const maxVersion = this.reflector.getAllAndOverride<string>(MAX_VERSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (maxVersion && this.compareVersions(version, maxVersion) > 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.GONE,
          error: "Endpoint Removed",
          message: \`This endpoint was removed in API version \${maxVersion}.\`,
        },
        HttpStatus.GONE
      );
    }

    return true;
  }

  private extractVersion(request: any): string {
    // Priority: URL param > Header > Query > Default

    // 1. URL versioning: /api/v1/...
    const urlMatch = request.url?.match(/\\/v(\\d+)\\//);
    if (urlMatch) return urlMatch[1];

    // 2. Header versioning: X-API-Version
    const headerVersion = request.headers["x-api-version"];
    if (headerVersion) return headerVersion;

    // 3. Accept header versioning: application/vnd.api.v1+json
    const acceptHeader = request.headers["accept"];
    if (acceptHeader) {
      const acceptMatch = acceptHeader.match(/vnd\\.api\\.v(\\d+)/);
      if (acceptMatch) return acceptMatch[1];
    }

    // 4. Query parameter: ?version=1
    if (request.query?.version) return request.query.version;

    // 5. Default version
    return "1";
  }

  private compareVersions(a: string, b: string): number {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    return numA - numB;
  }
}
`;
  await writeFile(path.join(versioningPath, 'guards/version.guard.ts'), versionGuardContent);

  // Versioning module
  const versioningModuleContent = `import { Module, Global } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ApiVersionGuard } from "./guards/version.guard";
import { VersionHeaderInterceptor } from "./interceptors/version-header.interceptor";

@Global()
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiVersionGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: VersionHeaderInterceptor,
    },
  ],
  exports: [],
})
export class VersioningModule {}

/**
 * NestJS built-in versioning configuration helper
 * Use in main.ts:
 *
 * import { VersioningType } from "@nestjs/common";
 *
 * app.enableVersioning({
 *   type: VersioningType.URI,        // /v1/users
 *   // OR
 *   type: VersioningType.HEADER,     // X-API-Version: 1
 *   header: "X-API-Version",
 *   // OR
 *   type: VersioningType.MEDIA_TYPE, // Accept: application/vnd.api.v1+json
 *   key: "v=",
 * });
 */
export const VERSIONING_CONFIG = {
  uri: {
    type: "URI" as const,
    prefix: "v",
  },
  header: {
    type: "HEADER" as const,
    header: "X-API-Version",
  },
  mediaType: {
    type: "MEDIA_TYPE" as const,
    key: "v=",
  },
};
`;
  await writeFile(path.join(versioningPath, 'versioning.module.ts'), versioningModuleContent);

  // Version migration helper
  const migrationHelperContent = `/**
 * API Version Migration Helper
 *
 * Utilities for migrating between API versions
 */

export interface MigrationRule<TFrom, TTo> {
  fromVersion: string;
  toVersion: string;
  transform: (data: TFrom) => TTo;
}

export class VersionMigrator<T = any> {
  private rules: MigrationRule<any, any>[] = [];

  /**
   * Register a migration rule
   */
  register<TFrom, TTo>(
    fromVersion: string,
    toVersion: string,
    transform: (data: TFrom) => TTo
  ): this {
    this.rules.push({ fromVersion, toVersion, transform });
    return this;
  }

  /**
   * Migrate data from one version to another
   */
  migrate(data: T, fromVersion: string, toVersion: string): T {
    if (fromVersion === toVersion) return data;

    const path = this.findMigrationPath(fromVersion, toVersion);
    if (!path) {
      throw new Error(
        \`No migration path found from v\${fromVersion} to v\${toVersion}\`
      );
    }

    let result = data;
    for (const rule of path) {
      result = rule.transform(result);
    }

    return result;
  }

  private findMigrationPath(
    from: string,
    to: string
  ): MigrationRule<any, any>[] | null {
    // Simple linear path finding
    const path: MigrationRule<any, any>[] = [];
    let current = from;

    while (current !== to) {
      const rule = this.rules.find((r) => r.fromVersion === current);
      if (!rule) return null;
      path.push(rule);
      current = rule.toVersion;
    }

    return path;
  }
}

/**
 * Example usage:
 *
 * const userMigrator = new VersionMigrator<UserDto>();
 *
 * userMigrator
 *   .register("1", "2", (v1User) => ({
 *     ...v1User,
 *     fullName: \`\${v1User.firstName} \${v1User.lastName}\`,
 *   }))
 *   .register("2", "3", (v2User) => ({
 *     ...v2User,
 *     email: v2User.email.toLowerCase(),
 *   }));
 *
 * const v3User = userMigrator.migrate(v1User, "1", "3");
 */

/**
 * Decorator for automatic response transformation based on version
 */
export function TransformForVersion<T>(
  migrator: VersionMigrator<T>,
  targetVersion: string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      const request = args.find((arg) => arg?.apiVersion);
      const currentVersion = request?.apiVersion || "1";

      if (currentVersion !== targetVersion) {
        return migrator.migrate(result, targetVersion, currentVersion);
      }

      return result;
    };

    return descriptor;
  };
}
`;
  await writeFile(path.join(versioningPath, 'migration.helper.ts'), migrationHelperContent);

  // Create guards directory and index
  await ensureDir(path.join(versioningPath, 'guards'));
  const guardsIndexContent = `export * from "./version.guard";
`;
  await writeFile(path.join(versioningPath, 'guards/index.ts'), guardsIndexContent);

  // Index exports
  const indexContent = `export * from "./version.config";
export * from "./versioning.module";
export * from "./migration.helper";
export * from "./decorators/version.decorator";
export * from "./guards/version.guard";
export * from "./interceptors/version-header.interceptor";
`;
  await writeFile(path.join(versioningPath, 'index.ts'), indexContent);

  // Decorators index
  const decoratorsIndexContent = `export * from "./version.decorator";
`;
  await writeFile(path.join(versioningPath, 'decorators/index.ts'), decoratorsIndexContent);

  // Interceptors index
  const interceptorsIndexContent = `export * from "./version-header.interceptor";
`;
  await writeFile(path.join(versioningPath, 'interceptors/index.ts'), interceptorsIndexContent);

  console.log(chalk.green('  ✓ Version configuration (URI/Header/MediaType/Query support)'));
  console.log(chalk.green('  ✓ Version decorators (@ApiVersion, @DeprecatedVersion, @MinVersion)'));
  console.log(chalk.green('  ✓ Version guard with sunset support'));
  console.log(chalk.green('  ✓ Version header interceptor (Deprecation, Sunset, Warning headers)'));
  console.log(chalk.green('  ✓ Migration helper for version transformations'));
}

async function applyHealthRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const healthPath = path.join(sharedPath, 'health');
  const loggingPath = path.join(sharedPath, 'logging');

  await ensureDir(healthPath);
  await ensureDir(loggingPath);

  // Health controller
  const healthControllerContent = `import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from "@nestjs/terminus";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";

@ApiTags("Health")
@Controller("health")
@SkipThrottle()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: "Basic health check" })
  check() {
    return this.health.check([
      () => this.db.pingCheck("database"),
    ]);
  }

  @Get("ready")
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: "Readiness check - is the service ready to receive traffic?" })
  readiness() {
    return this.health.check([
      () => this.db.pingCheck("database"),
      () => this.memory.checkHeap("memory_heap", 300 * 1024 * 1024), // 300MB
    ]);
  }

  @Get("live")
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: "Liveness check - is the service alive?" })
  liveness() {
    return this.health.check([
      () => this.memory.checkRSS("memory_rss", 500 * 1024 * 1024), // 500MB
    ]);
  }

  @Get("detailed")
  @HealthCheck()
  @ApiOperation({ summary: "Detailed health check with all indicators" })
  detailed() {
    return this.health.check([
      () => this.db.pingCheck("database"),
      () => this.memory.checkHeap("memory_heap", 300 * 1024 * 1024),
      () => this.memory.checkRSS("memory_rss", 500 * 1024 * 1024),
      () =>
        this.disk.checkStorage("disk", {
          path: "/",
          thresholdPercent: 0.9, // 90% threshold
        }),
    ]);
  }
}
`;
  await writeFile(path.join(healthPath, 'health.controller.ts'), healthControllerContent);

  // Health module
  const healthModuleContent = `import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HttpModule } from "@nestjs/axios";
import { HealthController } from "./health.controller";

@Module({
  imports: [TerminusModule, HttpModule],
  controllers: [HealthController],
})
export class HealthModule {}
`;
  await writeFile(path.join(healthPath, 'health.module.ts'), healthModuleContent);

  // Custom health indicator example
  const customIndicatorContent = `import { Injectable } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import Redis from "ioredis";

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private redis: Redis;

  constructor() {
    super();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        "Redis check failed",
        this.getStatus(key, false, { error: (error as Error).message })
      );
    }
  }
}

@Injectable()
export class ExternalServiceHealthIndicator extends HealthIndicator {
  async isHealthy(key: string, url: string): Promise<HealthIndicatorResult> {
    try {
      const start = Date.now();
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      const latency = Date.now() - start;

      if (response.ok) {
        return this.getStatus(key, true, { latency: \`\${latency}ms\` });
      }

      throw new Error(\`HTTP \${response.status}\`);
    } catch (error) {
      throw new HealthCheckError(
        \`\${key} check failed\`,
        this.getStatus(key, false, { error: (error as Error).message })
      );
    }
  }
}
`;
  await writeFile(path.join(healthPath, 'custom.indicators.ts'), customIndicatorContent);

  // Logging configuration
  const loggingConfigContent = `import { Params } from "nestjs-pino";

export const loggerConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL || "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              singleLine: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    autoLogging: {
      ignore: (req) => {
        // Don't log health check requests
        return req.url?.includes("/health") || false;
      },
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
        "body.password",
        "body.token",
        "body.secret",
      ],
      censor: "[REDACTED]",
    },
    customProps: (req) => ({
      requestId: req.id,
      userAgent: req.headers["user-agent"],
    }),
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage: (req, res) => {
      return \`\${req.method} \${req.url} \${res.statusCode}\`;
    },
    customErrorMessage: (req, res, err) => {
      return \`\${req.method} \${req.url} failed: \${err.message}\`;
    },
  },
};
`;
  await writeFile(path.join(loggingPath, 'logger.config.ts'), loggingConfigContent);

  // Logging module
  const loggingModuleContent = `import { Module } from "@nestjs/common";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";
import { loggerConfig } from "./logger.config";

@Module({
  imports: [PinoLoggerModule.forRoot(loggerConfig)],
  exports: [PinoLoggerModule],
})
export class LoggingModule {}
`;
  await writeFile(path.join(loggingPath, 'logging.module.ts'), loggingModuleContent);

  // Request context
  const requestContextContent = `import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { v4 as uuid } from "uuid";
import { AsyncLocalStorage } from "async_hooks";

export interface RequestContext {
  requestId: string;
  userId?: string;
  startTime: number;
  path: string;
  method: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || uuid();
    const userId = (req as any).user?.id;

    const context: RequestContext = {
      requestId,
      userId,
      startTime: Date.now(),
      path: req.path,
      method: req.method,
    };

    // Set request ID header for response
    res.setHeader("X-Request-Id", requestId);

    requestContextStorage.run(context, () => {
      next();
    });
  }
}

/**
 * Get current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Get current request ID
 */
export function getRequestId(): string | undefined {
  return getRequestContext()?.requestId;
}
`;
  await writeFile(path.join(loggingPath, 'request-context.ts'), requestContextContent);

  // Metrics utility
  const metricsContent = `import { Injectable, Logger } from "@nestjs/common";

export interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: Date;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private metrics: Map<string, number[]> = new Map();

  /**
   * Record a metric value
   */
  record(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getKey(name, tags);

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const values = this.metrics.get(key)!;
    values.push(value);

    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
  }

  /**
   * Increment a counter
   */
  increment(name: string, tags?: Record<string, string>): void {
    this.record(name, 1, tags);
  }

  /**
   * Record timing in milliseconds
   */
  timing(name: string, duration: number, tags?: Record<string, string>): void {
    this.record(\`\${name}.timing\`, duration, tags);
  }

  /**
   * Measure execution time of a function
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.timing(name, Date.now() - start, { ...tags, status: "success" });
      return result;
    } catch (error) {
      this.timing(name, Date.now() - start, { ...tags, status: "error" });
      throw error;
    }
  }

  /**
   * Get metric statistics
   */
  getStats(name: string, tags?: Record<string, string>): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const key = this.getKey(name, tags);
    const values = this.metrics.get(key);

    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: sorted.reduce((a, b) => a + b, 0) / count,
      p50: sorted[Math.floor(count * 0.5)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key] of this.metrics) {
      result[key] = this.getStats(key);
    }

    return result;
  }

  private getKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => \`\${k}=\${v}\`)
      .join(",");
    return \`\${name}{\${tagStr}}\`;
  }
}
`;
  await writeFile(path.join(loggingPath, 'metrics.service.ts'), metricsContent);

  // Index exports
  const healthIndexContent = `export * from "./health.controller";
export * from "./health.module";
export * from "./custom.indicators";
`;
  await writeFile(path.join(healthPath, 'index.ts'), healthIndexContent);

  const loggingIndexContent = `export * from "./logger.config";
export * from "./logging.module";
export * from "./request-context";
export * from "./metrics.service";
`;
  await writeFile(path.join(loggingPath, 'index.ts'), loggingIndexContent);

  console.log(chalk.green('  ✓ Health controller (/health, /health/ready, /health/live)'));
  console.log(chalk.green('  ✓ Custom health indicators (Redis, External Services)'));
  console.log(chalk.green('  ✓ Pino logging with redaction'));
  console.log(chalk.green('  ✓ Request context with AsyncLocalStorage'));
  console.log(chalk.green('  ✓ Metrics service with percentiles'));
}

async function applyRateLimitingRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const rateLimitPath = path.join(sharedPath, 'rate-limit');

  await ensureDir(rateLimitPath);
  await ensureDir(path.join(rateLimitPath, 'guards'));
  await ensureDir(path.join(rateLimitPath, 'decorators'));

  // Custom throttler decorator
  const throttleDecoratorContent = `import { SetMetadata, applyDecorators } from "@nestjs/common";
import { Throttle, SkipThrottle } from "@nestjs/throttler";

export const RATE_LIMIT_KEY = "rate_limit_config";

export interface RateLimitConfig {
  ttl: number;      // Time window in seconds
  limit: number;    // Max requests in time window
  blockDuration?: number; // How long to block after exceeding limit (seconds)
}

/**
 * Apply rate limiting to a route
 * @param limit - Max requests allowed
 * @param ttl - Time window in seconds (default: 60)
 */
export const RateLimit = (limit: number, ttl: number = 60) =>
  applyDecorators(
    Throttle({ default: { limit, ttl: ttl * 1000 } }),
    SetMetadata(RATE_LIMIT_KEY, { limit, ttl })
  );

/**
 * Skip rate limiting for this route
 */
export { SkipThrottle };

/**
 * Stricter rate limit for sensitive operations
 */
export const StrictRateLimit = () => RateLimit(5, 60);

/**
 * Relaxed rate limit for public endpoints
 */
export const RelaxedRateLimit = () => RateLimit(100, 60);

/**
 * Rate limit by user ID instead of IP
 */
export const RATE_LIMIT_BY_USER = "rate_limit_by_user";
export const RateLimitByUser = () => SetMetadata(RATE_LIMIT_BY_USER, true);
`;
  await writeFile(path.join(rateLimitPath, 'decorators/throttle.decorator.ts'), throttleDecoratorContent);

  // Custom throttler guard
  const throttlerGuardContent = `import { Injectable, ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerException } from "@nestjs/throttler";
import { Reflector } from "@nestjs/core";
import { RATE_LIMIT_BY_USER } from "../decorators/throttle.decorator";

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: any,
    storageService: any,
    private readonly reflector: Reflector
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Generate tracking key based on IP or user ID
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const byUser = this.reflector.get<boolean>(
      RATE_LIMIT_BY_USER,
      this.context?.getHandler()
    );

    if (byUser && req.user?.id) {
      return \`user_\${req.user.id}\`;
    }

    // Use X-Forwarded-For if behind proxy, otherwise use IP
    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded
      ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0])
      : req.ip || req.connection?.remoteAddress;

    return \`ip_\${ip}\`;
  }

  private context?: ExecutionContext;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.context = context;
    return super.canActivate(context);
  }

  /**
   * Custom error response
   */
  protected throwThrottlingException(context: ExecutionContext): void {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // Add retry-after header
    const retryAfter = 60; // Default retry after 60 seconds
    res.header("Retry-After", retryAfter.toString());
    res.header("X-RateLimit-Reset", new Date(Date.now() + retryAfter * 1000).toISOString());

    throw new ThrottlerException("Too many requests. Please try again later.");
  }
}
`;
  await writeFile(path.join(rateLimitPath, 'guards/throttler.guard.ts'), throttlerGuardContent);

  // Redis throttler storage
  const redisStorageContent = `import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ThrottlerStorage } from "@nestjs/throttler";
import Redis from "ioredis";

export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private redis: Redis;
  private prefix = "throttle:";

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      keyPrefix: this.prefix,
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    const fullKey = \`\${throttlerName}:\${key}\`;

    // Check if blocked
    const blockedUntil = await this.redis.get(\`blocked:\${fullKey}\`);
    if (blockedUntil) {
      const timeToBlockExpire = parseInt(blockedUntil) - Date.now();
      if (timeToBlockExpire > 0) {
        return {
          totalHits: limit + 1,
          timeToExpire: 0,
          isBlocked: true,
          timeToBlockExpire,
        };
      }
    }

    // Increment counter
    const multi = this.redis.multi();
    multi.incr(fullKey);
    multi.pttl(fullKey);

    const results = await multi.exec();
    const totalHits = results?.[0]?.[1] as number || 1;
    let timeToExpire = results?.[1]?.[1] as number || -1;

    // Set TTL if this is a new key
    if (timeToExpire === -1) {
      await this.redis.pexpire(fullKey, ttl);
      timeToExpire = ttl;
    }

    // Block if limit exceeded
    let isBlocked = false;
    let timeToBlockExpire = 0;

    if (totalHits > limit && blockDuration > 0) {
      const blockUntil = Date.now() + blockDuration;
      await this.redis.set(\`blocked:\${fullKey}\`, blockUntil.toString(), "PX", blockDuration);
      isBlocked = true;
      timeToBlockExpire = blockDuration;
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire,
    };
  }

  /**
   * Get current rate limit status for a key
   */
  async getStatus(key: string, throttlerName: string): Promise<{ hits: number; ttl: number } | null> {
    const fullKey = \`\${throttlerName}:\${key}\`;
    const [hits, ttl] = await Promise.all([
      this.redis.get(fullKey),
      this.redis.pttl(fullKey),
    ]);

    if (!hits) return null;

    return {
      hits: parseInt(hits),
      ttl: Math.max(0, ttl),
    };
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string, throttlerName: string): Promise<void> {
    const fullKey = \`\${throttlerName}:\${key}\`;
    await this.redis.del(fullKey, \`blocked:\${fullKey}\`);
  }
}
`;
  await writeFile(path.join(rateLimitPath, 'redis-throttler.storage.ts'), redisStorageContent);

  // Rate limit module
  const moduleContent = `import { Module, Global } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { CustomThrottlerGuard } from "./guards/throttler.guard";
import { RedisThrottlerStorage } from "./redis-throttler.storage";

@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: "default",
          ttl: parseInt(process.env.THROTTLE_TTL || "60") * 1000,
          limit: parseInt(process.env.THROTTLE_LIMIT || "100"),
        },
        {
          name: "strict",
          ttl: 60000,
          limit: 5,
        },
        {
          name: "auth",
          ttl: 300000, // 5 minutes
          limit: 5,    // 5 attempts
        },
      ],
      storage: new RedisThrottlerStorage(),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
`;
  await writeFile(path.join(rateLimitPath, 'rate-limit.module.ts'), moduleContent);

  // Index exports
  const indexContent = `export * from "./decorators/throttle.decorator";
export * from "./guards/throttler.guard";
export * from "./redis-throttler.storage";
export * from "./rate-limit.module";
`;
  await writeFile(path.join(rateLimitPath, 'index.ts'), indexContent);

  // Decorators index
  const decoratorsIndexContent = `export * from "./throttle.decorator";
`;
  await writeFile(path.join(rateLimitPath, 'decorators/index.ts'), decoratorsIndexContent);

  // Guards index
  const guardsIndexContent = `export * from "./throttler.guard";
`;
  await writeFile(path.join(rateLimitPath, 'guards/index.ts'), guardsIndexContent);

  console.log(chalk.green('  ✓ Rate limit decorators (@RateLimit, @StrictRateLimit, @RateLimitByUser)'));
  console.log(chalk.green('  ✓ Custom throttler guard with IP/User tracking'));
  console.log(chalk.green('  ✓ Redis-based throttler storage'));
  console.log(chalk.green('  ✓ Rate limit module'));
}

async function applyFilteringRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const filterPath = path.join(sharedPath, 'filtering');

  await ensureDir(filterPath);

  // Filter operators and types
  const filterTypesContent = `export type FilterOperator =
  | "eq"      // Equal
  | "ne"      // Not equal
  | "gt"      // Greater than
  | "gte"     // Greater than or equal
  | "lt"      // Less than
  | "lte"     // Less than or equal
  | "in"      // In array
  | "nin"     // Not in array
  | "like"    // Contains (case insensitive)
  | "ilike"   // Contains (PostgreSQL)
  | "between" // Between two values
  | "isNull"  // Is null
  | "isNotNull"; // Is not null

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value?: any;
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
  search?: string;
  searchFields?: string[];
  filters?: Record<string, any>;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
`;
  await writeFile(path.join(filterPath, 'filter.types.ts'), filterTypesContent);

  // TypeORM Query Builder
  const typeormBuilderContent = `import { SelectQueryBuilder, Brackets } from "typeorm";
import { FilterCondition, QueryOptions, PaginatedResult } from "./filter.types";

/**
 * Parse filter parameters from query string
 * Supports format: field__operator=value (e.g., age__gte=18, name__like=john)
 */
export function parseFilters(query: Record<string, any>): FilterCondition[] {
  const conditions: FilterCondition[] = [];
  const operatorMap: Record<string, string> = {
    eq: "eq", ne: "ne", gt: "gt", gte: "gte", lt: "lt", lte: "lte",
    in: "in", nin: "nin", like: "like", ilike: "ilike",
    between: "between", isNull: "isNull", isNotNull: "isNotNull",
  };

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (["page", "limit", "sortBy", "sortOrder", "search", "searchFields"].includes(key)) continue;

    const parts = key.split("__");
    const field = parts[0];
    const operatorKey = parts[1] || "eq";
    const operator = operatorMap[operatorKey] || "eq";

    conditions.push({ field, operator: operator as any, value });
  }

  return conditions;
}

/**
 * Apply filters to TypeORM QueryBuilder
 */
export function applyFilters<T>(
  qb: SelectQueryBuilder<T>,
  conditions: FilterCondition[],
  alias: string
): SelectQueryBuilder<T> {
  for (const { field, operator, value } of conditions) {
    const paramKey = \`\${field}_\${Date.now()}_\${Math.random().toString(36).slice(2)}\`;
    const col = \`\${alias}.\${field}\`;

    switch (operator) {
      case "eq":
        qb.andWhere(\`\${col} = :\${paramKey}\`, { [paramKey]: value });
        break;
      case "ne":
        qb.andWhere(\`\${col} != :\${paramKey}\`, { [paramKey]: value });
        break;
      case "gt":
        qb.andWhere(\`\${col} > :\${paramKey}\`, { [paramKey]: value });
        break;
      case "gte":
        qb.andWhere(\`\${col} >= :\${paramKey}\`, { [paramKey]: value });
        break;
      case "lt":
        qb.andWhere(\`\${col} < :\${paramKey}\`, { [paramKey]: value });
        break;
      case "lte":
        qb.andWhere(\`\${col} <= :\${paramKey}\`, { [paramKey]: value });
        break;
      case "in":
        qb.andWhere(\`\${col} IN (:...\${paramKey})\`, {
          [paramKey]: Array.isArray(value) ? value : value.split(",")
        });
        break;
      case "nin":
        qb.andWhere(\`\${col} NOT IN (:...\${paramKey})\`, {
          [paramKey]: Array.isArray(value) ? value : value.split(",")
        });
        break;
      case "like":
        qb.andWhere(\`LOWER(\${col}) LIKE LOWER(:\${paramKey})\`, { [paramKey]: \`%\${value}%\` });
        break;
      case "ilike":
        qb.andWhere(\`\${col} ILIKE :\${paramKey}\`, { [paramKey]: \`%\${value}%\` });
        break;
      case "between":
        const [min, max] = Array.isArray(value) ? value : value.split(",");
        qb.andWhere(\`\${col} BETWEEN :\${paramKey}_min AND :\${paramKey}_max\`, {
          [\`\${paramKey}_min\`]: min, [\`\${paramKey}_max\`]: max
        });
        break;
      case "isNull":
        qb.andWhere(\`\${col} IS NULL\`);
        break;
      case "isNotNull":
        qb.andWhere(\`\${col} IS NOT NULL\`);
        break;
    }
  }
  return qb;
}

/**
 * Apply search across multiple fields
 */
export function applySearch<T>(
  qb: SelectQueryBuilder<T>,
  search: string,
  fields: string[],
  alias: string
): SelectQueryBuilder<T> {
  if (!search || fields.length === 0) return qb;

  qb.andWhere(new Brackets((sub) => {
    for (const field of fields) {
      sub.orWhere(\`LOWER(\${alias}.\${field}) LIKE LOWER(:search)\`, { search: \`%\${search}%\` });
    }
  }));

  return qb;
}

/**
 * Execute filtered, paginated query
 */
export async function executeQuery<T>(
  qb: SelectQueryBuilder<T>,
  options: QueryOptions,
  alias: string,
  defaultSearchFields: string[] = []
): Promise<PaginatedResult<T>> {
  const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "DESC" } = options;

  // Apply filters
  if (options.filters) {
    applyFilters(qb, parseFilters(options.filters), alias);
  }

  // Apply search
  if (options.search) {
    applySearch(qb, options.search, options.searchFields || defaultSearchFields, alias);
  }

  // Get total before pagination
  const total = await qb.getCount();

  // Apply pagination
  qb.skip((page - 1) * limit).take(limit).orderBy(\`\${alias}.\${sortBy}\`, sortOrder);

  const items = await qb.getMany();
  const totalPages = Math.ceil(total / limit);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
`;
  await writeFile(path.join(filterPath, 'typeorm-query-builder.ts'), typeormBuilderContent);

  // Prisma Query Builder
  const prismaBuilderContent = `import { FilterCondition, QueryOptions, PaginatedResult } from "./filter.types";

/**
 * Parse filters to Prisma where conditions
 */
export function parseFiltersToPrisma(query: Record<string, any>): Record<string, any> {
  const where: Record<string, any> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (["page", "limit", "sortBy", "sortOrder", "search", "searchFields"].includes(key)) continue;

    const parts = key.split("__");
    const field = parts[0];
    const operator = parts[1] || "eq";

    where[field] = convertOperator(operator, value);
  }

  return where;
}

function convertOperator(op: string, value: any): any {
  switch (op) {
    case "eq": return value;
    case "ne": return { not: value };
    case "gt": return { gt: value };
    case "gte": return { gte: value };
    case "lt": return { lt: value };
    case "lte": return { lte: value };
    case "in": return { in: Array.isArray(value) ? value : value.split(",") };
    case "nin": return { notIn: Array.isArray(value) ? value : value.split(",") };
    case "like":
    case "contains": return { contains: value, mode: "insensitive" };
    case "startsWith": return { startsWith: value, mode: "insensitive" };
    case "endsWith": return { endsWith: value, mode: "insensitive" };
    case "isNull": return value === "true" ? null : { not: null };
    case "between":
      const [min, max] = Array.isArray(value) ? value : value.split(",");
      return { gte: min, lte: max };
    default: return value;
  }
}

/**
 * Build search conditions for Prisma
 */
export function buildSearchCondition(search: string, fields: string[]): Record<string, any> {
  if (!search || fields.length === 0) return {};
  return { OR: fields.map((field) => ({ [field]: { contains: search, mode: "insensitive" } })) };
}

/**
 * Execute filtered, paginated Prisma query
 */
export async function executePrismaQuery<T>(
  model: any,
  options: QueryOptions,
  defaultSearchFields: string[] = []
): Promise<PaginatedResult<T>> {
  const { page = 1, limit = 10, sortBy = "created_at", sortOrder = "DESC" } = options;

  // Build where
  const filterWhere = options.filters ? parseFiltersToPrisma(options.filters) : {};
  const searchWhere = options.search
    ? buildSearchCondition(options.search, options.searchFields || defaultSearchFields)
    : {};

  const where = {
    ...filterWhere,
    ...searchWhere,
    deleted_at: null,
  };

  const [items, total] = await Promise.all([
    model.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder.toLowerCase() },
    }),
    model.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
`;
  await writeFile(path.join(filterPath, 'prisma-query-builder.ts'), prismaBuilderContent);

  // Index exports
  const indexContent = `export * from "./filter.types";
export * from "./typeorm-query-builder";
export * from "./prisma-query-builder";
`;
  await writeFile(path.join(filterPath, 'index.ts'), indexContent);

  console.log(chalk.green('  ✓ Filter types and interfaces'));
  console.log(chalk.green('  ✓ TypeORM query builder utilities'));
  console.log(chalk.green('  ✓ Prisma query builder utilities'));
}

export function listRecipes() {
  console.log(chalk.blue('\\n📚 Available Recipes:\\n'));

  Object.entries(AVAILABLE_RECIPES).forEach(([key, value]) => {
    console.log(chalk.cyan(`  ${key.padEnd(15)}`), '-', value.description);
    if (value.dependencies.length > 0) {
      console.log(chalk.gray(`                  Dependencies: ${value.dependencies.join(', ')}`));
    }
  });

  console.log(chalk.yellow('\nUsage: ddd recipe <recipe-name> [--install-deps]'));
}
