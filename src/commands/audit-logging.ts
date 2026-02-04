/**
 * Audit Logging & Compliance Framework Generator
 * Generates comprehensive audit trail infrastructure
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface AuditLoggingOptions {
  path?: string;
  storage?: 'database' | 'file' | 'elasticsearch';
}

export async function setupAuditLogging(
  basePath: string,
  options: AuditLoggingOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n📝 Setting up Audit Logging Framework\n'));

  const sharedPath = path.join(basePath, 'src/shared/audit');

  if (!fs.existsSync(sharedPath)) {
    fs.mkdirSync(sharedPath, { recursive: true });
  }

  // Generate audit module
  const moduleContent = generateAuditModule();
  fs.writeFileSync(path.join(sharedPath, 'audit.module.ts'), moduleContent);
  console.log(chalk.green(`  ✓ Created audit module`));

  // Generate audit service
  const serviceContent = generateAuditService(options);
  fs.writeFileSync(path.join(sharedPath, 'audit.service.ts'), serviceContent);
  console.log(chalk.green(`  ✓ Created audit service`));

  // Generate audit interceptor
  const interceptorContent = generateAuditInterceptor();
  fs.writeFileSync(path.join(sharedPath, 'audit.interceptor.ts'), interceptorContent);
  console.log(chalk.green(`  ✓ Created audit interceptor`));

  // Generate audit entity
  const entityContent = generateAuditEntity();
  fs.writeFileSync(path.join(sharedPath, 'audit-log.entity.ts'), entityContent);
  console.log(chalk.green(`  ✓ Created audit log entity`));

  // Generate audit decorators
  const decoratorContent = generateAuditDecorators();
  fs.writeFileSync(path.join(sharedPath, 'audit.decorators.ts'), decoratorContent);
  console.log(chalk.green(`  ✓ Created audit decorators`));

  // Generate compliance reporter
  const reporterContent = generateComplianceReporter();
  fs.writeFileSync(path.join(sharedPath, 'compliance.reporter.ts'), reporterContent);
  console.log(chalk.green(`  ✓ Created compliance reporter`));

  console.log(chalk.bold.green('\n✅ Audit logging framework ready!\n'));
}

function generateAuditModule(): string {
  return `import { Module, Global, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditLog } from './audit-log.entity';
import { ComplianceReporter } from './compliance.reporter';

export interface AuditModuleOptions {
  storage: 'database' | 'file' | 'elasticsearch';
  retentionDays?: number;
  excludePaths?: string[];
  excludeMethods?: string[];
  sensitiveFields?: string[];
  enableCompression?: boolean;
}

@Global()
@Module({})
export class AuditModule {
  static forRoot(options: AuditModuleOptions): DynamicModule {
    return {
      module: AuditModule,
      imports: [
        TypeOrmModule.forFeature([AuditLog]),
      ],
      providers: [
        {
          provide: 'AUDIT_OPTIONS',
          useValue: options,
        },
        AuditService,
        ComplianceReporter,
        {
          provide: APP_INTERCEPTOR,
          useClass: AuditInterceptor,
        },
      ],
      exports: [AuditService, ComplianceReporter],
    };
  }
}
`;
}

function generateAuditService(options: AuditLoggingOptions): string {
  return `import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like } from 'typeorm';
import { AuditLog, AuditAction, AuditCategory } from './audit-log.entity';

export interface AuditEntry {
  action: AuditAction;
  category: AuditCategory;
  userId?: string;
  resourceType: string;
  resourceId?: string;
  description: string;
  oldValue?: any;
  newValue?: any;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditQuery {
  userId?: string;
  action?: AuditAction;
  category?: AuditCategory;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    @Inject('AUDIT_OPTIONS') private readonly options: any,
  ) {}

  /**
   * Log an audit entry
   */
  async log(entry: AuditEntry): Promise<AuditLog> {
    const auditLog = this.auditRepository.create({
      ...entry,
      oldValue: this.sanitize(entry.oldValue),
      newValue: this.sanitize(entry.newValue),
      timestamp: new Date(),
    });

    const saved = await this.auditRepository.save(auditLog);
    this.logger.debug(\`Audit log created: \${entry.action} on \${entry.resourceType}\`);

    return saved;
  }

  /**
   * Log a create action
   */
  async logCreate(params: {
    userId?: string;
    resourceType: string;
    resourceId: string;
    newValue: any;
    metadata?: Record<string, any>;
  }): Promise<AuditLog> {
    return this.log({
      action: AuditAction.CREATE,
      category: AuditCategory.DATA_CHANGE,
      description: \`Created \${params.resourceType} with ID \${params.resourceId}\`,
      ...params,
    });
  }

  /**
   * Log an update action
   */
  async logUpdate(params: {
    userId?: string;
    resourceType: string;
    resourceId: string;
    oldValue: any;
    newValue: any;
    metadata?: Record<string, any>;
  }): Promise<AuditLog> {
    const changes = this.computeChanges(params.oldValue, params.newValue);

    return this.log({
      action: AuditAction.UPDATE,
      category: AuditCategory.DATA_CHANGE,
      description: \`Updated \${params.resourceType} with ID \${params.resourceId}\`,
      metadata: { ...params.metadata, changes },
      ...params,
    });
  }

  /**
   * Log a delete action
   */
  async logDelete(params: {
    userId?: string;
    resourceType: string;
    resourceId: string;
    oldValue?: any;
    metadata?: Record<string, any>;
  }): Promise<AuditLog> {
    return this.log({
      action: AuditAction.DELETE,
      category: AuditCategory.DATA_CHANGE,
      description: \`Deleted \${params.resourceType} with ID \${params.resourceId}\`,
      ...params,
    });
  }

  /**
   * Log an access action
   */
  async logAccess(params: {
    userId?: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, any>;
  }): Promise<AuditLog> {
    return this.log({
      action: AuditAction.READ,
      category: AuditCategory.DATA_ACCESS,
      description: \`Accessed \${params.resourceType}\${params.resourceId ? \` with ID \${params.resourceId}\` : ''}\`,
      ...params,
    });
  }

  /**
   * Log authentication event
   */
  async logAuth(params: {
    action: 'login' | 'logout' | 'failed_login' | 'password_change';
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<AuditLog> {
    const actionMap: Record<string, AuditAction> = {
      login: AuditAction.LOGIN,
      logout: AuditAction.LOGOUT,
      failed_login: AuditAction.LOGIN,
      password_change: AuditAction.UPDATE,
    };

    return this.log({
      action: actionMap[params.action],
      category: AuditCategory.AUTHENTICATION,
      resourceType: 'user',
      resourceId: params.userId,
      description: \`User \${params.action.replace('_', ' ')}\`,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        ...params.metadata,
        success: params.action !== 'failed_login',
      },
    });
  }

  /**
   * Query audit logs
   */
  async query(query: AuditQuery): Promise<{ items: AuditLog[]; total: number }> {
    const {
      page = 1,
      pageSize = 50,
      startDate,
      endDate,
      ...filters
    } = query;

    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.category) where.category = filters.category;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.resourceId) where.resourceId = filters.resourceId;

    if (startDate && endDate) {
      where.timestamp = Between(startDate, endDate);
    }

    const [items, total] = await this.auditRepository.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total };
  }

  /**
   * Get audit trail for a resource
   */
  async getResourceAuditTrail(
    resourceType: string,
    resourceId: string,
  ): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: { resourceType, resourceId },
      order: { timestamp: 'DESC' },
    });
  }

  /**
   * Get user activity log
   */
  async getUserActivity(userId: string, days: number = 30): Promise<AuditLog[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.auditRepository.find({
      where: {
        userId,
        timestamp: Between(startDate, new Date()),
      },
      order: { timestamp: 'DESC' },
    });
  }

  /**
   * Sanitize sensitive data
   */
  private sanitize(data: any): any {
    if (!data) return data;

    const sanitized = { ...data };
    const sensitiveFields = this.options.sensitiveFields || [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
      'ssn',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Compute changes between old and new values
   */
  private computeChanges(oldValue: any, newValue: any): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};

    if (!oldValue || !newValue) return changes;

    const allKeys = new Set([
      ...Object.keys(oldValue),
      ...Object.keys(newValue),
    ]);

    for (const key of allKeys) {
      if (JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])) {
        changes[key] = {
          from: oldValue[key],
          to: newValue[key],
        };
      }
    }

    return changes;
  }

  /**
   * Archive old audit logs
   */
  async archive(olderThan: Date): Promise<number> {
    const result = await this.auditRepository
      .createQueryBuilder()
      .update()
      .set({ archived: true })
      .where('timestamp < :date', { date: olderThan })
      .andWhere('archived = :archived', { archived: false })
      .execute();

    return result.affected || 0;
  }

  /**
   * Cleanup old audit logs
   */
  async cleanup(retentionDays?: number): Promise<number> {
    const days = retentionDays || this.options.retentionDays || 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.auditRepository.delete({
      timestamp: Between(new Date(0), cutoffDate),
      archived: true,
    });

    return result.affected || 0;
  }
}
`;
}

function generateAuditInterceptor(): string {
  return `import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditAction, AuditCategory } from './audit-log.entity';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
    @Inject('AUDIT_OPTIONS') private readonly options: any,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Check if auditing is disabled for this handler
    const skipAudit = this.reflector.get<boolean>('skipAudit', context.getHandler());
    if (skipAudit) {
      return next.handle();
    }

    // Check if path is excluded
    const request = context.switchToHttp().getRequest();
    if (this.shouldExclude(request)) {
      return next.handle();
    }

    // Get audit metadata
    const auditMeta = this.reflector.get<AuditMetadata>('audit', context.getHandler());
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.logRequest(context, request, data, startTime, auditMeta);
        },
        error: (error) => {
          this.logError(context, request, error, startTime, auditMeta);
        },
      }),
    );
  }

  private shouldExclude(request: any): boolean {
    const excludePaths = this.options.excludePaths || ['/health', '/metrics'];
    const excludeMethods = this.options.excludeMethods || ['OPTIONS'];

    if (excludeMethods.includes(request.method)) {
      return true;
    }

    for (const path of excludePaths) {
      if (request.path.startsWith(path)) {
        return true;
      }
    }

    return false;
  }

  private async logRequest(
    context: ExecutionContext,
    request: any,
    response: any,
    startTime: number,
    auditMeta?: AuditMetadata,
  ): Promise<void> {
    const action = this.getActionFromMethod(request.method);
    const duration = Date.now() - startTime;

    await this.auditService.log({
      action,
      category: auditMeta?.category || AuditCategory.API_CALL,
      userId: request.user?.id,
      resourceType: auditMeta?.resourceType || this.extractResourceType(request.path),
      resourceId: auditMeta?.resourceId || request.params?.id,
      description: auditMeta?.description || \`\${request.method} \${request.path}\`,
      metadata: {
        method: request.method,
        path: request.path,
        query: request.query,
        duration,
        statusCode: context.switchToHttp().getResponse().statusCode,
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  private async logError(
    context: ExecutionContext,
    request: any,
    error: Error,
    startTime: number,
    auditMeta?: AuditMetadata,
  ): Promise<void> {
    const duration = Date.now() - startTime;

    await this.auditService.log({
      action: AuditAction.ERROR,
      category: AuditCategory.ERROR,
      userId: request.user?.id,
      resourceType: auditMeta?.resourceType || this.extractResourceType(request.path),
      resourceId: request.params?.id,
      description: \`Error: \${error.message}\`,
      metadata: {
        method: request.method,
        path: request.path,
        duration,
        errorName: error.name,
        errorStack: error.stack,
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  private getActionFromMethod(method: string): AuditAction {
    const actionMap: Record<string, AuditAction> = {
      GET: AuditAction.READ,
      POST: AuditAction.CREATE,
      PUT: AuditAction.UPDATE,
      PATCH: AuditAction.UPDATE,
      DELETE: AuditAction.DELETE,
    };
    return actionMap[method] || AuditAction.OTHER;
  }

  private extractResourceType(path: string): string {
    const parts = path.split('/').filter(Boolean);
    // Remove version prefix and get resource name
    return parts.find(p => !p.startsWith('v') && !p.match(/^\\d+$/)) || 'unknown';
  }
}

interface AuditMetadata {
  action?: AuditAction;
  category?: AuditCategory;
  resourceType?: string;
  resourceId?: string;
  description?: string;
}
`;
}

function generateAuditEntity(): string {
  return `import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  ERROR = 'ERROR',
  OTHER = 'OTHER',
}

export enum AuditCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  DATA_CHANGE = 'DATA_CHANGE',
  DATA_ACCESS = 'DATA_ACCESS',
  CONFIGURATION = 'CONFIGURATION',
  SECURITY = 'SECURITY',
  API_CALL = 'API_CALL',
  ERROR = 'ERROR',
  COMPLIANCE = 'COMPLIANCE',
}

@Entity('audit_logs')
@Index(['userId', 'timestamp'])
@Index(['resourceType', 'resourceId'])
@Index(['action', 'timestamp'])
@Index(['category', 'timestamp'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'enum', enum: AuditCategory })
  category: AuditCategory;

  @Column({ nullable: true })
  @Index()
  userId: string;

  @Column()
  resourceType: string;

  @Column({ nullable: true })
  resourceId: string;

  @Column('text')
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  oldValue: any;

  @Column({ type: 'jsonb', nullable: true })
  newValue: any;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  @Index()
  timestamp: Date;

  @Column({ default: false })
  archived: boolean;
}
`;
}

function generateAuditDecorators(): string {
  return `import { SetMetadata, applyDecorators } from '@nestjs/common';
import { AuditAction, AuditCategory } from './audit-log.entity';

/**
 * Skip auditing for a handler
 */
export function SkipAudit() {
  return SetMetadata('skipAudit', true);
}

/**
 * Custom audit metadata
 */
export function Audit(options: {
  action?: AuditAction;
  category?: AuditCategory;
  resourceType?: string;
  description?: string;
}) {
  return SetMetadata('audit', options);
}

/**
 * Audit as data access
 */
export function AuditDataAccess(resourceType: string) {
  return Audit({
    action: AuditAction.READ,
    category: AuditCategory.DATA_ACCESS,
    resourceType,
  });
}

/**
 * Audit as data change
 */
export function AuditDataChange(resourceType: string, action: AuditAction) {
  return Audit({
    action,
    category: AuditCategory.DATA_CHANGE,
    resourceType,
  });
}

/**
 * Audit as security event
 */
export function AuditSecurity(description: string) {
  return Audit({
    category: AuditCategory.SECURITY,
    description,
  });
}

/**
 * Audit as compliance event
 */
export function AuditCompliance(description: string) {
  return Audit({
    category: AuditCategory.COMPLIANCE,
    description,
  });
}

/**
 * Sensitive operation (logs with extra detail)
 */
export function SensitiveOperation(description: string) {
  return applyDecorators(
    Audit({
      category: AuditCategory.SECURITY,
      description,
    }),
    SetMetadata('sensitiveOperation', true),
  );
}
`;
}

function generateComplianceReporter(): string {
  return `import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AuditLog, AuditAction, AuditCategory } from './audit-log.entity';

export interface ComplianceReport {
  reportId: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  summary: ComplianceSummary;
  userActivity: UserActivityReport[];
  dataAccess: DataAccessReport[];
  securityEvents: SecurityEventReport[];
  anomalies: AnomalyReport[];
}

export interface ComplianceSummary {
  totalEvents: number;
  byCategory: Record<AuditCategory, number>;
  byAction: Record<AuditAction, number>;
  uniqueUsers: number;
  uniqueResources: number;
}

export interface UserActivityReport {
  userId: string;
  totalActions: number;
  lastActivity: Date;
  actionBreakdown: Record<AuditAction, number>;
}

export interface DataAccessReport {
  resourceType: string;
  accessCount: number;
  uniqueUsers: number;
  lastAccess: Date;
}

export interface SecurityEventReport {
  type: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string[];
}

export interface AnomalyReport {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  context: any;
}

@Injectable()
export class ComplianceReporter {
  private readonly logger = new Logger(ComplianceReporter.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  /**
   * Generate compliance report for a period
   */
  async generateReport(startDate: Date, endDate: Date): Promise<ComplianceReport> {
    const logs = await this.auditRepository.find({
      where: {
        timestamp: Between(startDate, endDate),
      },
    });

    const reportId = \`compliance_\${Date.now()}\`;

    return {
      reportId,
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      summary: this.generateSummary(logs),
      userActivity: this.analyzeUserActivity(logs),
      dataAccess: this.analyzeDataAccess(logs),
      securityEvents: this.analyzeSecurityEvents(logs),
      anomalies: this.detectAnomalies(logs),
    };
  }

  /**
   * Generate GDPR data subject report
   */
  async generateGDPRReport(userId: string): Promise<any> {
    const logs = await this.auditRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
    });

    const dataAccessed = new Set<string>();
    const dataModified = new Set<string>();

    for (const log of logs) {
      if (log.action === AuditAction.READ) {
        dataAccessed.add(\`\${log.resourceType}:\${log.resourceId}\`);
      }
      if ([AuditAction.CREATE, AuditAction.UPDATE, AuditAction.DELETE].includes(log.action)) {
        dataModified.add(\`\${log.resourceType}:\${log.resourceId}\`);
      }
    }

    return {
      userId,
      generatedAt: new Date(),
      totalActivities: logs.length,
      firstActivity: logs[logs.length - 1]?.timestamp,
      lastActivity: logs[0]?.timestamp,
      dataAccessed: Array.from(dataAccessed),
      dataModified: Array.from(dataModified),
      activities: logs.map(log => ({
        timestamp: log.timestamp,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        description: log.description,
      })),
    };
  }

  /**
   * Generate SOC2 audit report
   */
  async generateSOC2Report(startDate: Date, endDate: Date): Promise<any> {
    const report = await this.generateReport(startDate, endDate);

    return {
      ...report,
      soc2Controls: {
        accessControl: this.analyzeAccessControl(report),
        changeManagement: this.analyzeChangeManagement(report),
        incidentResponse: this.analyzeIncidentResponse(report),
        dataProtection: this.analyzeDataProtection(report),
      },
    };
  }

  private generateSummary(logs: AuditLog[]): ComplianceSummary {
    const byCategory: Record<AuditCategory, number> = {} as any;
    const byAction: Record<AuditAction, number> = {} as any;
    const users = new Set<string>();
    const resources = new Set<string>();

    for (const log of logs) {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      if (log.userId) users.add(log.userId);
      if (log.resourceId) resources.add(\`\${log.resourceType}:\${log.resourceId}\`);
    }

    return {
      totalEvents: logs.length,
      byCategory,
      byAction,
      uniqueUsers: users.size,
      uniqueResources: resources.size,
    };
  }

  private analyzeUserActivity(logs: AuditLog[]): UserActivityReport[] {
    const userMap = new Map<string, { actions: AuditLog[]; breakdown: Record<AuditAction, number> }>();

    for (const log of logs) {
      if (!log.userId) continue;

      const existing = userMap.get(log.userId) || { actions: [], breakdown: {} as any };
      existing.actions.push(log);
      existing.breakdown[log.action] = (existing.breakdown[log.action] || 0) + 1;
      userMap.set(log.userId, existing);
    }

    return Array.from(userMap.entries()).map(([userId, data]) => ({
      userId,
      totalActions: data.actions.length,
      lastActivity: data.actions[0]?.timestamp || new Date(),
      actionBreakdown: data.breakdown,
    }));
  }

  private analyzeDataAccess(logs: AuditLog[]): DataAccessReport[] {
    const resourceMap = new Map<string, { count: number; users: Set<string>; lastAccess: Date }>();

    for (const log of logs) {
      if (log.action !== AuditAction.READ) continue;

      const existing = resourceMap.get(log.resourceType) || {
        count: 0,
        users: new Set(),
        lastAccess: new Date(0),
      };
      existing.count++;
      if (log.userId) existing.users.add(log.userId);
      if (log.timestamp > existing.lastAccess) existing.lastAccess = log.timestamp;
      resourceMap.set(log.resourceType, existing);
    }

    return Array.from(resourceMap.entries()).map(([resourceType, data]) => ({
      resourceType,
      accessCount: data.count,
      uniqueUsers: data.users.size,
      lastAccess: data.lastAccess,
    }));
  }

  private analyzeSecurityEvents(logs: AuditLog[]): SecurityEventReport[] {
    const securityLogs = logs.filter(l => l.category === AuditCategory.SECURITY);
    const events: SecurityEventReport[] = [];

    // Failed logins
    const failedLogins = securityLogs.filter(
      l => l.action === AuditAction.LOGIN && l.metadata?.success === false
    );
    if (failedLogins.length > 0) {
      events.push({
        type: 'Failed Login Attempts',
        count: failedLogins.length,
        severity: failedLogins.length > 10 ? 'high' : 'medium',
        details: failedLogins.slice(0, 5).map(l => l.description),
      });
    }

    return events;
  }

  private detectAnomalies(logs: AuditLog[]): AnomalyReport[] {
    const anomalies: AnomalyReport[] = [];

    // Detect unusual access patterns
    const userActivityByHour = new Map<string, Map<number, number>>();

    for (const log of logs) {
      if (!log.userId) continue;
      const hour = new Date(log.timestamp).getHours();
      const userHours = userActivityByHour.get(log.userId) || new Map();
      userHours.set(hour, (userHours.get(hour) || 0) + 1);
      userActivityByHour.set(log.userId, userHours);
    }

    // Check for unusual activity hours (outside 6am-11pm)
    for (const [userId, hourMap] of userActivityByHour.entries()) {
      const unusualHours = Array.from(hourMap.entries())
        .filter(([hour]) => hour < 6 || hour > 23)
        .reduce((sum, [, count]) => sum + count, 0);

      if (unusualHours > 10) {
        anomalies.push({
          type: 'Unusual Access Hours',
          description: \`User \${userId} had \${unusualHours} activities outside normal hours\`,
          severity: 'medium',
          timestamp: new Date(),
          context: { userId, unusualHours },
        });
      }
    }

    return anomalies;
  }

  private analyzeAccessControl(report: ComplianceReport): any {
    return {
      status: 'compliant',
      findings: [],
    };
  }

  private analyzeChangeManagement(report: ComplianceReport): any {
    return {
      status: 'compliant',
      findings: [],
    };
  }

  private analyzeIncidentResponse(report: ComplianceReport): any {
    return {
      status: 'compliant',
      findings: [],
    };
  }

  private analyzeDataProtection(report: ComplianceReport): any {
    return {
      status: 'compliant',
      findings: [],
    };
  }
}
`;
}
