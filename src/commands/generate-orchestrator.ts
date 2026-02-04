/**
 * Application Layer Use Case Orchestrator Generator
 * Generates standardized use case handlers with transaction management
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface OrchestratorOptions {
  path?: string;
  module?: string;
  type?: 'command' | 'query' | 'saga';
}

export async function generateOrchestrator(
  name: string,
  basePath: string,
  options: OrchestratorOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n🎭 Generating Use Case Orchestrator\n'));

  const moduleName = options.module || 'shared';
  const orchestratorType = options.type || 'command';
  const orchestratorPath = path.join(basePath, 'src', moduleName, 'application', 'orchestrators');

  if (!fs.existsSync(orchestratorPath)) {
    fs.mkdirSync(orchestratorPath, { recursive: true });
  }

  let content: string;
  switch (orchestratorType) {
    case 'query':
      content = generateQueryOrchestrator(name);
      break;
    case 'saga':
      content = generateSagaOrchestrator(name);
      break;
    default:
      content = generateCommandOrchestrator(name);
  }

  const fileName = `${toKebabCase(name)}.orchestrator.ts`;
  const filePath = path.join(orchestratorPath, fileName);
  fs.writeFileSync(filePath, content);
  console.log(chalk.green(`  ✓ Created ${filePath}`));

  console.log(chalk.bold.green('\n✅ Orchestrator generated successfully!\n'));
}

function generateCommandOrchestrator(name: string): string {
  const className = toPascalCase(name);

  return `import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';

/**
 * ${className} Command Orchestrator
 * Handles command execution with transaction management and event publishing
 */
@Injectable()
export class ${className}Orchestrator {
  private readonly logger = new Logger(${className}Orchestrator.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute the ${name} command
   */
  async execute(command: ${className}Command): Promise<${className}Result> {
    const correlationId = this.generateCorrelationId();

    this.logger.log(\`Executing ${name} command [\${correlationId}]\`);

    // Validate command
    const validationResult = await this.validate(command);
    if (!validationResult.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationResult.message,
          details: validationResult.errors,
        },
      };
    }

    // Execute in transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Pre-execution hooks
      await this.beforeExecute(command, correlationId);

      // Execute command logic
      const result = await this.executeCommand(command, queryRunner);

      // Commit transaction
      await queryRunner.commitTransaction();

      // Post-execution hooks
      await this.afterExecute(command, result, correlationId);

      // Publish domain events
      await this.publishEvents(result.events || [], correlationId);

      return {
        success: true,
        data: result.data,
        correlationId,
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();

      this.logger.error(\`Command failed [\${correlationId}]: \${(error as Error).message}\`);

      // Publish failure event
      this.eventEmitter.emit('command.failed', {
        command: '${name}',
        correlationId,
        error: (error as Error).message,
        timestamp: new Date(),
      });

      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: (error as Error).message,
        },
        correlationId,
      };

    } finally {
      await queryRunner.release();
    }
  }

  private async validate(command: ${className}Command): Promise<ValidationResult> {
    // Add validation logic
    return { valid: true };
  }

  private async beforeExecute(command: ${className}Command, correlationId: string): Promise<void> {
    this.eventEmitter.emit('command.executing', {
      command: '${name}',
      correlationId,
      timestamp: new Date(),
    });
  }

  private async executeCommand(
    command: ${className}Command,
    queryRunner: any,
  ): Promise<ExecutionResult> {
    // Implement command execution logic
    return {
      data: {},
      events: [],
    };
  }

  private async afterExecute(
    command: ${className}Command,
    result: ExecutionResult,
    correlationId: string,
  ): Promise<void> {
    this.eventEmitter.emit('command.executed', {
      command: '${name}',
      correlationId,
      result: result.data,
      timestamp: new Date(),
    });
  }

  private async publishEvents(events: DomainEvent[], correlationId: string): Promise<void> {
    for (const event of events) {
      this.eventEmitter.emit(event.type, {
        ...event.payload,
        correlationId,
        timestamp: new Date(),
      });
    }
  }

  private generateCorrelationId(): string {
    return \`cmd_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
  }
}

/**
 * Command input
 */
export interface ${className}Command {
  [key: string]: any;
}

/**
 * Command result
 */
export interface ${className}Result {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  correlationId?: string;
}

/**
 * Validation result
 */
interface ValidationResult {
  valid: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

/**
 * Execution result
 */
interface ExecutionResult {
  data: any;
  events?: DomainEvent[];
}

/**
 * Domain event
 */
interface DomainEvent {
  type: string;
  payload: any;
}
`;
}

function generateQueryOrchestrator(name: string): string {
  const className = toPascalCase(name);

  return `import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * ${className} Query Orchestrator
 * Handles query execution with caching and optimization
 */
@Injectable()
export class ${className}QueryOrchestrator {
  private readonly logger = new Logger(${className}QueryOrchestrator.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute the ${name} query
   */
  async execute(query: ${className}Query): Promise<${className}QueryResult> {
    const cacheKey = this.generateCacheKey(query);

    // Check cache
    if (query.useCache !== false) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.logger.debug(\`Cache hit for query: \${cacheKey}\`);
        return {
          success: true,
          data: cached,
          fromCache: true,
        };
      }
    }

    try {
      // Execute query
      const result = await this.executeQuery(query);

      // Cache result
      if (query.useCache !== false && result) {
        this.setCache(cacheKey, result, query.cacheTtl);
      }

      return {
        success: true,
        data: result,
        fromCache: false,
      };

    } catch (error) {
      this.logger.error(\`Query failed: \${(error as Error).message}\`);

      return {
        success: false,
        error: {
          code: 'QUERY_ERROR',
          message: (error as Error).message,
        },
      };
    }
  }

  /**
   * Execute paginated query
   */
  async executePaginated(
    query: ${className}Query,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<any>> {
    const { page = 1, pageSize = 10 } = pagination;

    const result = await this.executeQuery({
      ...query,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const total = await this.count(query);
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: result || [],
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  private async executeQuery(query: ${className}Query): Promise<any> {
    // Implement query execution logic
    return null;
  }

  private async count(query: ${className}Query): Promise<number> {
    // Implement count logic
    return 0;
  }

  private generateCacheKey(query: ${className}Query): string {
    return \`${toKebabCase(name)}:\${JSON.stringify(query)}\`;
  }

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: any, ttl: number = 60000): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Invalidate cache
   */
  invalidateCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

/**
 * Query input
 */
export interface ${className}Query {
  [key: string]: any;
  useCache?: boolean;
  cacheTtl?: number;
  skip?: number;
  take?: number;
}

/**
 * Query result
 */
export interface ${className}QueryResult {
  success: boolean;
  data?: any;
  fromCache?: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Cache entry
 */
interface CacheEntry {
  data: any;
  expiresAt: number;
}

/**
 * Pagination params
 */
interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * Paginated result
 */
interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
`;
}

function generateSagaOrchestrator(name: string): string {
  const className = toPascalCase(name);

  return `import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

/**
 * ${className} Saga Orchestrator
 * Coordinates long-running business processes
 */
@Injectable()
export class ${className}SagaOrchestrator {
  private readonly logger = new Logger(${className}SagaOrchestrator.name);
  private readonly sagas = new Map<string, SagaState>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Start a new saga
   */
  async start(input: ${className}SagaInput): Promise<string> {
    const sagaId = this.generateSagaId();

    const state: SagaState = {
      id: sagaId,
      status: 'started',
      input,
      currentStep: 0,
      steps: this.defineSteps(),
      completedSteps: [],
      results: new Map(),
      startedAt: new Date(),
    };

    this.sagas.set(sagaId, state);

    this.logger.log(\`Starting saga [\${sagaId}]\`);
    this.eventEmitter.emit('saga.${toKebabCase(name)}.started', { sagaId, input });

    // Execute first step
    await this.executeNextStep(sagaId);

    return sagaId;
  }

  /**
   * Handle step completion event
   */
  @OnEvent('saga.${toKebabCase(name)}.step.completed')
  async onStepCompleted(event: StepCompletedEvent): Promise<void> {
    const state = this.sagas.get(event.sagaId);
    if (!state) return;

    state.results.set(event.stepName, event.result);
    state.completedSteps.push(event.stepName);
    state.currentStep++;

    if (state.currentStep >= state.steps.length) {
      await this.completeSaga(event.sagaId);
    } else {
      await this.executeNextStep(event.sagaId);
    }
  }

  /**
   * Handle step failure event
   */
  @OnEvent('saga.${toKebabCase(name)}.step.failed')
  async onStepFailed(event: StepFailedEvent): Promise<void> {
    const state = this.sagas.get(event.sagaId);
    if (!state) return;

    this.logger.error(\`Step failed in saga [\${event.sagaId}]: \${event.error}\`);

    state.status = 'compensating';
    await this.compensate(event.sagaId);
  }

  private async executeNextStep(sagaId: string): Promise<void> {
    const state = this.sagas.get(sagaId);
    if (!state) return;

    const step = state.steps[state.currentStep];

    this.logger.debug(\`Executing step: \${step.name} [\${sagaId}]\`);

    try {
      const result = await step.execute(state.input, state.results);

      this.eventEmitter.emit('saga.${toKebabCase(name)}.step.completed', {
        sagaId,
        stepName: step.name,
        result,
      });
    } catch (error) {
      this.eventEmitter.emit('saga.${toKebabCase(name)}.step.failed', {
        sagaId,
        stepName: step.name,
        error: (error as Error).message,
      });
    }
  }

  private async compensate(sagaId: string): Promise<void> {
    const state = this.sagas.get(sagaId);
    if (!state) return;

    this.logger.log(\`Compensating saga [\${sagaId}]\`);

    for (const stepName of state.completedSteps.reverse()) {
      const step = state.steps.find(s => s.name === stepName);
      if (step?.compensate) {
        try {
          await step.compensate(state.input, state.results);
          this.logger.debug(\`Compensated step: \${stepName}\`);
        } catch (error) {
          this.logger.error(\`Compensation failed for \${stepName}: \${(error as Error).message}\`);
        }
      }
    }

    state.status = 'failed';
    state.completedAt = new Date();

    this.eventEmitter.emit('saga.${toKebabCase(name)}.failed', {
      sagaId,
      completedSteps: state.completedSteps,
    });
  }

  private async completeSaga(sagaId: string): Promise<void> {
    const state = this.sagas.get(sagaId);
    if (!state) return;

    state.status = 'completed';
    state.completedAt = new Date();

    this.logger.log(\`Saga completed [\${sagaId}]\`);

    this.eventEmitter.emit('saga.${toKebabCase(name)}.completed', {
      sagaId,
      results: Object.fromEntries(state.results),
      duration: state.completedAt.getTime() - state.startedAt.getTime(),
    });
  }

  private defineSteps(): SagaStep[] {
    return [
      {
        name: 'validate',
        execute: async (input, results) => {
          // Validation logic
          return { validated: true };
        },
      },
      {
        name: 'process',
        execute: async (input, results) => {
          // Processing logic
          return { processed: true };
        },
        compensate: async (input, results) => {
          // Rollback processing
        },
      },
      {
        name: 'notify',
        execute: async (input, results) => {
          // Notification logic
          return { notified: true };
        },
      },
    ];
  }

  private generateSagaId(): string {
    return \`saga_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
  }

  /**
   * Get saga state
   */
  getState(sagaId: string): SagaState | undefined {
    return this.sagas.get(sagaId);
  }
}

/**
 * Saga types
 */
export interface ${className}SagaInput {
  [key: string]: any;
}

interface SagaState {
  id: string;
  status: 'started' | 'running' | 'compensating' | 'completed' | 'failed';
  input: any;
  currentStep: number;
  steps: SagaStep[];
  completedSteps: string[];
  results: Map<string, any>;
  startedAt: Date;
  completedAt?: Date;
}

interface SagaStep {
  name: string;
  execute: (input: any, results: Map<string, any>) => Promise<any>;
  compensate?: (input: any, results: Map<string, any>) => Promise<void>;
}

interface StepCompletedEvent {
  sagaId: string;
  stepName: string;
  result: any;
}

interface StepFailedEvent {
  sagaId: string;
  stepName: string;
  error: string;
}
`;
}

/**
 * Setup orchestrator infrastructure
 */
export async function setupOrchestratorInfrastructure(
  basePath: string,
  options: OrchestratorOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n🎭 Setting up Orchestrator Infrastructure\n'));

  const sharedPath = path.join(basePath, 'src/shared/application');

  if (!fs.existsSync(sharedPath)) {
    fs.mkdirSync(sharedPath, { recursive: true });
  }

  // Generate base orchestrator
  const baseContent = generateBaseOrchestrator();
  fs.writeFileSync(path.join(sharedPath, 'orchestrator.base.ts'), baseContent);
  console.log(chalk.green(`  ✓ Created base orchestrator`));

  // Generate pipeline pattern
  const pipelineContent = generatePipeline();
  fs.writeFileSync(path.join(sharedPath, 'pipeline.ts'), pipelineContent);
  console.log(chalk.green(`  ✓ Created pipeline pattern`));

  console.log(chalk.bold.green('\n✅ Orchestrator infrastructure ready!\n'));
}

function generateBaseOrchestrator(): string {
  return `/**
 * Base Orchestrator
 * Foundation for use case orchestrators
 */

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export abstract class BaseOrchestrator<TInput, TOutput> {
  protected abstract readonly logger: Logger;

  constructor(protected readonly eventEmitter: EventEmitter2) {}

  /**
   * Execute orchestrated operation
   */
  abstract execute(input: TInput): Promise<OrchestratorResult<TOutput>>;

  protected success(data: TOutput, correlationId?: string): OrchestratorResult<TOutput> {
    return {
      success: true,
      data,
      correlationId,
    };
  }

  protected failure(error: OrchestratorError, correlationId?: string): OrchestratorResult<TOutput> {
    return {
      success: false,
      error,
      correlationId,
    };
  }

  protected generateCorrelationId(): string {
    return \`orch_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
  }
}

/**
 * Orchestrator result
 */
export interface OrchestratorResult<T> {
  success: boolean;
  data?: T;
  error?: OrchestratorError;
  correlationId?: string;
}

/**
 * Orchestrator error
 */
export interface OrchestratorError {
  code: string;
  message: string;
  details?: any;
}

/**
 * Orchestrator decorator
 */
export function Orchestrator(): ClassDecorator {
  return function (target: Function) {
    Reflect.defineMetadata('isOrchestrator', true, target);
  };
}
`;
}

function generatePipeline(): string {
  return `/**
 * Pipeline Pattern
 * For building request/response pipelines
 */

/**
 * Pipeline step interface
 */
export interface PipelineStep<TContext> {
  execute(context: TContext, next: () => Promise<void>): Promise<void>;
}

/**
 * Pipeline builder
 */
export class Pipeline<TContext> {
  private steps: PipelineStep<TContext>[] = [];

  use(step: PipelineStep<TContext>): this {
    this.steps.push(step);
    return this;
  }

  async execute(context: TContext): Promise<TContext> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.steps.length) {
        const step = this.steps[index++];
        await step.execute(context, next);
      }
    };

    await next();
    return context;
  }
}

/**
 * Create a pipeline
 */
export function pipeline<TContext>(): Pipeline<TContext> {
  return new Pipeline<TContext>();
}

/**
 * Common pipeline steps
 */
export class LoggingStep<TContext> implements PipelineStep<TContext> {
  constructor(private readonly logger: any) {}

  async execute(context: TContext, next: () => Promise<void>): Promise<void> {
    const start = Date.now();
    this.logger.log('Pipeline started');

    await next();

    this.logger.log(\`Pipeline completed in \${Date.now() - start}ms\`);
  }
}

export class ValidationStep<TContext extends { input: any; errors?: string[] }> implements PipelineStep<TContext> {
  constructor(private readonly validator: (input: any) => string[]) {}

  async execute(context: TContext, next: () => Promise<void>): Promise<void> {
    const errors = this.validator(context.input);

    if (errors.length > 0) {
      context.errors = errors;
      return;
    }

    await next();
  }
}

export class TransactionStep<TContext> implements PipelineStep<TContext> {
  constructor(private readonly dataSource: any) {}

  async execute(context: TContext, next: () => Promise<void>): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await next();
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
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

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^(.)/, c => c.toUpperCase());
}
