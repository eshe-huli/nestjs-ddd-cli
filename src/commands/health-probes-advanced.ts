import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { toPascalCase, toKebabCase } from '../utils/naming.utils';

export interface HealthProbesOptions {
  module?: string;
  dependencies?: string[];
  includeKubernetes?: boolean;
}

export async function setupHealthProbesAdvanced(
  basePath: string,
  options: HealthProbesOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n🏥 Setting up Advanced Health Probes\n'));

  const moduleName = options.module || 'shared';
  const pascalName = toPascalCase(moduleName);
  const kebabName = toKebabCase(moduleName);
  const dependencies = options.dependencies || ['database', 'redis', 'external-api'];
  const includeKubernetes = options.includeKubernetes !== false;

  const baseDir = path.join(basePath, 'src', kebabName, 'infrastructure', 'health');
  fs.mkdirSync(baseDir, { recursive: true });

  // Health indicator registry
  const healthRegistryContent = `import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface DependencyHealth {
  name: string;
  status: HealthStatus;
  responseTimeMs?: number;
  message?: string;
  lastCheck: Date;
  consecutiveFailures: number;
}

export interface HealthCheckConfig {
  name: string;
  critical: boolean;
  timeout: number;
  interval: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
}

/**
 * Custom health indicator with circuit breaker pattern
 */
@Injectable()
export class DependencyHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(DependencyHealthIndicator.name);
  private readonly healthStates: Map<string, DependencyHealth> = new Map();
  private readonly configs: Map<string, HealthCheckConfig> = new Map();

  /**
   * Register a dependency health check
   */
  registerDependency(config: HealthCheckConfig): void {
    this.configs.set(config.name, config);
    this.healthStates.set(config.name, {
      name: config.name,
      status: 'healthy',
      lastCheck: new Date(),
      consecutiveFailures: 0,
    });
  }

  /**
   * Check a dependency's health
   */
  async checkDependency(
    name: string,
    checkFn: () => Promise<boolean>,
  ): Promise<HealthIndicatorResult> {
    const config = this.configs.get(name);
    const state = this.healthStates.get(name);

    if (!config || !state) {
      throw new HealthCheckError(
        \`Dependency \${name} not registered\`,
        this.getStatus(name, false),
      );
    }

    const startTime = Date.now();

    try {
      // Add timeout to health check
      const result = await Promise.race([
        checkFn(),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), config.timeout),
        ),
      ]);

      const responseTime = Date.now() - startTime;

      if (result) {
        state.consecutiveFailures = 0;
        state.status = 'healthy';
        state.responseTimeMs = responseTime;
        state.message = undefined;
        state.lastCheck = new Date();

        return this.getStatus(name, true, { responseTimeMs: responseTime });
      } else {
        throw new Error('Health check returned false');
      }
    } catch (error) {
      state.consecutiveFailures++;
      state.lastCheck = new Date();
      state.message = error instanceof Error ? error.message : 'Unknown error';
      state.responseTimeMs = Date.now() - startTime;

      // Determine status based on consecutive failures
      if (state.consecutiveFailures >= config.unhealthyThreshold) {
        state.status = 'unhealthy';
      } else if (state.consecutiveFailures >= Math.ceil(config.unhealthyThreshold / 2)) {
        state.status = 'degraded';
      }

      this.logger.warn(
        \`Health check failed for \${name}: \${state.message} (failures: \${state.consecutiveFailures})\`,
      );

      if (config.critical && state.status === 'unhealthy') {
        throw new HealthCheckError(
          \`Critical dependency \${name} is unhealthy\`,
          this.getStatus(name, false, { error: state.message }),
        );
      }

      return this.getStatus(name, state.status !== 'unhealthy', {
        status: state.status,
        error: state.message,
        consecutiveFailures: state.consecutiveFailures,
      });
    }
  }

  /**
   * Get all dependency health states
   */
  getAllHealthStates(): DependencyHealth[] {
    return Array.from(this.healthStates.values());
  }

  /**
   * Get overall health status
   */
  getOverallStatus(): HealthStatus {
    const states = this.getAllHealthStates();

    if (states.some((s) => s.status === 'unhealthy')) {
      return 'unhealthy';
    }
    if (states.some((s) => s.status === 'degraded')) {
      return 'degraded';
    }
    return 'healthy';
  }
}

/**
 * Database health indicator
 */
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  async check(key: string, pingFn: () => Promise<boolean>): Promise<HealthIndicatorResult> {
    try {
      const isHealthy = await pingFn();
      return this.getStatus(key, isHealthy);
    } catch (error) {
      throw new HealthCheckError(
        \`Database \${key} health check failed\`,
        this.getStatus(key, false, { error: error instanceof Error ? error.message : 'Unknown' }),
      );
    }
  }
}

/**
 * Memory health indicator
 */
@Injectable()
export class MemoryHealthIndicator extends HealthIndicator {
  check(
    key: string,
    options: { heapUsedThreshold: number; rssThreshold: number },
  ): HealthIndicatorResult {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const rssMB = memUsage.rss / 1024 / 1024;

    const isHealthy = heapUsedMB < options.heapUsedThreshold && rssMB < options.rssThreshold;

    return this.getStatus(key, isHealthy, {
      heapUsedMB: Math.round(heapUsedMB),
      rssMB: Math.round(rssMB),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
    });
  }
}

/**
 * Disk health indicator
 */
@Injectable()
export class DiskHealthIndicator extends HealthIndicator {
  async check(
    key: string,
    options: { path: string; thresholdPercent: number },
  ): Promise<HealthIndicatorResult> {
    // This is a placeholder - in production, use a library like 'diskusage'
    // or call df command
    return this.getStatus(key, true, {
      path: options.path,
      threshold: options.thresholdPercent,
    });
  }
}
`;
  fs.writeFileSync(path.join(baseDir, 'health-indicators.ts'), healthRegistryContent);

  // Health controller with Kubernetes probes
  const healthControllerContent = `import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from '@nestjs/terminus';
import {
  DependencyHealthIndicator,
  DatabaseHealthIndicator,
  MemoryHealthIndicator,
  HealthStatus,
} from './health-indicators';

interface ProbeResponse {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  checks?: Record<string, any>;
}

/**
 * Health check controller with Kubernetes probe support
 */
@Controller('health')
export class HealthController {
  private startTime: Date;
  private ready: boolean = false;

  constructor(
    private readonly health: HealthCheckService,
    private readonly dependencyHealth: DependencyHealthIndicator,
    private readonly dbHealth: DatabaseHealthIndicator,
    private readonly memoryHealth: MemoryHealthIndicator,
  ) {
    this.startTime = new Date();
  }

  /**
   * Liveness probe - Is the application running?
   * Returns 200 if the process is alive, regardless of dependency health
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  async liveness(@Res() res: Response): Promise<void> {
    const response: ProbeResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: this.getUptimeSeconds(),
    };

    res.status(HttpStatus.OK).json(response);
  }

  /**
   * Readiness probe - Is the application ready to receive traffic?
   * Returns 200 only if all critical dependencies are healthy
   */
  @Get('ready')
  async readiness(@Res() res: Response): Promise<void> {
    const checks = this.dependencyHealth.getAllHealthStates();
    const overallStatus = this.dependencyHealth.getOverallStatus();

    const response: ProbeResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: this.getUptimeSeconds(),
      checks: checks.reduce((acc, check) => {
        acc[check.name] = {
          status: check.status,
          responseTimeMs: check.responseTimeMs,
          lastCheck: check.lastCheck,
        };
        return acc;
      }, {} as Record<string, any>),
    };

    const httpStatus = overallStatus === 'unhealthy'
      ? HttpStatus.SERVICE_UNAVAILABLE
      : HttpStatus.OK;

    res.status(httpStatus).json(response);
  }

  /**
   * Startup probe - Has the application finished initialization?
   * Kubernetes uses this to know when to start liveness/readiness checks
   */
  @Get('startup')
  async startup(@Res() res: Response): Promise<void> {
    const response: ProbeResponse = {
      status: this.ready ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: this.getUptimeSeconds(),
    };

    const httpStatus = this.ready
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE;

    res.status(httpStatus).json(response);
  }

  /**
   * Mark application as ready (call after initialization)
   */
  markReady(): void {
    this.ready = true;
  }

  /**
   * Mark application as not ready (e.g., during graceful shutdown)
   */
  markNotReady(): void {
    this.ready = false;
  }

  /**
   * Detailed health check with all indicators
   */
  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      // Memory check
      () => this.memoryHealth.check('memory', {
        heapUsedThreshold: 500, // MB
        rssThreshold: 1000, // MB
      }),
      // Add more checks here
    ]);
  }

  /**
   * Deep health check - checks all dependencies
   */
  @Get('deep')
  async deepCheck(@Res() res: Response): Promise<void> {
    const startTime = Date.now();
    const checks = this.dependencyHealth.getAllHealthStates();
    const overallStatus = this.dependencyHealth.getOverallStatus();

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: this.getUptimeSeconds(),
      checkDurationMs: Date.now() - startTime,
      dependencies: checks.map((check) => ({
        name: check.name,
        status: check.status,
        responseTimeMs: check.responseTimeMs,
        message: check.message,
        lastCheck: check.lastCheck,
        consecutiveFailures: check.consecutiveFailures,
      })),
      system: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        nodeVersion: process.version,
        pid: process.pid,
      },
    };

    const httpStatus = overallStatus === 'unhealthy'
      ? HttpStatus.SERVICE_UNAVAILABLE
      : HttpStatus.OK;

    res.status(httpStatus).json(response);
  }

  private getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }
}
`;
  fs.writeFileSync(path.join(baseDir, 'health.controller.ts'), healthControllerContent);

  // Graceful shutdown handler
  const gracefulShutdownContent = `import { Injectable, Logger, OnModuleDestroy, OnApplicationShutdown } from '@nestjs/common';
import { HealthController } from './health.controller';

interface ShutdownHook {
  name: string;
  priority: number;
  handler: () => Promise<void>;
}

/**
 * Graceful shutdown manager for Kubernetes
 */
@Injectable()
export class GracefulShutdownService implements OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private readonly hooks: ShutdownHook[] = [];
  private isShuttingDown: boolean = false;
  private readonly shutdownTimeout: number;
  private readonly preShutdownWait: number;

  constructor(private readonly healthController: HealthController) {
    this.shutdownTimeout = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10);
    this.preShutdownWait = parseInt(process.env.PRE_SHUTDOWN_WAIT_MS || '5000', 10);

    // Handle process signals
    process.on('SIGTERM', () => this.handleSignal('SIGTERM'));
    process.on('SIGINT', () => this.handleSignal('SIGINT'));
  }

  /**
   * Register a shutdown hook
   */
  registerHook(name: string, handler: () => Promise<void>, priority: number = 10): void {
    this.hooks.push({ name, handler, priority });
    this.hooks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Handle shutdown signal
   */
  private async handleSignal(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn(\`Already shutting down, ignoring \${signal}\`);
      return;
    }

    this.isShuttingDown = true;
    this.logger.log(\`Received \${signal}, starting graceful shutdown...\`);

    // Mark as not ready immediately
    this.healthController.markNotReady();

    // Wait for in-flight requests to complete
    this.logger.log(\`Waiting \${this.preShutdownWait}ms for in-flight requests...\`);
    await this.sleep(this.preShutdownWait);

    // Run shutdown hooks with timeout
    await this.runHooksWithTimeout();

    this.logger.log('Graceful shutdown complete');
    process.exit(0);
  }

  /**
   * Run all hooks with overall timeout
   */
  private async runHooksWithTimeout(): Promise<void> {
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Shutdown timeout exceeded')), this.shutdownTimeout);
    });

    try {
      await Promise.race([this.runHooks(), timeoutPromise]);
    } catch (error) {
      this.logger.error(\`Shutdown error: \${error}\`);
    }
  }

  /**
   * Run all registered hooks
   */
  private async runHooks(): Promise<void> {
    for (const hook of this.hooks) {
      try {
        this.logger.log(\`Running shutdown hook: \${hook.name}\`);
        await hook.handler();
        this.logger.log(\`Completed shutdown hook: \${hook.name}\`);
      } catch (error) {
        this.logger.error(\`Shutdown hook \${hook.name} failed: \${error}\`);
      }
    }
  }

  /**
   * NestJS lifecycle hook
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Module destroying...');
  }

  /**
   * NestJS lifecycle hook
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(\`Application shutdown: \${signal}\`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
`;
  fs.writeFileSync(path.join(baseDir, 'graceful-shutdown.service.ts'), gracefulShutdownContent);

  // Kubernetes configuration examples
  if (includeKubernetes) {
    const k8sConfigContent = `# Kubernetes Health Probe Configuration
# Add these to your deployment spec

# Example deployment.yaml probes configuration:
#
# spec:
#   containers:
#   - name: ${kebabName}
#     livenessProbe:
#       httpGet:
#         path: /health/live
#         port: 3000
#       initialDelaySeconds: 10
#       periodSeconds: 10
#       timeoutSeconds: 5
#       failureThreshold: 3
#
#     readinessProbe:
#       httpGet:
#         path: /health/ready
#         port: 3000
#       initialDelaySeconds: 5
#       periodSeconds: 5
#       timeoutSeconds: 3
#       failureThreshold: 3
#
#     startupProbe:
#       httpGet:
#         path: /health/startup
#         port: 3000
#       initialDelaySeconds: 0
#       periodSeconds: 5
#       timeoutSeconds: 3
#       failureThreshold: 30  # 30 * 5s = 150s max startup time
#
# Environment variables for graceful shutdown:
#   - name: SHUTDOWN_TIMEOUT_MS
#     value: "30000"
#   - name: PRE_SHUTDOWN_WAIT_MS
#     value: "5000"
#
# Lifecycle hooks for graceful shutdown:
#   lifecycle:
#     preStop:
#       exec:
#         command: ["sh", "-c", "sleep 5"]  # Allow time for service mesh to drain
#
# Pod disruption budget (optional):
# apiVersion: policy/v1
# kind: PodDisruptionBudget
# metadata:
#   name: ${kebabName}-pdb
# spec:
#   minAvailable: 1
#   selector:
#     matchLabels:
#       app: ${kebabName}
`;
    fs.writeFileSync(path.join(baseDir, 'k8s-probes.yaml'), k8sConfigContent);
  }

  // Health module
  const healthModuleContent = `import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import {
  DependencyHealthIndicator,
  DatabaseHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from './health-indicators';
import { GracefulShutdownService } from './graceful-shutdown.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    DependencyHealthIndicator,
    DatabaseHealthIndicator,
    MemoryHealthIndicator,
    DiskHealthIndicator,
    GracefulShutdownService,
  ],
  exports: [
    DependencyHealthIndicator,
    GracefulShutdownService,
  ],
})
export class ${pascalName}HealthModule {}
`;
  fs.writeFileSync(path.join(baseDir, 'health.module.ts'), healthModuleContent);

  console.log(chalk.green(`  ✓ Created health indicators`));
  console.log(chalk.green(`  ✓ Created health controller`));
  console.log(chalk.green(`  ✓ Created graceful shutdown service`));
  console.log(chalk.green(`  ✓ Created health module`));
  if (includeKubernetes) {
    console.log(chalk.green(`  ✓ Created Kubernetes configuration`));
  }

  console.log(chalk.bold.green(`\n✅ Advanced health probes setup complete for ${pascalName}`));
  console.log(chalk.cyan(`Generated files in: ${baseDir}`));
  console.log(chalk.gray('  - health-indicators.ts (Custom health indicators)'));
  console.log(chalk.gray('  - health.controller.ts (K8s probe endpoints)'));
  console.log(chalk.gray('  - graceful-shutdown.service.ts (Graceful shutdown)'));
  console.log(chalk.gray('  - health.module.ts (Health module)'));
  if (includeKubernetes) {
    console.log(chalk.gray('  - k8s-probes.yaml (Kubernetes configuration)'));
  }
}
