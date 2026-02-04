/**
 * Aggregate Root & Command Handler Validator Generator
 * Generates comprehensive validators for aggregates
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface AggregateValidatorOptions {
  path?: string;
  module?: string;
}

export async function setupAggregateValidator(
  basePath: string,
  options: AggregateValidatorOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n✅ Setting up Aggregate Validator Framework\n'));

  const sharedPath = path.join(basePath, 'src/shared/domain/validation');

  if (!fs.existsSync(sharedPath)) {
    fs.mkdirSync(sharedPath, { recursive: true });
  }

  // Generate aggregate root base
  const aggregateContent = generateAggregateRoot();
  fs.writeFileSync(path.join(sharedPath, 'aggregate-root.ts'), aggregateContent);
  console.log(chalk.green(`  ✓ Created aggregate root base`));

  // Generate invariant validator
  const invariantContent = generateInvariantValidator();
  fs.writeFileSync(path.join(sharedPath, 'invariant.validator.ts'), invariantContent);
  console.log(chalk.green(`  ✓ Created invariant validator`));

  // Generate state machine
  const stateMachineContent = generateStateMachine();
  fs.writeFileSync(path.join(sharedPath, 'state-machine.ts'), stateMachineContent);
  console.log(chalk.green(`  ✓ Created state machine`));

  // Generate business rules engine
  const rulesContent = generateBusinessRulesEngine();
  fs.writeFileSync(path.join(sharedPath, 'business-rules.ts'), rulesContent);
  console.log(chalk.green(`  ✓ Created business rules engine`));

  // Generate command validator
  const commandContent = generateCommandValidator();
  fs.writeFileSync(path.join(sharedPath, 'command.validator.ts'), commandContent);
  console.log(chalk.green(`  ✓ Created command validator`));

  console.log(chalk.bold.green('\n✅ Aggregate validator framework ready!\n'));
}

function generateAggregateRoot(): string {
  return `/**
 * Aggregate Root Base
 * Foundation for all aggregate roots with invariant validation
 */

import { InvariantValidator, InvariantRule } from './invariant.validator';

export interface DomainEvent {
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  timestamp: Date;
  version: number;
  payload: any;
}

/**
 * Base Aggregate Root
 */
export abstract class AggregateRoot<TId = string> {
  private _id: TId;
  private _version: number = 0;
  private _domainEvents: DomainEvent[] = [];
  private _invariantValidator: InvariantValidator<this>;

  protected constructor(id: TId) {
    this._id = id;
    this._invariantValidator = new InvariantValidator<this>();
    this.registerInvariants(this._invariantValidator);
  }

  get id(): TId {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  /**
   * Register aggregate invariants
   * Override in subclass to define invariants
   */
  protected abstract registerInvariants(validator: InvariantValidator<this>): void;

  /**
   * Validate all invariants
   */
  protected validateInvariants(): void {
    const result = this._invariantValidator.validate(this);
    if (!result.valid) {
      throw new InvariantViolationError(result.violations);
    }
  }

  /**
   * Apply a domain event
   */
  protected apply(event: Omit<DomainEvent, 'version' | 'timestamp' | 'aggregateId' | 'aggregateType'>): void {
    const fullEvent: DomainEvent = {
      ...event,
      aggregateId: String(this._id),
      aggregateType: this.constructor.name,
      version: this._version + 1,
      timestamp: new Date(),
    };

    this.when(fullEvent);
    this._domainEvents.push(fullEvent);
    this._version++;

    // Validate invariants after state change
    this.validateInvariants();
  }

  /**
   * Handle event application
   * Override to implement event handlers
   */
  protected abstract when(event: DomainEvent): void;

  /**
   * Load aggregate from event history
   */
  public loadFromHistory(events: DomainEvent[]): void {
    for (const event of events) {
      this.when(event);
      this._version = event.version;
    }
  }

  /**
   * Get uncommitted domain events
   */
  public getUncommittedEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  /**
   * Clear uncommitted events after persistence
   */
  public markEventsAsCommitted(): void {
    this._domainEvents = [];
  }

  /**
   * Check if aggregate has uncommitted changes
   */
  public hasUncommittedChanges(): boolean {
    return this._domainEvents.length > 0;
  }
}

/**
 * Invariant violation error
 */
export class InvariantViolationError extends Error {
  constructor(public readonly violations: string[]) {
    super(\`Invariant violations: \${violations.join(', ')}\`);
    this.name = 'InvariantViolationError';
  }
}

/**
 * Entity base class
 */
export abstract class Entity<TId = string> {
  protected readonly _id: TId;

  protected constructor(id: TId) {
    this._id = id;
  }

  get id(): TId {
    return this._id;
  }

  equals(entity: Entity<TId>): boolean {
    if (entity === null || entity === undefined) {
      return false;
    }
    if (this === entity) {
      return true;
    }
    return this._id === entity._id;
  }
}

/**
 * Aggregate factory interface
 */
export interface AggregateFactory<T extends AggregateRoot, TId = string> {
  create(id: TId, ...args: any[]): T;
  reconstitute(id: TId, events: DomainEvent[]): T;
}
`;
}

function generateInvariantValidator(): string {
  return `/**
 * Invariant Validator
 * Validates aggregate invariants and business rules
 */

export interface InvariantRule<T> {
  name: string;
  description?: string;
  check: (aggregate: T) => boolean;
  message: string | ((aggregate: T) => string);
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
}

/**
 * Invariant Validator
 */
export class InvariantValidator<T> {
  private rules: InvariantRule<T>[] = [];
  private warningRules: InvariantRule<T>[] = [];

  /**
   * Add invariant rule
   */
  addRule(rule: InvariantRule<T>): this {
    this.rules.push(rule);
    return this;
  }

  /**
   * Add warning rule (doesn't fail validation)
   */
  addWarning(rule: InvariantRule<T>): this {
    this.warningRules.push(rule);
    return this;
  }

  /**
   * Validate aggregate against all rules
   */
  validate(aggregate: T): ValidationResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    // Check invariant rules
    for (const rule of this.rules) {
      if (!rule.check(aggregate)) {
        const message = typeof rule.message === 'function'
          ? rule.message(aggregate)
          : rule.message;
        violations.push(\`[\${rule.name}] \${message}\`);
      }
    }

    // Check warning rules
    for (const rule of this.warningRules) {
      if (!rule.check(aggregate)) {
        const message = typeof rule.message === 'function'
          ? rule.message(aggregate)
          : rule.message;
        warnings.push(\`[\${rule.name}] \${message}\`);
      }
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Validate and throw on violation
   */
  validateOrThrow(aggregate: T): void {
    const result = this.validate(aggregate);
    if (!result.valid) {
      throw new InvariantError(result.violations);
    }
  }
}

/**
 * Invariant error
 */
export class InvariantError extends Error {
  constructor(public readonly violations: string[]) {
    super(violations.join('; '));
    this.name = 'InvariantError';
  }
}

/**
 * Invariant builder for fluent API
 */
export class InvariantBuilder<T> {
  private rule: Partial<InvariantRule<T>> = {};

  named(name: string): this {
    this.rule.name = name;
    return this;
  }

  describedAs(description: string): this {
    this.rule.description = description;
    return this;
  }

  check(predicate: (aggregate: T) => boolean): this {
    this.rule.check = predicate;
    return this;
  }

  withMessage(message: string | ((aggregate: T) => string)): this {
    this.rule.message = message;
    return this;
  }

  build(): InvariantRule<T> {
    if (!this.rule.name || !this.rule.check || !this.rule.message) {
      throw new Error('Invariant rule is incomplete');
    }
    return this.rule as InvariantRule<T>;
  }
}

/**
 * Create invariant builder
 */
export function invariant<T>(): InvariantBuilder<T> {
  return new InvariantBuilder<T>();
}

/**
 * Common invariant rules factory
 */
export const CommonInvariants = {
  notNull<T, K extends keyof T>(field: K): InvariantRule<T> {
    return {
      name: \`\${String(field)}-not-null\`,
      check: (aggregate) => aggregate[field] !== null && aggregate[field] !== undefined,
      message: \`\${String(field)} cannot be null\`,
    };
  },

  notEmpty<T, K extends keyof T>(field: K): InvariantRule<T> {
    return {
      name: \`\${String(field)}-not-empty\`,
      check: (aggregate) => {
        const value = aggregate[field];
        if (typeof value === 'string') return value.length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return value !== null && value !== undefined;
      },
      message: \`\${String(field)} cannot be empty\`,
    };
  },

  positive<T, K extends keyof T>(field: K): InvariantRule<T> {
    return {
      name: \`\${String(field)}-positive\`,
      check: (aggregate) => (aggregate[field] as unknown as number) > 0,
      message: \`\${String(field)} must be positive\`,
    };
  },

  nonNegative<T, K extends keyof T>(field: K): InvariantRule<T> {
    return {
      name: \`\${String(field)}-non-negative\`,
      check: (aggregate) => (aggregate[field] as unknown as number) >= 0,
      message: \`\${String(field)} cannot be negative\`,
    };
  },

  inRange<T, K extends keyof T>(field: K, min: number, max: number): InvariantRule<T> {
    return {
      name: \`\${String(field)}-in-range\`,
      check: (aggregate) => {
        const value = aggregate[field] as unknown as number;
        return value >= min && value <= max;
      },
      message: \`\${String(field)} must be between \${min} and \${max}\`,
    };
  },

  validState<T>(validStates: string[], stateField: keyof T): InvariantRule<T> {
    return {
      name: 'valid-state',
      check: (aggregate) => validStates.includes(String(aggregate[stateField])),
      message: (aggregate) => \`Invalid state: \${aggregate[stateField]}. Valid states: \${validStates.join(', ')}\`,
    };
  },
};
`;
}

function generateStateMachine(): string {
  return `/**
 * State Machine
 * Manages state transitions with validation
 */

export interface StateTransition<TState extends string, TEvent extends string> {
  from: TState | TState[];
  event: TEvent;
  to: TState;
  guard?: () => boolean;
  action?: () => void;
}

export interface StateMachineConfig<TState extends string, TEvent extends string> {
  initial: TState;
  transitions: StateTransition<TState, TEvent>[];
  onEnter?: Partial<Record<TState, () => void>>;
  onExit?: Partial<Record<TState, () => void>>;
}

/**
 * State Machine
 */
export class StateMachine<TState extends string, TEvent extends string> {
  private currentState: TState;
  private readonly config: StateMachineConfig<TState, TEvent>;
  private history: { from: TState; event: TEvent; to: TState; timestamp: Date }[] = [];

  constructor(config: StateMachineConfig<TState, TEvent>) {
    this.config = config;
    this.currentState = config.initial;
  }

  /**
   * Get current state
   */
  get state(): TState {
    return this.currentState;
  }

  /**
   * Check if transition is allowed
   */
  canTransition(event: TEvent): boolean {
    return this.findTransition(event) !== undefined;
  }

  /**
   * Get allowed events from current state
   */
  getAllowedEvents(): TEvent[] {
    return this.config.transitions
      .filter(t => this.matchesFrom(t.from, this.currentState))
      .filter(t => !t.guard || t.guard())
      .map(t => t.event);
  }

  /**
   * Trigger a transition
   */
  transition(event: TEvent): TState {
    const transition = this.findTransition(event);

    if (!transition) {
      throw new InvalidTransitionError(this.currentState, event);
    }

    const fromState = this.currentState;

    // Execute exit action
    if (this.config.onExit?.[fromState]) {
      this.config.onExit[fromState]!();
    }

    // Execute transition action
    if (transition.action) {
      transition.action();
    }

    // Update state
    this.currentState = transition.to;

    // Execute enter action
    if (this.config.onEnter?.[this.currentState]) {
      this.config.onEnter[this.currentState]!();
    }

    // Record history
    this.history.push({
      from: fromState,
      event,
      to: this.currentState,
      timestamp: new Date(),
    });

    return this.currentState;
  }

  /**
   * Get transition history
   */
  getHistory(): { from: TState; event: TEvent; to: TState; timestamp: Date }[] {
    return [...this.history];
  }

  /**
   * Check if in a specific state
   */
  isInState(state: TState): boolean {
    return this.currentState === state;
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.currentState = this.config.initial;
    this.history = [];
  }

  private findTransition(event: TEvent): StateTransition<TState, TEvent> | undefined {
    return this.config.transitions.find(t => {
      if (!this.matchesFrom(t.from, this.currentState)) return false;
      if (t.event !== event) return false;
      if (t.guard && !t.guard()) return false;
      return true;
    });
  }

  private matchesFrom(from: TState | TState[], currentState: TState): boolean {
    if (Array.isArray(from)) {
      return from.includes(currentState);
    }
    return from === currentState;
  }
}

/**
 * Invalid transition error
 */
export class InvalidTransitionError extends Error {
  constructor(
    public readonly fromState: string,
    public readonly event: string,
  ) {
    super(\`Cannot transition from '\${fromState}' with event '\${event}'\`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * State machine builder
 */
export class StateMachineBuilder<TState extends string, TEvent extends string> {
  private config: StateMachineConfig<TState, TEvent> = {
    initial: '' as TState,
    transitions: [],
    onEnter: {},
    onExit: {},
  };

  initial(state: TState): this {
    this.config.initial = state;
    return this;
  }

  transition(from: TState | TState[], event: TEvent, to: TState): this {
    this.config.transitions.push({ from, event, to });
    return this;
  }

  transitionWithGuard(
    from: TState | TState[],
    event: TEvent,
    to: TState,
    guard: () => boolean,
  ): this {
    this.config.transitions.push({ from, event, to, guard });
    return this;
  }

  onEnter(state: TState, action: () => void): this {
    this.config.onEnter![state] = action;
    return this;
  }

  onExit(state: TState, action: () => void): this {
    this.config.onExit![state] = action;
    return this;
  }

  build(): StateMachine<TState, TEvent> {
    return new StateMachine(this.config);
  }
}

/**
 * Create state machine builder
 */
export function stateMachine<TState extends string, TEvent extends string>(): StateMachineBuilder<TState, TEvent> {
  return new StateMachineBuilder<TState, TEvent>();
}
`;
}

function generateBusinessRulesEngine(): string {
  return `/**
 * Business Rules Engine
 * Centralized business rule validation
 */

export interface BusinessRule<TContext = any> {
  name: string;
  description?: string;
  priority?: number;
  condition: (context: TContext) => boolean;
  action: (context: TContext) => void | Promise<void>;
  onFailure?: (context: TContext) => void;
}

export interface RuleResult {
  rule: string;
  passed: boolean;
  message?: string;
}

/**
 * Business Rules Engine
 */
export class BusinessRulesEngine<TContext = any> {
  private rules: BusinessRule<TContext>[] = [];

  /**
   * Add a rule
   */
  addRule(rule: BusinessRule<TContext>): this {
    this.rules.push(rule);
    this.sortRules();
    return this;
  }

  /**
   * Remove a rule
   */
  removeRule(name: string): this {
    this.rules = this.rules.filter(r => r.name !== name);
    return this;
  }

  /**
   * Evaluate all rules
   */
  async evaluate(context: TContext): Promise<RuleResult[]> {
    const results: RuleResult[] = [];

    for (const rule of this.rules) {
      try {
        const passed = rule.condition(context);

        if (passed) {
          await rule.action(context);
        } else if (rule.onFailure) {
          rule.onFailure(context);
        }

        results.push({
          rule: rule.name,
          passed,
        });
      } catch (error) {
        results.push({
          rule: rule.name,
          passed: false,
          message: (error as Error).message,
        });
      }
    }

    return results;
  }

  /**
   * Evaluate and throw on first failure
   */
  async evaluateStrict(context: TContext): Promise<void> {
    for (const rule of this.rules) {
      if (!rule.condition(context)) {
        throw new BusinessRuleViolationError(rule.name, rule.description);
      }
      await rule.action(context);
    }
  }

  /**
   * Check if all rules pass without executing actions
   */
  check(context: TContext): boolean {
    return this.rules.every(rule => rule.condition(context));
  }

  /**
   * Get failing rules
   */
  getFailingRules(context: TContext): BusinessRule<TContext>[] {
    return this.rules.filter(rule => !rule.condition(context));
  }

  private sortRules(): void {
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
}

/**
 * Business rule violation error
 */
export class BusinessRuleViolationError extends Error {
  constructor(
    public readonly ruleName: string,
    public readonly ruleDescription?: string,
  ) {
    super(\`Business rule '\${ruleName}' violated\${ruleDescription ? \`: \${ruleDescription}\` : ''}\`);
    this.name = 'BusinessRuleViolationError';
  }
}

/**
 * Rule builder
 */
export class RuleBuilder<TContext = any> {
  private rule: Partial<BusinessRule<TContext>> = {};

  named(name: string): this {
    this.rule.name = name;
    return this;
  }

  describedAs(description: string): this {
    this.rule.description = description;
    return this;
  }

  withPriority(priority: number): this {
    this.rule.priority = priority;
    return this;
  }

  when(condition: (context: TContext) => boolean): this {
    this.rule.condition = condition;
    return this;
  }

  then(action: (context: TContext) => void | Promise<void>): this {
    this.rule.action = action;
    return this;
  }

  otherwise(handler: (context: TContext) => void): this {
    this.rule.onFailure = handler;
    return this;
  }

  build(): BusinessRule<TContext> {
    if (!this.rule.name || !this.rule.condition || !this.rule.action) {
      throw new Error('Business rule is incomplete');
    }
    return this.rule as BusinessRule<TContext>;
  }
}

/**
 * Create rule builder
 */
export function rule<TContext = any>(): RuleBuilder<TContext> {
  return new RuleBuilder<TContext>();
}
`;
}

function generateCommandValidator(): string {
  return `/**
 * Command Validator
 * Validates commands before execution
 */

import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

export interface CommandValidationResult {
  valid: boolean;
  errors: CommandValidationError[];
}

export interface CommandValidationError {
  property: string;
  constraints: Record<string, string>;
  value?: any;
}

/**
 * Command Validator
 */
export class CommandValidator {
  /**
   * Validate a command object
   */
  async validate<T extends object>(
    command: T,
    commandClass?: new () => T,
  ): Promise<CommandValidationResult> {
    const instance = commandClass
      ? plainToClass(commandClass, command)
      : command;

    const errors = await validate(instance as object);

    return {
      valid: errors.length === 0,
      errors: this.formatErrors(errors),
    };
  }

  /**
   * Validate and throw on error
   */
  async validateOrThrow<T extends object>(
    command: T,
    commandClass?: new () => T,
  ): Promise<void> {
    const result = await this.validate(command, commandClass);

    if (!result.valid) {
      throw new CommandValidationException(result.errors);
    }
  }

  private formatErrors(errors: ValidationError[]): CommandValidationError[] {
    return errors.map(error => ({
      property: error.property,
      constraints: error.constraints || {},
      value: error.value,
    }));
  }
}

/**
 * Command validation exception
 */
export class CommandValidationException extends Error {
  constructor(public readonly errors: CommandValidationError[]) {
    super(\`Command validation failed: \${errors.map(e => e.property).join(', ')}\`);
    this.name = 'CommandValidationException';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors,
    };
  }
}

/**
 * Command handler decorator with validation
 */
export function ValidateCommand(commandClass: new () => any): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const validator = new CommandValidator();

    descriptor.value = async function (...args: any[]) {
      const command = args[0];
      await validator.validateOrThrow(command, commandClass);
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Pre-condition decorator
 */
export function PreCondition(
  condition: (command: any) => boolean,
  message: string,
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const command = args[0];
      if (!condition(command)) {
        throw new PreConditionFailedError(message);
      }
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Pre-condition failed error
 */
export class PreConditionFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreConditionFailedError';
  }
}
`;
}
