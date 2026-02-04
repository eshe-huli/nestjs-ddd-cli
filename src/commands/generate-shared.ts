import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../utils/file.utils';

export interface GenerateSharedOptions {
  path?: string;
}

export async function generateShared(options: GenerateSharedOptions) {
  console.log(chalk.blue('\n📦 Generating shared module...'));

  const basePath = options.path || process.cwd();
  const sharedPath = path.join(basePath, 'src/shared');

  // Create directory structure
  await ensureDir(path.join(sharedPath, 'base'));
  await ensureDir(path.join(sharedPath, 'decorators'));
  await ensureDir(path.join(sharedPath, 'filters'));
  await ensureDir(path.join(sharedPath, 'interceptors'));
  await ensureDir(path.join(sharedPath, 'pipes'));
  await ensureDir(path.join(sharedPath, 'utils'));

  // Base ORM Entity
  const baseOrmEntityContent = `import {
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
  await writeFile(path.join(sharedPath, 'base/base-orm.entity.ts'), baseOrmEntityContent);

  // Base Domain Entity
  const baseDomainEntityContent = `export interface BaseEntityProps {
  id?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export abstract class BaseDomainEntity<T extends BaseEntityProps> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = props;
  }

  get id(): string | undefined {
    return this.props.id;
  }

  get isActive(): boolean | undefined {
    return this.props.isActive;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  public equals(entity: BaseDomainEntity<T>): boolean {
    if (!entity) return false;
    return this.id === entity.id;
  }
}
`;
  await writeFile(path.join(sharedPath, 'base/base-domain.entity.ts'), baseDomainEntityContent);

  // HTTP Exception Filter
  const httpExceptionFilterContent = `import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let errors: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === "object") {
        message = (exceptionResponse as any).message || message;
        errors = (exceptionResponse as any).errors;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    this.logger.error(
      \`\${request.method} \${request.url} - \${status}: \${message}\`,
      exception instanceof Error ? exception.stack : undefined
    );

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message,
        errors,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
`;
  await writeFile(path.join(sharedPath, 'filters/all-exceptions.filter.ts'), httpExceptionFilterContent);

  // Transform Interceptor
  const transformInterceptorContent = `import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    path: string;
  };
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      }))
    );
  }
}
`;
  await writeFile(path.join(sharedPath, 'interceptors/transform.interceptor.ts'), transformInterceptorContent);

  // Logging Interceptor
  const loggingInterceptorContent = `import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const now = Date.now();

    this.logger.log(\`Incoming: \${method} \${url}\`);
    if (Object.keys(body).length > 0) {
      this.logger.debug(\`Body: \${JSON.stringify(body)}\`);
    }

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - now;
        this.logger.log(\`Outgoing: \${method} \${url} - \${responseTime}ms\`);
      })
    );
  }
}
`;
  await writeFile(path.join(sharedPath, 'interceptors/logging.interceptor.ts'), loggingInterceptorContent);

  // Validation Pipe
  const validationPipeContent = `import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from "@nestjs/common";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";

@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      const formattedErrors = errors.reduce((acc, error) => {
        acc[error.property] = Object.values(error.constraints || {});
        return acc;
      }, {} as Record<string, string[]>);

      throw new BadRequestException({
        message: "Validation failed",
        errors: formattedErrors,
      });
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
`;
  await writeFile(path.join(sharedPath, 'pipes/validation.pipe.ts'), validationPipeContent);

  // Utils - Date helpers
  const dateUtilsContent = `export function formatDate(date: Date): string {
  return date.toISOString();
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isExpired(date: Date): boolean {
  return new Date() > date;
}

export function getDaysDifference(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
`;
  await writeFile(path.join(sharedPath, 'utils/date.utils.ts'), dateUtilsContent);

  // Utils - String helpers
  const stringUtilsContent = `export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\\w\\s-]/g, "")
    .replace(/[\\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function generateRandomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
`;
  await writeFile(path.join(sharedPath, 'utils/string.utils.ts'), stringUtilsContent);

  // Index files
  await writeFile(path.join(sharedPath, 'base/index.ts'), `export * from "./base-orm.entity";
export * from "./base-domain.entity";
`);

  await writeFile(path.join(sharedPath, 'filters/index.ts'), `export * from "./all-exceptions.filter";
`);

  await writeFile(path.join(sharedPath, 'interceptors/index.ts'), `export * from "./transform.interceptor";
export * from "./logging.interceptor";
`);

  await writeFile(path.join(sharedPath, 'pipes/index.ts'), `export * from "./validation.pipe";
`);

  await writeFile(path.join(sharedPath, 'utils/index.ts'), `export * from "./date.utils";
export * from "./string.utils";
`);

  await writeFile(path.join(sharedPath, 'index.ts'), `export * from "./base";
export * from "./filters";
export * from "./interceptors";
export * from "./pipes";
export * from "./utils";
`);

  console.log(chalk.green('  ✓ Base entities (ORM and Domain)'));
  console.log(chalk.green('  ✓ Exception filters'));
  console.log(chalk.green('  ✓ Interceptors (Transform, Logging)'));
  console.log(chalk.green('  ✓ Validation pipe'));
  console.log(chalk.green('  ✓ Utility functions'));

  console.log(chalk.green('\n✅ Shared module generated successfully!'));
  console.log(chalk.cyan('\nUsage in app.module.ts:'));
  console.log(chalk.gray(`
  import { AllExceptionsFilter } from "@shared/filters";
  import { TransformInterceptor } from "@shared/interceptors";
  import { CustomValidationPipe } from "@shared/pipes";

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalPipes(new CustomValidationPipe());
`));
}
