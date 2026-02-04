import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../../utils/file.utils';

export async function applyMiddlewareRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const middlewarePath = path.join(sharedPath, 'middleware');
  const guardsPath = path.join(sharedPath, 'guards');
  const interceptorsPath = path.join(sharedPath, 'interceptors');

  await ensureDir(middlewarePath);
  await ensureDir(guardsPath);
  await ensureDir(interceptorsPath);

  // Request Logger Middleware
  const loggerMiddlewareContent = `import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { v4 as uuid } from "uuid";

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || uuid();
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get("user-agent") || "";

    // Attach request ID to request object
    (req as any).requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    // Log request
    this.logger.log(\`--> \${method} \${originalUrl} [ID: \${requestId}]\`);

    // Log response when finished
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const contentLength = res.get("content-length") || 0;

      const logLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "log";

      this.logger[\`\${logLevel}\`](
        \`<-- \${method} \${originalUrl} \${statusCode} \${duration}ms \${contentLength}b [ID: \${requestId}]\`
      );
    });

    next();
  }
}
`;
  await writeFile(path.join(middlewarePath, 'request-logger.middleware.ts'), loggerMiddlewareContent);

  // Correlation ID Middleware
  const correlationMiddlewareContent = `import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { v4 as uuid } from "uuid";
import { AsyncLocalStorage } from "async_hooks";

export interface CorrelationContext {
  correlationId: string;
  requestId: string;
  userId?: string;
  tenantId?: string;
}

export const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = (req.headers["x-correlation-id"] as string) || uuid();
    const requestId = (req.headers["x-request-id"] as string) || uuid();

    const context: CorrelationContext = {
      correlationId,
      requestId,
      userId: (req as any).user?.id,
      tenantId: (req as any).tenantId,
    };

    res.setHeader("X-Correlation-Id", correlationId);
    res.setHeader("X-Request-Id", requestId);

    correlationStorage.run(context, () => next());
  }
}

export function getCorrelationContext(): CorrelationContext | undefined {
  return correlationStorage.getStore();
}

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}
`;
  await writeFile(path.join(middlewarePath, 'correlation-id.middleware.ts'), correlationMiddlewareContent);

  // Permission Guard
  const permissionGuardContent = `import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

export const PERMISSIONS_KEY = "permissions";
export const Permissions = (...permissions: string[]) =>
  Reflect.metadata(PERMISSIONS_KEY, permissions);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    const userPermissions: string[] = user.permissions || [];
    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        \`Missing required permissions: \${requiredPermissions.join(", ")}\`
      );
    }

    return true;
  }
}
`;
  await writeFile(path.join(guardsPath, 'permission.guard.ts'), permissionGuardContent);

  // Resource Owner Guard
  const resourceOwnerGuardContent = `import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

export const RESOURCE_OWNER_KEY = "resource_owner";
export const ResourceOwner = (paramName: string = "id", userField: string = "userId") =>
  Reflect.metadata(RESOURCE_OWNER_KEY, { paramName, userField });

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.get<{ paramName: string; userField: string }>(
      RESOURCE_OWNER_KEY,
      context.getHandler()
    );

    if (!config) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    // Admin bypass
    if (user.roles?.includes("admin")) return true;

    const resourceId = request.params[config.paramName];
    const userId = user.id;

    // You should inject and use your repository here
    // This is a placeholder - implement actual resource lookup
    const resource = request.resource; // Assume loaded by previous middleware/interceptor

    if (resource && resource[config.userField] !== userId) {
      throw new ForbiddenException("You do not own this resource");
    }

    return true;
  }
}
`;
  await writeFile(path.join(guardsPath, 'resource-owner.guard.ts'), resourceOwnerGuardContent);

  // Transform Response Interceptor
  const transformInterceptorContent = `import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Reflector } from "@nestjs/core";

export interface StandardResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
    [key: string]: any;
  };
}

export const SKIP_TRANSFORM_KEY = "skip_transform";
export const SkipTransform = () => Reflect.metadata(SKIP_TRANSFORM_KEY, true);

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<StandardResponse<T>> {
    const skipTransform = this.reflector.get<boolean>(
      SKIP_TRANSFORM_KEY,
      context.getHandler()
    );

    if (skipTransform) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.requestId || request.headers["x-request-id"],
        },
      }))
    );
  }
}
`;
  await writeFile(path.join(interceptorsPath, 'transform-response.interceptor.ts'), transformInterceptorContent);

  // Timing Interceptor
  const timingInterceptorContent = `import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("Timing");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          response.setHeader("X-Response-Time", \`\${duration}ms\`);

          if (duration > 1000) {
            this.logger.warn(\`Slow request: \${method} \${url} took \${duration}ms\`);
          }
        },
        error: () => {
          const duration = Date.now() - startTime;
          response.setHeader("X-Response-Time", \`\${duration}ms\`);
        },
      })
    );
  }
}
`;
  await writeFile(path.join(interceptorsPath, 'timing.interceptor.ts'), timingInterceptorContent);

  // Timeout Interceptor
  const timeoutInterceptorContent = `import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from "@nestjs/common";
import { Observable, throwError, TimeoutError } from "rxjs";
import { catchError, timeout } from "rxjs/operators";
import { Reflector } from "@nestjs/core";

export const TIMEOUT_KEY = "request_timeout";
export const SetTimeout = (ms: number) => Reflect.metadata(TIMEOUT_KEY, ms);

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const timeoutMs =
      this.reflector.get<number>(TIMEOUT_KEY, context.getHandler()) ||
      parseInt(process.env.REQUEST_TIMEOUT || "30000", 10);

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () => new RequestTimeoutException(\`Request timeout after \${timeoutMs}ms\`)
          );
        }
        return throwError(() => err);
      })
    );
  }
}
`;
  await writeFile(path.join(interceptorsPath, 'timeout.interceptor.ts'), timeoutInterceptorContent);

  // Index exports
  await writeFile(path.join(middlewarePath, 'index.ts'), `export * from "./request-logger.middleware";
export * from "./correlation-id.middleware";
`);

  await writeFile(path.join(guardsPath, 'index.ts'), `export * from "./permission.guard";
export * from "./resource-owner.guard";
`);

  await writeFile(path.join(interceptorsPath, 'index.ts'), `export * from "./transform-response.interceptor";
export * from "./timing.interceptor";
export * from "./timeout.interceptor";
`);

  console.log(chalk.green('  ✓ Request Logger Middleware'));
  console.log(chalk.green('  ✓ Correlation ID Middleware with AsyncLocalStorage'));
  console.log(chalk.green('  ✓ Permission Guard with @Permissions decorator'));
  console.log(chalk.green('  ✓ Resource Owner Guard'));
  console.log(chalk.green('  ✓ Transform Response Interceptor'));
  console.log(chalk.green('  ✓ Timing Interceptor'));
  console.log(chalk.green('  ✓ Timeout Interceptor'));
}
