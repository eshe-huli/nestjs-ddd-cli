/**
 * Feature Flags & Toggles Framework Generator
 * Runtime feature management with A/B testing support
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface FeatureFlagsOptions {
  path?: string;
  provider?: 'memory' | 'database' | 'redis' | 'launchdarkly';
}

export async function setupFeatureFlags(
  basePath: string,
  options: FeatureFlagsOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n🚩 Setting up Feature Flags Framework\n'));

  const sharedPath = path.join(basePath, 'src/shared/features');

  if (!fs.existsSync(sharedPath)) {
    fs.mkdirSync(sharedPath, { recursive: true });
  }

  // Generate feature flag service
  fs.writeFileSync(path.join(sharedPath, 'feature-flag.service.ts'), generateFeatureFlagService());
  console.log(chalk.green(`  ✓ Created feature flag service`));

  // Generate feature decorator
  fs.writeFileSync(path.join(sharedPath, 'feature.decorator.ts'), generateFeatureDecorator());
  console.log(chalk.green(`  ✓ Created feature decorator`));

  // Generate feature guard
  fs.writeFileSync(path.join(sharedPath, 'feature.guard.ts'), generateFeatureGuard());
  console.log(chalk.green(`  ✓ Created feature guard`));

  // Generate A/B testing service
  fs.writeFileSync(path.join(sharedPath, 'ab-testing.service.ts'), generateABTestingService());
  console.log(chalk.green(`  ✓ Created A/B testing service`));

  // Generate feature flag entity
  fs.writeFileSync(path.join(sharedPath, 'feature-flag.entity.ts'), generateFeatureFlagEntity());
  console.log(chalk.green(`  ✓ Created feature flag entity`));

  // Generate feature module
  fs.writeFileSync(path.join(sharedPath, 'feature.module.ts'), generateFeatureModule());
  console.log(chalk.green(`  ✓ Created feature module`));

  console.log(chalk.bold.green('\n✅ Feature flags framework ready!\n'));
}

function generateFeatureFlagService(): string {
  return `/**
 * Feature Flag Service
 * Manages feature toggles at runtime
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
  conditions?: FeatureCondition[];
  variants?: FeatureVariant[];
  percentage?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureCondition {
  type: 'user' | 'group' | 'percentage' | 'date' | 'custom';
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'in' | 'not_in';
  field?: string;
  value: any;
}

export interface FeatureVariant {
  name: string;
  weight: number;
  payload?: any;
}

export interface FeatureContext {
  userId?: string;
  userGroups?: string[];
  attributes?: Record<string, any>;
  sessionId?: string;
}

@Injectable()
export class FeatureFlagService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagService.name);
  private readonly flags = new Map<string, FeatureFlag>();
  private readonly overrides = new Map<string, Map<string, boolean>>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async onModuleInit() {
    await this.loadFlags();
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(key: string, context?: FeatureContext): boolean {
    // Check for user override
    if (context?.userId) {
      const userOverrides = this.overrides.get(context.userId);
      if (userOverrides?.has(key)) {
        return userOverrides.get(key)!;
      }
    }

    const flag = this.flags.get(key);
    if (!flag) {
      this.logger.warn(\`Feature flag '\${key}' not found\`);
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // Check conditions
    if (flag.conditions && flag.conditions.length > 0) {
      return this.evaluateConditions(flag.conditions, context);
    }

    // Check percentage rollout
    if (flag.percentage !== undefined) {
      return this.evaluatePercentage(key, flag.percentage, context);
    }

    return true;
  }

  /**
   * Get feature variant
   */
  getVariant(key: string, context?: FeatureContext): FeatureVariant | null {
    const flag = this.flags.get(key);
    if (!flag || !flag.variants || flag.variants.length === 0) {
      return null;
    }

    if (!this.isEnabled(key, context)) {
      return null;
    }

    return this.selectVariant(key, flag.variants, context);
  }

  /**
   * Create or update a feature flag
   */
  async setFlag(key: string, config: Partial<FeatureFlag>): Promise<FeatureFlag> {
    const existing = this.flags.get(key);
    const flag: FeatureFlag = {
      key,
      enabled: config.enabled ?? existing?.enabled ?? false,
      description: config.description ?? existing?.description,
      conditions: config.conditions ?? existing?.conditions,
      variants: config.variants ?? existing?.variants,
      percentage: config.percentage ?? existing?.percentage,
      metadata: config.metadata ?? existing?.metadata,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };

    this.flags.set(key, flag);
    this.eventEmitter.emit('feature-flag.updated', { key, flag });

    return flag;
  }

  /**
   * Enable a feature
   */
  async enable(key: string): Promise<void> {
    await this.setFlag(key, { enabled: true });
    this.logger.log(\`Feature '\${key}' enabled\`);
  }

  /**
   * Disable a feature
   */
  async disable(key: string): Promise<void> {
    await this.setFlag(key, { enabled: false });
    this.logger.log(\`Feature '\${key}' disabled\`);
  }

  /**
   * Set user override
   */
  setUserOverride(userId: string, key: string, enabled: boolean): void {
    let userOverrides = this.overrides.get(userId);
    if (!userOverrides) {
      userOverrides = new Map();
      this.overrides.set(userId, userOverrides);
    }
    userOverrides.set(key, enabled);
  }

  /**
   * Remove user override
   */
  removeUserOverride(userId: string, key: string): void {
    const userOverrides = this.overrides.get(userId);
    if (userOverrides) {
      userOverrides.delete(key);
    }
  }

  /**
   * Get all flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get flag by key
   */
  getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  /**
   * Delete a flag
   */
  async deleteFlag(key: string): Promise<void> {
    this.flags.delete(key);
    this.eventEmitter.emit('feature-flag.deleted', { key });
  }

  private async loadFlags(): Promise<void> {
    // Override this method to load flags from database/external source
    this.logger.log('Feature flags loaded');
  }

  private evaluateConditions(conditions: FeatureCondition[], context?: FeatureContext): boolean {
    if (!context) return false;

    return conditions.every(condition => {
      switch (condition.type) {
        case 'user':
          return this.evaluateUserCondition(condition, context);
        case 'group':
          return this.evaluateGroupCondition(condition, context);
        case 'percentage':
          return this.evaluatePercentageCondition(condition, context);
        case 'date':
          return this.evaluateDateCondition(condition);
        case 'custom':
          return this.evaluateCustomCondition(condition, context);
        default:
          return false;
      }
    });
  }

  private evaluateUserCondition(condition: FeatureCondition, context: FeatureContext): boolean {
    if (!context.userId) return false;

    switch (condition.operator) {
      case 'equals':
        return context.userId === condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(context.userId);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(context.userId);
      default:
        return false;
    }
  }

  private evaluateGroupCondition(condition: FeatureCondition, context: FeatureContext): boolean {
    if (!context.userGroups) return false;

    switch (condition.operator) {
      case 'contains':
        return context.userGroups.includes(condition.value);
      case 'in':
        return Array.isArray(condition.value) &&
          condition.value.some(g => context.userGroups!.includes(g));
      default:
        return false;
    }
  }

  private evaluatePercentageCondition(condition: FeatureCondition, context: FeatureContext): boolean {
    const hash = this.hashString(context.userId || context.sessionId || 'anonymous');
    return (hash % 100) < condition.value;
  }

  private evaluateDateCondition(condition: FeatureCondition): boolean {
    const now = new Date();
    const targetDate = new Date(condition.value);

    switch (condition.operator) {
      case 'gt':
        return now > targetDate;
      case 'lt':
        return now < targetDate;
      default:
        return false;
    }
  }

  private evaluateCustomCondition(condition: FeatureCondition, context: FeatureContext): boolean {
    if (!context.attributes || !condition.field) return false;

    const value = context.attributes[condition.field];

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return String(value).includes(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      default:
        return false;
    }
  }

  private evaluatePercentage(key: string, percentage: number, context?: FeatureContext): boolean {
    const identifier = context?.userId || context?.sessionId || 'anonymous';
    const hash = this.hashString(\`\${key}:\${identifier}\`);
    return (hash % 100) < percentage;
  }

  private selectVariant(key: string, variants: FeatureVariant[], context?: FeatureContext): FeatureVariant {
    const identifier = context?.userId || context?.sessionId || 'anonymous';
    const hash = this.hashString(\`\${key}:variant:\${identifier}\`);
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    let random = hash % totalWeight;

    for (const variant of variants) {
      random -= variant.weight;
      if (random < 0) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
`;
}

function generateFeatureDecorator(): string {
  return `/**
 * Feature Decorators
 * Mark endpoints and methods with feature flag requirements
 */

import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { FeatureGuard } from './feature.guard';

export const FEATURE_KEY = 'feature_flag_key';
export const FEATURE_FALLBACK = 'feature_fallback';

/**
 * Require a feature flag to be enabled
 */
export function Feature(key: string, options?: { fallback?: any }) {
  return applyDecorators(
    SetMetadata(FEATURE_KEY, key),
    SetMetadata(FEATURE_FALLBACK, options?.fallback),
    UseGuards(FeatureGuard),
  );
}

/**
 * Mark as beta feature
 */
export function BetaFeature(key: string) {
  return Feature(\`beta:\${key}\`);
}

/**
 * Mark as experimental feature
 */
export function ExperimentalFeature(key: string) {
  return Feature(\`experimental:\${key}\`);
}

/**
 * Mark feature with variant requirement
 */
export function FeatureVariant(key: string, variant: string) {
  return applyDecorators(
    SetMetadata(FEATURE_KEY, key),
    SetMetadata('feature_variant', variant),
    UseGuards(FeatureGuard),
  );
}

/**
 * Skip feature flag check (useful for overriding in tests)
 */
export function SkipFeatureCheck() {
  return SetMetadata('skip_feature_check', true);
}
`;
}

function generateFeatureGuard(): string {
  return `/**
 * Feature Guard
 * Protects routes based on feature flags
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagService, FeatureContext } from './feature-flag.service';
import { FEATURE_KEY, FEATURE_FALLBACK } from './feature.decorator';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipCheck = this.reflector.get<boolean>('skip_feature_check', context.getHandler());
    if (skipCheck) {
      return true;
    }

    const featureKey = this.reflector.get<string>(FEATURE_KEY, context.getHandler());
    if (!featureKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const featureContext = this.extractContext(request);

    const isEnabled = this.featureService.isEnabled(featureKey, featureContext);

    if (!isEnabled) {
      const fallback = this.reflector.get<any>(FEATURE_FALLBACK, context.getHandler());
      if (fallback !== undefined) {
        // Store fallback in request for controller to use
        request.featureFallback = fallback;
        return true;
      }

      throw new ForbiddenException(\`Feature '\${featureKey}' is not available\`);
    }

    // Check variant if specified
    const requiredVariant = this.reflector.get<string>('feature_variant', context.getHandler());
    if (requiredVariant) {
      const variant = this.featureService.getVariant(featureKey, featureContext);
      if (!variant || variant.name !== requiredVariant) {
        throw new ForbiddenException(\`Feature variant '\${requiredVariant}' is not available\`);
      }
      request.featureVariant = variant;
    }

    return true;
  }

  private extractContext(request: any): FeatureContext {
    return {
      userId: request.user?.id,
      userGroups: request.user?.groups || request.user?.roles,
      sessionId: request.sessionID || request.headers['x-session-id'],
      attributes: {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        ...request.user,
      },
    };
  }
}
`;
}

function generateABTestingService(): string {
  return `/**
 * A/B Testing Service
 * Manage experiments and variant assignments
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  variants: ExperimentVariant[];
  status: 'draft' | 'running' | 'paused' | 'completed';
  targetPercentage: number;
  startDate?: Date;
  endDate?: Date;
  metrics: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
  isControl: boolean;
  payload?: any;
}

export interface ExperimentAssignment {
  experimentId: string;
  variantId: string;
  userId: string;
  assignedAt: Date;
}

export interface ExperimentResult {
  experimentId: string;
  variantId: string;
  metric: string;
  value: number;
  sampleSize: number;
  confidence?: number;
}

@Injectable()
export class ABTestingService {
  private readonly logger = new Logger(ABTestingService.name);
  private readonly experiments = new Map<string, Experiment>();
  private readonly assignments = new Map<string, ExperimentAssignment>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Create an experiment
   */
  createExperiment(config: Omit<Experiment, 'createdAt' | 'updatedAt' | 'status'>): Experiment {
    const experiment: Experiment = {
      ...config,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.experiments.set(experiment.id, experiment);
    this.eventEmitter.emit('experiment.created', experiment);

    return experiment;
  }

  /**
   * Start an experiment
   */
  startExperiment(id: string): Experiment {
    const experiment = this.experiments.get(id);
    if (!experiment) {
      throw new Error(\`Experiment '\${id}' not found\`);
    }

    experiment.status = 'running';
    experiment.startDate = new Date();
    experiment.updatedAt = new Date();

    this.eventEmitter.emit('experiment.started', experiment);
    return experiment;
  }

  /**
   * Stop an experiment
   */
  stopExperiment(id: string): Experiment {
    const experiment = this.experiments.get(id);
    if (!experiment) {
      throw new Error(\`Experiment '\${id}' not found\`);
    }

    experiment.status = 'completed';
    experiment.endDate = new Date();
    experiment.updatedAt = new Date();

    this.eventEmitter.emit('experiment.stopped', experiment);
    return experiment;
  }

  /**
   * Get variant for user
   */
  getVariant(experimentId: string, userId: string): ExperimentVariant | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return null;
    }

    // Check existing assignment
    const assignmentKey = \`\${experimentId}:\${userId}\`;
    const existing = this.assignments.get(assignmentKey);
    if (existing) {
      return experiment.variants.find(v => v.id === existing.variantId) || null;
    }

    // Check if user is in target percentage
    if (!this.isInTarget(experimentId, userId, experiment.targetPercentage)) {
      return null;
    }

    // Assign variant
    const variant = this.selectVariant(experimentId, userId, experiment.variants);

    const assignment: ExperimentAssignment = {
      experimentId,
      variantId: variant.id,
      userId,
      assignedAt: new Date(),
    };
    this.assignments.set(assignmentKey, assignment);

    this.eventEmitter.emit('experiment.assigned', {
      experimentId,
      variantId: variant.id,
      userId,
    });

    return variant;
  }

  /**
   * Track experiment event
   */
  trackEvent(experimentId: string, userId: string, metric: string, value: number = 1): void {
    const assignmentKey = \`\${experimentId}:\${userId}\`;
    const assignment = this.assignments.get(assignmentKey);

    if (!assignment) {
      this.logger.warn(\`No assignment found for user \${userId} in experiment \${experimentId}\`);
      return;
    }

    this.eventEmitter.emit('experiment.event', {
      experimentId,
      variantId: assignment.variantId,
      userId,
      metric,
      value,
      timestamp: new Date(),
    });
  }

  /**
   * Get experiment results
   */
  getResults(experimentId: string): ExperimentResult[] {
    // This would aggregate tracked events
    // Implementation depends on your analytics storage
    return [];
  }

  /**
   * List all experiments
   */
  listExperiments(): Experiment[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Get experiment by ID
   */
  getExperiment(id: string): Experiment | undefined {
    return this.experiments.get(id);
  }

  private isInTarget(experimentId: string, userId: string, percentage: number): boolean {
    const hash = this.hashString(\`\${experimentId}:target:\${userId}\`);
    return (hash % 100) < percentage;
  }

  private selectVariant(experimentId: string, userId: string, variants: ExperimentVariant[]): ExperimentVariant {
    const hash = this.hashString(\`\${experimentId}:variant:\${userId}\`);
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    let random = hash % totalWeight;

    for (const variant of variants) {
      random -= variant.weight;
      if (random < 0) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
`;
}

function generateFeatureFlagEntity(): string {
  return `import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('feature_flags')
export class FeatureFlagEntity {
  @PrimaryColumn()
  key: string;

  @Column({ default: false })
  enabled: boolean;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  conditions: any;

  @Column({ type: 'jsonb', nullable: true })
  variants: any;

  @Column({ type: 'float', nullable: true })
  percentage: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
`;
}

function generateFeatureModule(): string {
  return `import { Module, Global, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagService } from './feature-flag.service';
import { FeatureGuard } from './feature.guard';
import { ABTestingService } from './ab-testing.service';
import { FeatureFlagEntity } from './feature-flag.entity';

export interface FeatureModuleOptions {
  provider?: 'memory' | 'database' | 'redis';
  refreshInterval?: number;
}

@Global()
@Module({})
export class FeatureModule {
  static forRoot(options: FeatureModuleOptions = {}): DynamicModule {
    const imports = [];

    if (options.provider === 'database') {
      imports.push(TypeOrmModule.forFeature([FeatureFlagEntity]));
    }

    return {
      module: FeatureModule,
      imports,
      providers: [
        {
          provide: 'FEATURE_OPTIONS',
          useValue: options,
        },
        FeatureFlagService,
        ABTestingService,
        FeatureGuard,
      ],
      exports: [FeatureFlagService, ABTestingService, FeatureGuard],
    };
  }
}
`;
}
