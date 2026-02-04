/**
 * Domain Service Orchestration Generator
 * Generates domain services for cross-aggregate operations
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface DomainServiceOptions {
  path?: string;
  module?: string;
  type?: 'simple' | 'workflow' | 'policy';
}

export async function generateDomainService(
  name: string,
  basePath: string,
  options: DomainServiceOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n🔧 Generating Domain Service\n'));

  const moduleName = options.module || 'shared';
  const servicePath = path.join(basePath, 'src', moduleName, 'domain', 'services');

  if (!fs.existsSync(servicePath)) {
    fs.mkdirSync(servicePath, { recursive: true });
  }

  const serviceType = options.type || 'simple';
  let serviceContent: string;

  switch (serviceType) {
    case 'workflow':
      serviceContent = generateWorkflowService(name);
      break;
    case 'policy':
      serviceContent = generatePolicyService(name);
      break;
    default:
      serviceContent = generateSimpleDomainService(name);
  }

  const serviceFile = path.join(servicePath, `${toKebabCase(name)}.service.ts`);
  fs.writeFileSync(serviceFile, serviceContent);
  console.log(chalk.green(`  ✓ Created ${serviceFile}`));

  console.log(chalk.bold.green('\n✅ Domain service generated successfully!\n'));
}

function generateSimpleDomainService(name: string): string {
  const className = toPascalCase(name);

  return `import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * ${className} Domain Service
 * Handles cross-aggregate business logic
 */
@Injectable()
export class ${className}Service {
  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute domain operation
   */
  async execute(params: ${className}Params): Promise<${className}Result> {
    // Validate business rules
    this.validateRules(params);

    // Perform domain logic
    const result = await this.performOperation(params);

    // Emit domain events
    this.eventEmitter.emit('${toKebabCase(name)}.completed', {
      params,
      result,
      timestamp: new Date(),
    });

    return result;
  }

  private validateRules(params: ${className}Params): void {
    // Add business rule validations
    if (!params) {
      throw new DomainValidationError('Invalid parameters');
    }
  }

  private async performOperation(params: ${className}Params): Promise<${className}Result> {
    // Implement domain logic
    return {
      success: true,
      data: {},
    };
  }
}

/**
 * Service parameters
 */
export interface ${className}Params {
  [key: string]: any;
}

/**
 * Service result
 */
export interface ${className}Result {
  success: boolean;
  data: any;
  error?: string;
}

/**
 * Domain validation error
 */
export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainValidationError';
  }
}
`;
}

function generateWorkflowService(name: string): string {
  const className = toPascalCase(name);

  return `import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * ${className} Workflow Service
 * Orchestrates multi-step business processes
 */
@Injectable()
export class ${className}WorkflowService {
  private readonly logger = new Logger(${className}WorkflowService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute workflow
   */
  async execute(context: WorkflowContext): Promise<WorkflowResult> {
    const workflow = new ${className}Workflow(context);

    this.logger.log(\`Starting workflow: \${workflow.id}\`);
    this.eventEmitter.emit('workflow.started', { workflowId: workflow.id, type: '${toKebabCase(name)}' });

    try {
      // Execute workflow steps
      for (const step of workflow.steps) {
        this.logger.debug(\`Executing step: \${step.name}\`);

        const stepResult = await this.executeStep(step, context);

        if (!stepResult.success) {
          if (step.required) {
            throw new WorkflowStepError(step.name, stepResult.error!);
          }
          this.logger.warn(\`Optional step failed: \${step.name}\`);
        }

        context.results[step.name] = stepResult;
        this.eventEmitter.emit('workflow.step.completed', {
          workflowId: workflow.id,
          step: step.name,
          result: stepResult,
        });
      }

      const result: WorkflowResult = {
        id: workflow.id,
        status: 'completed',
        results: context.results,
        completedAt: new Date(),
      };

      this.eventEmitter.emit('workflow.completed', result);
      return result;

    } catch (error) {
      const failedResult: WorkflowResult = {
        id: workflow.id,
        status: 'failed',
        results: context.results,
        error: (error as Error).message,
        completedAt: new Date(),
      };

      this.eventEmitter.emit('workflow.failed', failedResult);

      // Execute compensation steps
      await this.compensate(workflow, context);

      throw error;
    }
  }

  private async executeStep(step: WorkflowStep, context: WorkflowContext): Promise<StepResult> {
    const startTime = Date.now();

    try {
      const result = await step.handler(context);

      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  private async compensate(workflow: ${className}Workflow, context: WorkflowContext): Promise<void> {
    this.logger.log(\`Compensating workflow: \${workflow.id}\`);

    // Execute compensation steps in reverse order
    const completedSteps = Object.keys(context.results);

    for (const stepName of completedSteps.reverse()) {
      const step = workflow.steps.find(s => s.name === stepName);

      if (step?.compensate) {
        try {
          await step.compensate(context);
          this.logger.debug(\`Compensated step: \${stepName}\`);
        } catch (error) {
          this.logger.error(\`Compensation failed for step: \${stepName}\`, error);
        }
      }
    }
  }
}

/**
 * Workflow definition
 */
class ${className}Workflow {
  public readonly id: string;
  public readonly steps: WorkflowStep[];

  constructor(context: WorkflowContext) {
    this.id = this.generateId();
    this.steps = this.defineSteps();
  }

  private generateId(): string {
    return \`wf_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
  }

  private defineSteps(): WorkflowStep[] {
    return [
      {
        name: 'validate',
        required: true,
        handler: async (ctx) => {
          // Validation logic
          return { validated: true };
        },
      },
      {
        name: 'process',
        required: true,
        handler: async (ctx) => {
          // Processing logic
          return { processed: true };
        },
        compensate: async (ctx) => {
          // Rollback processing
        },
      },
      {
        name: 'notify',
        required: false,
        handler: async (ctx) => {
          // Notification logic
          return { notified: true };
        },
      },
    ];
  }
}

/**
 * Workflow types
 */
export interface WorkflowContext {
  input: any;
  results: Record<string, StepResult>;
  metadata?: Record<string, any>;
}

export interface WorkflowStep {
  name: string;
  required: boolean;
  handler: (context: WorkflowContext) => Promise<any>;
  compensate?: (context: WorkflowContext) => Promise<void>;
}

export interface StepResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

export interface WorkflowResult {
  id: string;
  status: 'completed' | 'failed' | 'cancelled';
  results: Record<string, StepResult>;
  error?: string;
  completedAt: Date;
}

export class WorkflowStepError extends Error {
  constructor(stepName: string, message: string) {
    super(\`Step '\${stepName}' failed: \${message}\`);
    this.name = 'WorkflowStepError';
  }
}
`;
}

function generatePolicyService(name: string): string {
  const className = toPascalCase(name);

  return `import { Injectable } from '@nestjs/common';

/**
 * ${className} Policy Service
 * Encapsulates business rules and policies
 */
@Injectable()
export class ${className}PolicyService {
  private readonly rules: PolicyRule[] = [];

  constructor() {
    this.registerRules();
  }

  /**
   * Evaluate all policies for a given context
   */
  evaluate(context: PolicyContext): PolicyResult {
    const violations: PolicyViolation[] = [];
    const warnings: PolicyWarning[] = [];

    for (const rule of this.rules) {
      if (!rule.condition(context)) {
        continue;
      }

      const result = rule.evaluate(context);

      if (!result.passed) {
        if (rule.severity === 'error') {
          violations.push({
            rule: rule.name,
            message: result.message || rule.message,
            code: rule.code,
          });
        } else {
          warnings.push({
            rule: rule.name,
            message: result.message || rule.message,
          });
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings,
      context,
    };
  }

  /**
   * Register a new policy rule
   */
  registerRule(rule: PolicyRule): void {
    this.rules.push(rule);
  }

  /**
   * Register default rules
   */
  private registerRules(): void {
    // Add default policy rules
    this.registerRule({
      name: 'example-rule',
      code: 'POLICY_001',
      message: 'Example policy violation',
      severity: 'error',
      condition: (ctx) => true,
      evaluate: (ctx) => ({
        passed: true,
      }),
    });
  }
}

/**
 * Policy types
 */
export interface PolicyRule {
  name: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
  condition: (context: PolicyContext) => boolean;
  evaluate: (context: PolicyContext) => PolicyEvaluation;
}

export interface PolicyContext {
  subject: any;
  action: string;
  resource: any;
  environment?: Record<string, any>;
}

export interface PolicyEvaluation {
  passed: boolean;
  message?: string;
  data?: any;
}

export interface PolicyViolation {
  rule: string;
  code: string;
  message: string;
}

export interface PolicyWarning {
  rule: string;
  message: string;
}

export interface PolicyResult {
  passed: boolean;
  violations: PolicyViolation[];
  warnings: PolicyWarning[];
  context: PolicyContext;
}

/**
 * Policy builder for fluent rule creation
 */
export class PolicyBuilder {
  private rule: Partial<PolicyRule> = {
    severity: 'error',
    condition: () => true,
  };

  name(name: string): this {
    this.rule.name = name;
    return this;
  }

  code(code: string): this {
    this.rule.code = code;
    return this;
  }

  message(message: string): this {
    this.rule.message = message;
    return this;
  }

  severity(severity: 'error' | 'warning'): this {
    this.rule.severity = severity;
    return this;
  }

  when(condition: (context: PolicyContext) => boolean): this {
    this.rule.condition = condition;
    return this;
  }

  evaluate(evaluator: (context: PolicyContext) => PolicyEvaluation): this {
    this.rule.evaluate = evaluator;
    return this;
  }

  build(): PolicyRule {
    if (!this.rule.name || !this.rule.code || !this.rule.evaluate) {
      throw new Error('Policy rule is incomplete');
    }
    return this.rule as PolicyRule;
  }
}

/**
 * Create a policy rule builder
 */
export function policy(): PolicyBuilder {
  return new PolicyBuilder();
}
`;
}

/**
 * Setup domain service infrastructure
 */
export async function setupDomainServiceInfrastructure(
  basePath: string,
  options: DomainServiceOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n🔧 Setting up Domain Service Infrastructure\n'));

  const sharedPath = path.join(basePath, 'src/shared/domain/services');

  if (!fs.existsSync(sharedPath)) {
    fs.mkdirSync(sharedPath, { recursive: true });
  }

  // Generate base domain service
  const baseServiceContent = generateBaseDomainService();
  fs.writeFileSync(path.join(sharedPath, 'domain-service.base.ts'), baseServiceContent);
  console.log(chalk.green(`  ✓ Created base domain service`));

  // Generate saga pattern
  const sagaContent = generateSagaPattern();
  fs.writeFileSync(path.join(sharedPath, 'saga.ts'), sagaContent);
  console.log(chalk.green(`  ✓ Created saga pattern`));

  console.log(chalk.bold.green('\n✅ Domain service infrastructure ready!\n'));
}

function generateBaseDomainService(): string {
  return `/**
 * Base Domain Service
 * Foundation for domain services
 */

import { EventEmitter2 } from '@nestjs/event-emitter';

export abstract class BaseDomainService {
  constructor(protected readonly eventEmitter: EventEmitter2) {}

  protected emit(event: string, payload: any): void {
    this.eventEmitter.emit(event, {
      ...payload,
      timestamp: new Date(),
      service: this.constructor.name,
    });
  }

  protected async emitAsync(event: string, payload: any): Promise<void> {
    await this.eventEmitter.emitAsync(event, {
      ...payload,
      timestamp: new Date(),
      service: this.constructor.name,
    });
  }
}

/**
 * Domain service result type
 */
export type DomainResult<T, E = DomainError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function success<T>(data: T): DomainResult<T> {
  return { success: true, data };
}

export function failure<E>(error: E): DomainResult<never, E> {
  return { success: false, error };
}

/**
 * Domain error
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

/**
 * Domain service decorator
 */
export function DomainService(): ClassDecorator {
  return function (target: Function) {
    // Mark as domain service
    Reflect.defineMetadata('isDomainService', true, target);
  };
}
`;
}

function generateSagaPattern(): string {
  return `/**
 * Saga Pattern Implementation
 * For distributed transactions across aggregates
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Saga step definition
 */
export interface SagaStep<TData = any> {
  name: string;
  execute: (data: TData) => Promise<any>;
  compensate: (data: TData, result: any) => Promise<void>;
}

/**
 * Saga execution context
 */
export interface SagaContext<TData = any> {
  id: string;
  data: TData;
  results: Map<string, any>;
  completedSteps: string[];
  status: 'running' | 'completed' | 'compensating' | 'failed';
}

/**
 * Saga orchestrator
 */
@Injectable()
export class SagaOrchestrator {
  private readonly logger = new Logger(SagaOrchestrator.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Execute a saga with compensation support
   */
  async execute<TData>(
    sagaName: string,
    steps: SagaStep<TData>[],
    data: TData,
  ): Promise<SagaContext<TData>> {
    const context: SagaContext<TData> = {
      id: this.generateSagaId(),
      data,
      results: new Map(),
      completedSteps: [],
      status: 'running',
    };

    this.logger.log(\`Starting saga: \${sagaName} [\${context.id}]\`);
    this.eventEmitter.emit('saga.started', { id: context.id, name: sagaName });

    try {
      for (const step of steps) {
        this.logger.debug(\`Executing step: \${step.name}\`);

        const result = await step.execute(data);
        context.results.set(step.name, result);
        context.completedSteps.push(step.name);

        this.eventEmitter.emit('saga.step.completed', {
          sagaId: context.id,
          step: step.name,
          result,
        });
      }

      context.status = 'completed';
      this.eventEmitter.emit('saga.completed', { id: context.id, name: sagaName });

      return context;

    } catch (error) {
      this.logger.error(\`Saga failed at step: \${context.completedSteps[context.completedSteps.length - 1]}\`);
      context.status = 'compensating';

      await this.compensate(sagaName, steps, context);

      context.status = 'failed';
      this.eventEmitter.emit('saga.failed', {
        id: context.id,
        name: sagaName,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  private async compensate<TData>(
    sagaName: string,
    steps: SagaStep<TData>[],
    context: SagaContext<TData>,
  ): Promise<void> {
    this.logger.log(\`Compensating saga: \${sagaName} [\${context.id}]\`);

    // Compensate in reverse order
    for (const stepName of context.completedSteps.reverse()) {
      const step = steps.find(s => s.name === stepName);

      if (step) {
        try {
          const stepResult = context.results.get(stepName);
          await step.compensate(context.data, stepResult);

          this.logger.debug(\`Compensated step: \${stepName}\`);
          this.eventEmitter.emit('saga.step.compensated', {
            sagaId: context.id,
            step: stepName,
          });
        } catch (compensateError) {
          this.logger.error(\`Compensation failed for step: \${stepName}\`, compensateError);
          // Continue with other compensations
        }
      }
    }
  }

  private generateSagaId(): string {
    return \`saga_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
  }
}

/**
 * Saga builder for fluent API
 */
export class SagaBuilder<TData = any> {
  private steps: SagaStep<TData>[] = [];
  private name: string = '';

  named(name: string): this {
    this.name = name;
    return this;
  }

  step(
    name: string,
    execute: (data: TData) => Promise<any>,
    compensate: (data: TData, result: any) => Promise<void>,
  ): this {
    this.steps.push({ name, execute, compensate });
    return this;
  }

  build(): { name: string; steps: SagaStep<TData>[] } {
    return {
      name: this.name,
      steps: this.steps,
    };
  }
}

/**
 * Create a saga builder
 */
export function saga<TData = any>(): SagaBuilder<TData> {
  return new SagaBuilder<TData>();
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
