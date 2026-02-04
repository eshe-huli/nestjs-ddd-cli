/**
 * Unified Error & Exception Framework
 * Provides centralized exception handling for CLI and generated code
 */

/**
 * Base CLI Error with error codes
 */
export class CliError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;
  public readonly suggestion?: string;
  public readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    options?: {
      details?: Record<string, any>;
      suggestion?: string;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.details = options?.details;
    this.suggestion = options?.suggestion;
    this.cause = options?.cause;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      suggestion: this.suggestion,
    };
  }
}

// Specific error classes
export class ValidationError extends CliError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', { details });
    this.name = 'ValidationError';
  }
}

export class FileNotFoundError extends CliError {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`, 'FILE_NOT_FOUND', {
      details: { filePath },
      suggestion: `Ensure the file exists at the specified path`,
    });
    this.name = 'FileNotFoundError';
  }
}

export class FileExistsError extends CliError {
  constructor(filePath: string) {
    super(`File already exists: ${filePath}`, 'FILE_EXISTS', {
      details: { filePath },
      suggestion: `Use --force to overwrite or choose a different name`,
    });
    this.name = 'FileExistsError';
  }
}

export class ModuleNotFoundError extends CliError {
  constructor(moduleName: string) {
    super(`Module not found: ${moduleName}`, 'MODULE_NOT_FOUND', {
      details: { moduleName },
      suggestion: `Create the module first with: ddd g module ${moduleName}`,
    });
    this.name = 'ModuleNotFoundError';
  }
}

export class EntityNotFoundError extends CliError {
  constructor(entityName: string, moduleName?: string) {
    super(`Entity not found: ${entityName}`, 'ENTITY_NOT_FOUND', {
      details: { entityName, moduleName },
      suggestion: moduleName
        ? `Create the entity first with: ddd g entity ${entityName} -m ${moduleName}`
        : `Create the entity first with: ddd g entity ${entityName}`,
    });
    this.name = 'EntityNotFoundError';
  }
}

export class InvalidFieldError extends CliError {
  constructor(fieldStr: string, reason: string) {
    super(`Invalid field definition: ${fieldStr}`, 'INVALID_FIELD', {
      details: { fieldStr, reason },
      suggestion: `Use format: name:type:modifier (e.g., email:string:unique)`,
    });
    this.name = 'InvalidFieldError';
  }
}

export class DuplicateEntityError extends CliError {
  constructor(entityName: string, existingPath: string) {
    super(`Entity already exists: ${entityName}`, 'DUPLICATE_ENTITY', {
      details: { entityName, existingPath },
      suggestion: `Use a different name or remove the existing entity first`,
    });
    this.name = 'DuplicateEntityError';
  }
}

export class CircularDependencyError extends CliError {
  constructor(chain: string[]) {
    super(`Circular dependency detected: ${chain.join(' -> ')}`, 'CIRCULAR_DEPENDENCY', {
      details: { chain },
      suggestion: `Break the cycle by introducing an interface or restructuring the modules`,
    });
    this.name = 'CircularDependencyError';
  }
}

export class TemplateError extends CliError {
  constructor(templateName: string, reason: string) {
    super(`Template error in ${templateName}: ${reason}`, 'TEMPLATE_ERROR', {
      details: { templateName, reason },
    });
    this.name = 'TemplateError';
  }
}

export class ConfigurationError extends CliError {
  constructor(message: string, configKey?: string) {
    super(message, 'CONFIGURATION_ERROR', {
      details: { configKey },
      suggestion: `Check your .dddrc.json configuration file`,
    });
    this.name = 'ConfigurationError';
  }
}

export class RelationError extends CliError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'RELATION_ERROR', {
      details,
      suggestion: `Ensure both entities exist and relation types are compatible`,
    });
    this.name = 'RelationError';
  }
}

export class SchemaError extends CliError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SCHEMA_ERROR', { details });
    this.name = 'SchemaError';
  }
}

export class GenerationError extends CliError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'GENERATION_ERROR', { details });
    this.name = 'GenerationError';
  }
}

/**
 * Error codes for structured error handling
 */
export const ErrorCodes = {
  // Validation errors (1xxx)
  VALIDATION_ERROR: 'E1000',
  INVALID_FIELD: 'E1001',
  INVALID_NAME: 'E1002',
  INVALID_TYPE: 'E1003',
  MISSING_REQUIRED: 'E1004',
  SCHEMA_INVALID: 'E1005',

  // File errors (2xxx)
  FILE_NOT_FOUND: 'E2000',
  FILE_EXISTS: 'E2001',
  FILE_WRITE_ERROR: 'E2002',
  FILE_READ_ERROR: 'E2003',
  DIRECTORY_NOT_FOUND: 'E2004',

  // Entity errors (3xxx)
  ENTITY_NOT_FOUND: 'E3000',
  DUPLICATE_ENTITY: 'E3001',
  ENTITY_INVALID: 'E3002',

  // Module errors (4xxx)
  MODULE_NOT_FOUND: 'E4000',
  DUPLICATE_MODULE: 'E4001',
  MODULE_INVALID: 'E4002',

  // Relation errors (5xxx)
  RELATION_ERROR: 'E5000',
  CIRCULAR_DEPENDENCY: 'E5001',
  INVALID_RELATION_TYPE: 'E5002',
  MISSING_INVERSE_SIDE: 'E5003',

  // Template errors (6xxx)
  TEMPLATE_ERROR: 'E6000',
  TEMPLATE_NOT_FOUND: 'E6001',
  TEMPLATE_PARSE_ERROR: 'E6002',

  // Configuration errors (7xxx)
  CONFIGURATION_ERROR: 'E7000',
  CONFIG_NOT_FOUND: 'E7001',
  CONFIG_INVALID: 'E7002',

  // Generation errors (8xxx)
  GENERATION_ERROR: 'E8000',
  GENERATION_FAILED: 'E8001',
  ROLLBACK_FAILED: 'E8002',
} as const;

/**
 * Error handler for consistent error output
 */
export interface ErrorHandler {
  handle(error: Error): void;
  format(error: Error): string;
}

/**
 * Default error handler with chalk output
 */
export function createErrorHandler(options: { verbose?: boolean } = {}): ErrorHandler {
  return {
    handle(error: Error) {
      console.error(this.format(error));
      if (options.verbose && error.stack) {
        console.error(error.stack);
      }
    },

    format(error: Error): string {
      if (error instanceof CliError) {
        let msg = `Error [${error.code}]: ${error.message}`;
        if (error.suggestion) {
          msg += `\n  Suggestion: ${error.suggestion}`;
        }
        if (options.verbose && error.details) {
          msg += `\n  Details: ${JSON.stringify(error.details, null, 2)}`;
        }
        return msg;
      }
      return `Error: ${error.message}`;
    },
  };
}

/**
 * Domain Exception Templates
 * These are templates for generated domain exceptions
 * SECURITY: Designed to prevent information disclosure (OWASP A01:2021)
 */
export const DomainExceptionTemplates = {
  entityNotFound: (entityName: string) => `
import { NotFoundException, Logger } from '@nestjs/common';

export class ${entityName}NotFoundException extends NotFoundException {
  private readonly logger = new Logger(${entityName}NotFoundException.name);

  constructor(id: string) {
    // Don't expose internal IDs in production
    const isProduction = process.env.NODE_ENV === 'production';
    const message = isProduction
      ? '${entityName} not found'
      : \`${entityName} with id \${id} not found\`;

    super(message);

    // Log the actual ID for debugging
    this.logger.debug(\`${entityName} not found: \${id}\`);
  }
}
`,

  entityAlreadyExists: (entityName: string) => `
import { ConflictException, Logger } from '@nestjs/common';

export class ${entityName}AlreadyExistsException extends ConflictException {
  private readonly logger = new Logger(${entityName}AlreadyExistsException.name);

  constructor(identifier: string) {
    // Don't expose which field/value conflicts in production
    const isProduction = process.env.NODE_ENV === 'production';
    const message = isProduction
      ? '${entityName} already exists'
      : \`${entityName} with identifier \${identifier} already exists\`;

    super(message);
    this.logger.debug(\`${entityName} conflict: \${identifier}\`);
  }
}
`,

  validationFailed: (entityName: string) => `
import { BadRequestException, Logger } from '@nestjs/common';

export class ${entityName}ValidationException extends BadRequestException {
  private readonly logger = new Logger(${entityName}ValidationException.name);

  constructor(errors: string[]) {
    // In production, provide generic message; in dev, show field errors
    const isProduction = process.env.NODE_ENV === 'production';
    const message = isProduction
      ? { message: 'Validation failed', errorCount: errors.length }
      : { message: '${entityName} validation failed', errors };

    super(message);
    this.logger.debug(\`Validation errors: \${errors.join(', ')}\`);
  }
}
`,

  operationFailed: (entityName: string) => `
import { InternalServerErrorException, Logger } from '@nestjs/common';

export class ${entityName}OperationFailedException extends InternalServerErrorException {
  private readonly logger = new Logger(${entityName}OperationFailedException.name);

  constructor(operation: string, reason?: string) {
    // NEVER expose internal error details to client in production
    const isProduction = process.env.NODE_ENV === 'production';
    const clientMessage = isProduction
      ? 'An error occurred processing your request'
      : \`${entityName} \${operation} failed\`;

    super(clientMessage);

    // Log the actual reason for debugging
    this.logger.error(\`${entityName} \${operation} failed: \${reason || 'unknown'}\`);
  }
}
`,

  domainException: (entityName: string) => `
import { HttpException, HttpStatus, Logger } from '@nestjs/common';

/**
 * Base domain exception with secure error handling
 * Does not expose internal details in production
 */
export abstract class ${entityName}DomainException extends HttpException {
  protected readonly logger = new Logger(${entityName}DomainException.name);
  protected readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(
    publicMessage: string,
    internalMessage: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST
  ) {
    // Use generic message in production
    super(
      process.env.NODE_ENV === 'production' ? publicMessage : internalMessage,
      status
    );

    // Always log the internal message for debugging
    this.logger.debug(internalMessage);
  }
}

export class ${entityName}NotFoundException extends ${entityName}DomainException {
  constructor(id: string) {
    super(
      '${entityName} not found',
      \`${entityName} with id \${id} not found\`,
      HttpStatus.NOT_FOUND
    );
  }
}

export class ${entityName}AlreadyExistsException extends ${entityName}DomainException {
  constructor(field: string, value: string) {
    super(
      '${entityName} already exists',
      \`${entityName} with \${field} '\${value}' already exists\`,
      HttpStatus.CONFLICT
    );
  }
}

export class ${entityName}ValidationException extends ${entityName}DomainException {
  constructor(errors: string[]) {
    super(
      'Validation failed',
      \`Validation failed: \${errors.join(', ')}\`,
      HttpStatus.BAD_REQUEST
    );
  }
}

export class ${entityName}InvalidStateException extends ${entityName}DomainException {
  constructor(currentState: string, expectedState: string) {
    super(
      'Operation not allowed',
      \`Cannot perform operation: ${entityName} is in '\${currentState}' state, expected '\${expectedState}'\`,
      HttpStatus.UNPROCESSABLE_ENTITY
    );
  }
}

export class ${entityName}UnauthorizedException extends ${entityName}DomainException {
  constructor(action: string) {
    super(
      'Unauthorized',
      \`Unauthorized to \${action} ${entityName}\`,
      HttpStatus.FORBIDDEN
    );
  }
}
`,
};

/**
 * Generate domain exceptions for an entity
 */
export function generateDomainExceptions(entityName: string): string {
  return DomainExceptionTemplates.domainException(entityName);
}

/**
 * Error result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Try-catch wrapper returning Result type
 */
export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function trySync<T>(fn: () => T): Result<T, Error> {
  try {
    const data = fn();
    return ok(data);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
