/**
 * Comprehensive Security Patterns Generator
 * RBAC, encryption, OWASP protections, secret management
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface SecurityPatternsOptions {
  path?: string;
  includeRbac?: boolean;
  includeEncryption?: boolean;
  includeOwasp?: boolean;
}

export async function setupSecurityPatterns(
  basePath: string,
  options: SecurityPatternsOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n🔐 Setting up Security Patterns\n'));

  const sharedPath = path.join(basePath, 'src/shared/security');

  if (!fs.existsSync(sharedPath)) {
    fs.mkdirSync(sharedPath, { recursive: true });
  }

  fs.writeFileSync(path.join(sharedPath, 'encryption.service.ts'), generateEncryptionService());
  console.log(chalk.green(`  ✓ Created encryption service`));

  fs.writeFileSync(path.join(sharedPath, 'rbac.service.ts'), generateRbacService());
  console.log(chalk.green(`  ✓ Created RBAC service`));

  fs.writeFileSync(path.join(sharedPath, 'rbac.decorator.ts'), generateRbacDecorator());
  console.log(chalk.green(`  ✓ Created RBAC decorator`));

  fs.writeFileSync(path.join(sharedPath, 'owasp.middleware.ts'), generateOwaspMiddleware());
  console.log(chalk.green(`  ✓ Created OWASP middleware`));

  fs.writeFileSync(path.join(sharedPath, 'secret-vault.service.ts'), generateSecretVault());
  console.log(chalk.green(`  ✓ Created secret vault`));

  fs.writeFileSync(path.join(sharedPath, 'input-sanitizer.ts'), generateInputSanitizer());
  console.log(chalk.green(`  ✓ Created input sanitizer`));

  fs.writeFileSync(path.join(sharedPath, 'security.module.ts'), generateSecurityModule());
  console.log(chalk.green(`  ✓ Created security module`));

  console.log(chalk.bold.green('\n✅ Security patterns ready!\n'));
}

function generateEncryptionService(): string {
  return `/**
 * Encryption Service
 * AES-256 encryption for data at rest
 */

import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface EncryptionOptions {
  algorithm?: string;
  keyLength?: number;
  ivLength?: number;
}

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly saltLength = 32;

  /**
   * Encrypt data with AES-256-GCM
   */
  encrypt(plaintext: string, key: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const salt = crypto.randomBytes(this.saltLength);
    const derivedKey = this.deriveKey(key, salt);

    const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Format: salt:iv:tag:encrypted
    return [
      salt.toString('hex'),
      iv.toString('hex'),
      tag.toString('hex'),
      encrypted,
    ].join(':');
  }

  /**
   * Decrypt data
   */
  decrypt(ciphertext: string, key: string): string {
    const [saltHex, ivHex, tagHex, encrypted] = ciphertext.split(':');

    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const derivedKey = this.deriveKey(key, salt);

    const decipher = crypto.createDecipheriv(this.algorithm, derivedKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash password with Argon2-like PBKDF2
   */
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(this.saltLength);
    const iterations = 100000;

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, key) => {
        if (err) reject(err);
        resolve(\`\${salt.toString('hex')}:\${iterations}:\${key.toString('hex')}\`);
      });
    });
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const [saltHex, iterationsStr, keyHex] = hash.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const iterations = parseInt(iterationsStr, 10);
    const storedKey = Buffer.from(keyHex, 'hex');

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(crypto.timingSafeEqual(storedKey, derivedKey));
      });
    });
  }

  /**
   * Generate secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate API key
   */
  generateApiKey(prefix: string = 'sk'): string {
    const key = crypto.randomBytes(24).toString('base64url');
    return \`\${prefix}_\${key}\`;
  }

  /**
   * Hash data (one-way)
   */
  hash(data: string, algorithm: string = 'sha256'): string {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  /**
   * HMAC signature
   */
  hmac(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC
   */
  verifyHmac(data: string, signature: string, secret: string): boolean {
    const expected = this.hmac(data, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 10000, this.keyLength, 'sha256');
  }
}

/**
 * Field-level encryption decorator
 */
export function Encrypted(): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    Reflect.defineMetadata('encrypted', true, target, propertyKey);
  };
}
`;
}

function generateRbacService(): string {
  return `/**
 * RBAC (Role-Based Access Control) Service
 * Manages roles, permissions, and access policies
 */

import { Injectable, Logger } from '@nestjs/common';

export interface Role {
  name: string;
  permissions: string[];
  inherits?: string[];
}

export interface Permission {
  resource: string;
  action: string;
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'in' | 'owns' | 'custom';
  value?: any;
  handler?: (user: any, resource: any) => boolean;
}

export interface AccessContext {
  user: {
    id: string;
    roles: string[];
    attributes?: Record<string, any>;
  };
  resource?: any;
  action: string;
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);
  private readonly roles = new Map<string, Role>();
  private readonly permissions = new Map<string, Permission>();

  /**
   * Define a role
   */
  defineRole(role: Role): void {
    this.roles.set(role.name, role);
  }

  /**
   * Define a permission
   */
  definePermission(name: string, permission: Permission): void {
    this.permissions.set(name, permission);
  }

  /**
   * Check if user has permission
   */
  hasPermission(context: AccessContext): boolean {
    const { user, action, resource } = context;

    // Get all permissions for user's roles
    const userPermissions = this.getUserPermissions(user.roles);

    // Check each permission
    for (const permName of userPermissions) {
      const permission = this.permissions.get(permName);
      if (!permission) continue;

      if (permission.action !== action && permission.action !== '*') continue;

      // Check conditions
      if (permission.conditions && permission.conditions.length > 0) {
        if (this.evaluateConditions(permission.conditions, user, resource)) {
          return true;
        }
      } else {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all permissions for roles (including inherited)
   */
  getUserPermissions(roleNames: string[]): string[] {
    const permissions = new Set<string>();
    const processedRoles = new Set<string>();

    const processRole = (roleName: string) => {
      if (processedRoles.has(roleName)) return;
      processedRoles.add(roleName);

      const role = this.roles.get(roleName);
      if (!role) return;

      role.permissions.forEach(p => permissions.add(p));

      if (role.inherits) {
        role.inherits.forEach(processRole);
      }
    };

    roleNames.forEach(processRole);
    return Array.from(permissions);
  }

  /**
   * Check if user can perform action on resource
   */
  can(user: { id: string; roles: string[] }, action: string, resource?: any): boolean {
    return this.hasPermission({ user, action, resource });
  }

  /**
   * Check if user owns resource
   */
  owns(user: { id: string }, resource: { userId?: string; ownerId?: string }): boolean {
    return resource.userId === user.id || resource.ownerId === user.id;
  }

  private evaluateConditions(
    conditions: PermissionCondition[],
    user: any,
    resource: any,
  ): boolean {
    return conditions.every(condition => {
      switch (condition.operator) {
        case 'equals':
          return resource?.[condition.field] === condition.value;
        case 'in':
          return Array.isArray(condition.value) &&
            condition.value.includes(resource?.[condition.field]);
        case 'owns':
          return this.owns(user, resource);
        case 'custom':
          return condition.handler?.(user, resource) ?? false;
        default:
          return false;
      }
    });
  }

  /**
   * Get role by name
   */
  getRole(name: string): Role | undefined {
    return this.roles.get(name);
  }

  /**
   * List all roles
   */
  listRoles(): Role[] {
    return Array.from(this.roles.values());
  }
}

/**
 * ABAC (Attribute-Based Access Control) Service
 */
@Injectable()
export class AbacService {
  private readonly policies: AbacPolicy[] = [];

  /**
   * Add policy
   */
  addPolicy(policy: AbacPolicy): void {
    this.policies.push(policy);
  }

  /**
   * Evaluate access
   */
  evaluate(context: AbacContext): boolean {
    for (const policy of this.policies) {
      if (policy.effect === 'deny' && this.matchesPolicy(policy, context)) {
        return false;
      }
    }

    for (const policy of this.policies) {
      if (policy.effect === 'allow' && this.matchesPolicy(policy, context)) {
        return true;
      }
    }

    return false; // Default deny
  }

  private matchesPolicy(policy: AbacPolicy, context: AbacContext): boolean {
    // Check subject conditions
    if (policy.subject && !this.matchConditions(policy.subject, context.subject)) {
      return false;
    }

    // Check resource conditions
    if (policy.resource && !this.matchConditions(policy.resource, context.resource)) {
      return false;
    }

    // Check action
    if (policy.action && policy.action !== context.action && policy.action !== '*') {
      return false;
    }

    // Check environment
    if (policy.environment && !this.matchConditions(policy.environment, context.environment)) {
      return false;
    }

    return true;
  }

  private matchConditions(
    conditions: Record<string, any>,
    values: Record<string, any>,
  ): boolean {
    for (const [key, expected] of Object.entries(conditions)) {
      const actual = values[key];
      if (Array.isArray(expected)) {
        if (!expected.includes(actual)) return false;
      } else if (expected !== actual) {
        return false;
      }
    }
    return true;
  }
}

interface AbacPolicy {
  name: string;
  effect: 'allow' | 'deny';
  subject?: Record<string, any>;
  resource?: Record<string, any>;
  action?: string;
  environment?: Record<string, any>;
}

interface AbacContext {
  subject: Record<string, any>;
  resource: Record<string, any>;
  action: string;
  environment?: Record<string, any>;
}
`;
}

function generateRbacDecorator(): string {
  return `/**
 * RBAC Decorators
 * Declarative access control on routes
 */

import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from './rbac.service';

export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';
export const RESOURCE_KEY = 'resource';
export const OWNERSHIP_KEY = 'ownership';

/**
 * Require specific roles
 */
export function Roles(...roles: string[]) {
  return SetMetadata(ROLES_KEY, roles);
}

/**
 * Require specific permissions
 */
export function Permissions(...permissions: string[]) {
  return SetMetadata(PERMISSIONS_KEY, permissions);
}

/**
 * Require resource ownership
 */
export function RequireOwnership(resourceParam: string = 'id') {
  return applyDecorators(
    SetMetadata(OWNERSHIP_KEY, resourceParam),
    UseGuards(OwnershipGuard),
  );
}

/**
 * Public route (no auth required)
 */
export function Public() {
  return SetMetadata('isPublic', true);
}

/**
 * Roles Guard
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.roles) {
      throw new ForbiddenException('No roles assigned');
    }

    const hasRole = requiredRoles.some(role => user.roles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('Insufficient role privileges');
    }

    return true;
  }
}

/**
 * Permissions Guard
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    const userPermissions = this.rbacService.getUserPermissions(user.roles || []);

    const hasAllPermissions = requiredPermissions.every(
      perm => userPermissions.includes(perm) || userPermissions.includes('*'),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

/**
 * Ownership Guard
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resourceParam = this.reflector.get<string>(OWNERSHIP_KEY, context.getHandler());

    if (!resourceParam) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceId = request.params[resourceParam];

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    // This would need to fetch the resource and check ownership
    // For now, we'll just check if the IDs match
    if (resourceId !== user.id) {
      throw new ForbiddenException('You do not own this resource');
    }

    return true;
  }
}
`;
}

function generateOwaspMiddleware(): string {
  return `/**
 * OWASP Security Middleware
 * Protection against common web vulnerabilities
 */

import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class OwaspMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Set security headers
    this.setSecurityHeaders(res);

    // Validate request
    this.validateRequest(req);

    next();
  }

  private setSecurityHeaders(res: Response): void {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'",
    );

    // HSTS
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  }

  private validateRequest(req: Request): void {
    // Check for common attack patterns
    this.checkSqlInjection(req);
    this.checkXss(req);
    this.checkPathTraversal(req);
  }

  private checkSqlInjection(req: Request): void {
    const sqlPatterns = [
      /(\\'|\\")\\s*OR\\s+/i,
      /UNION\\s+SELECT/i,
      /DROP\\s+TABLE/i,
      /INSERT\\s+INTO/i,
      /DELETE\\s+FROM/i,
      /UPDATE\\s+\\w+\\s+SET/i,
      /--/,
      /;\\s*$/,
    ];

    const checkValue = (value: any): void => {
      if (typeof value === 'string') {
        for (const pattern of sqlPatterns) {
          if (pattern.test(value)) {
            throw new BadRequestException('Potential SQL injection detected');
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(checkValue);
      }
    };

    checkValue(req.query);
    checkValue(req.body);
    checkValue(req.params);
  }

  private checkXss(req: Request): void {
    const xssPatterns = [
      /<script\\b[^>]*>/i,
      /javascript:/i,
      /on\\w+\\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    const checkValue = (value: any): void => {
      if (typeof value === 'string') {
        for (const pattern of xssPatterns) {
          if (pattern.test(value)) {
            throw new BadRequestException('Potential XSS attack detected');
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(checkValue);
      }
    };

    checkValue(req.query);
    checkValue(req.body);
  }

  private checkPathTraversal(req: Request): void {
    const pathTraversalPatterns = [
      /\\.\\.\\//, // ../
      /\\.\\.\\\\/, // ..\\
      /%2e%2e%2f/i, // encoded ../
      /%2e%2e\\//i,
      /%2e%2e%5c/i, // encoded ..\\
    ];

    const url = req.url + JSON.stringify(req.params);

    for (const pattern of pathTraversalPatterns) {
      if (pattern.test(url)) {
        throw new BadRequestException('Potential path traversal attack detected');
      }
    }
  }
}

/**
 * CSRF Protection
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly tokenStore = new Map<string, string>();

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const token = req.headers['x-csrf-token'] as string;
    const sessionId = req.session?.id || req.headers['x-session-id'] as string;

    if (!token || !sessionId) {
      throw new BadRequestException('CSRF token missing');
    }

    const storedToken = this.tokenStore.get(sessionId);
    if (token !== storedToken) {
      throw new BadRequestException('Invalid CSRF token');
    }

    next();
  }

  generateToken(sessionId: string): string {
    const token = require('crypto').randomBytes(32).toString('hex');
    this.tokenStore.set(sessionId, token);
    return token;
  }
}

/**
 * Request size limiter
 */
export function createSizeLimiter(maxSize: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxSize) {
      throw new BadRequestException(\`Request too large. Max size: \${maxSize} bytes\`);
    }
    next();
  };
}
`;
}

function generateSecretVault(): string {
  return `/**
 * Secret Vault Service
 * Secure secret management
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';

export interface Secret {
  key: string;
  value: string;
  version: number;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class SecretVaultService implements OnModuleInit {
  private readonly logger = new Logger(SecretVaultService.name);
  private readonly secrets = new Map<string, Secret[]>();
  private masterKey: Buffer | null = null;

  async onModuleInit() {
    // Initialize master key from environment
    const masterKeyHex = process.env.VAULT_MASTER_KEY;
    if (masterKeyHex) {
      this.masterKey = Buffer.from(masterKeyHex, 'hex');
      this.logger.log('Secret vault initialized with master key');
    } else {
      this.logger.warn('No master key configured, secrets will be stored in plaintext');
    }
  }

  /**
   * Store a secret
   */
  async setSecret(key: string, value: string, options?: { expiresIn?: number; metadata?: Record<string, any> }): Promise<Secret> {
    const versions = this.secrets.get(key) || [];
    const version = versions.length + 1;

    const encryptedValue = this.masterKey ? this.encrypt(value) : value;

    const secret: Secret = {
      key,
      value: encryptedValue,
      version,
      createdAt: new Date(),
      expiresAt: options?.expiresIn ? new Date(Date.now() + options.expiresIn) : undefined,
      metadata: options?.metadata,
    };

    versions.push(secret);
    this.secrets.set(key, versions);

    this.logger.log(\`Secret '\${key}' stored (version \${version})\`);
    return { ...secret, value: '[REDACTED]' };
  }

  /**
   * Get a secret
   */
  async getSecret(key: string, version?: number): Promise<string | null> {
    const versions = this.secrets.get(key);
    if (!versions || versions.length === 0) {
      return null;
    }

    const secret = version
      ? versions.find(s => s.version === version)
      : versions[versions.length - 1];

    if (!secret) {
      return null;
    }

    if (secret.expiresAt && new Date() > secret.expiresAt) {
      this.logger.warn(\`Secret '\${key}' has expired\`);
      return null;
    }

    return this.masterKey ? this.decrypt(secret.value) : secret.value;
  }

  /**
   * Delete a secret
   */
  async deleteSecret(key: string): Promise<boolean> {
    const deleted = this.secrets.delete(key);
    if (deleted) {
      this.logger.log(\`Secret '\${key}' deleted\`);
    }
    return deleted;
  }

  /**
   * Rotate a secret
   */
  async rotateSecret(key: string, newValue: string): Promise<Secret> {
    return this.setSecret(key, newValue);
  }

  /**
   * List secret keys
   */
  listKeys(): string[] {
    return Array.from(this.secrets.keys());
  }

  /**
   * Get secret metadata
   */
  getSecretInfo(key: string): Omit<Secret, 'value'> | null {
    const versions = this.secrets.get(key);
    if (!versions || versions.length === 0) {
      return null;
    }

    const latest = versions[versions.length - 1];
    return {
      key: latest.key,
      version: latest.version,
      createdAt: latest.createdAt,
      expiresAt: latest.expiresAt,
      metadata: latest.metadata,
    };
  }

  private encrypt(plaintext: string): string {
    if (!this.masterKey) return plaintext;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return \`\${iv.toString('hex')}:\${tag.toString('hex')}:\${encrypted}\`;
  }

  private decrypt(ciphertext: string): string {
    if (!this.masterKey) return ciphertext;

    const [ivHex, tagHex, encrypted] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

/**
 * Environment secret loader
 */
export function loadSecrets(vault: SecretVaultService): Record<string, string> {
  const secrets: Record<string, string> = {};

  for (const key of vault.listKeys()) {
    // Sync version - for initialization only
    const value = (vault as any).secrets.get(key)?.[0]?.value;
    if (value) {
      secrets[key] = value;
    }
  }

  return secrets;
}
`;
}

function generateInputSanitizer(): string {
  return `/**
 * Input Sanitizer
 * Clean and validate user input
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class InputSanitizer {
  /**
   * Sanitize string for HTML output
   */
  sanitizeHtml(input: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };
    return input.replace(/[&<>"'/]/g, char => map[char]);
  }

  /**
   * Sanitize for SQL (prefer parameterized queries)
   */
  sanitizeSql(input: string): string {
    return input.replace(/['";\\\\]/g, '');
  }

  /**
   * Sanitize for shell commands
   */
  sanitizeShell(input: string): string {
    return input.replace(/[;&|$\`\\\\(){}\\[\\]<>\\n\\r]/g, '');
  }

  /**
   * Sanitize filename
   */
  sanitizeFilename(input: string): string {
    return input
      .replace(/[/\\\\?%*:|"<>]/g, '-')
      .replace(/\\.\\./g, '-')
      .substring(0, 255);
  }

  /**
   * Sanitize URL
   */
  sanitizeUrl(input: string): string {
    try {
      const url = new URL(input);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid protocol');
      }
      return url.toString();
    } catch {
      return '';
    }
  }

  /**
   * Strip all HTML tags
   */
  stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '');
  }

  /**
   * Normalize whitespace
   */
  normalizeWhitespace(input: string): string {
    return input.replace(/\\s+/g, ' ').trim();
  }

  /**
   * Sanitize JSON
   */
  sanitizeJson(input: any): any {
    if (typeof input === 'string') {
      return this.sanitizeHtml(input);
    }
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeJson(item));
    }
    if (typeof input === 'object' && input !== null) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(input)) {
        result[this.sanitizeHtml(key)] = this.sanitizeJson(value);
      }
      return result;
    }
    return input;
  }

  /**
   * Validate and sanitize email
   */
  sanitizeEmail(input: string): string | null {
    const email = input.toLowerCase().trim();
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(email) ? email : null;
  }

  /**
   * Sanitize phone number
   */
  sanitizePhone(input: string): string {
    return input.replace(/[^0-9+]/g, '');
  }
}

/**
 * Sanitize decorator
 */
export function Sanitize(type: 'html' | 'sql' | 'filename' | 'url'): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    Reflect.defineMetadata('sanitize', type, target, propertyKey);
  };
}
`;
}

function generateSecurityModule(): string {
  return `import { Module, Global, DynamicModule, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EncryptionService } from './encryption.service';
import { RbacService, AbacService } from './rbac.service';
import { RolesGuard, PermissionsGuard } from './rbac.decorator';
import { OwaspMiddleware, CsrfMiddleware } from './owasp.middleware';
import { SecretVaultService } from './secret-vault.service';
import { InputSanitizer } from './input-sanitizer';

export interface SecurityModuleOptions {
  enableRbac?: boolean;
  enableOwasp?: boolean;
  enableCsrf?: boolean;
}

@Global()
@Module({})
export class SecurityModule implements NestModule {
  static options: SecurityModuleOptions = {};

  static forRoot(options: SecurityModuleOptions = {}): DynamicModule {
    this.options = options;

    const providers: any[] = [
      EncryptionService,
      RbacService,
      AbacService,
      SecretVaultService,
      InputSanitizer,
      CsrfMiddleware,
    ];

    if (options.enableRbac !== false) {
      providers.push(
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      );
    }

    return {
      module: SecurityModule,
      providers,
      exports: [
        EncryptionService,
        RbacService,
        AbacService,
        SecretVaultService,
        InputSanitizer,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    if (SecurityModule.options.enableOwasp !== false) {
      consumer.apply(OwaspMiddleware).forRoutes('*');
    }
    if (SecurityModule.options.enableCsrf) {
      consumer.apply(CsrfMiddleware).forRoutes('*');
    }
  }
}
`;
}
