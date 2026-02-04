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

  fs.writeFileSync(path.join(sharedPath, 'cors.config.ts'), generateCorsConfig());
  console.log(chalk.green(`  ✓ Created CORS configuration`));

  fs.writeFileSync(path.join(sharedPath, 'cookie.config.ts'), generateCookieConfig());
  console.log(chalk.green(`  ✓ Created cookie security configuration`));

  fs.writeFileSync(path.join(sharedPath, 'jwt.security.ts'), generateJwtSecurity());
  console.log(chalk.green(`  ✓ Created JWT security service`));

  fs.writeFileSync(path.join(sharedPath, 'security-headers.config.ts'), generateSecurityHeadersConfig());
  console.log(chalk.green(`  ✓ Created security headers configuration`));

  console.log(chalk.bold.green('\n✅ Security patterns ready!\n'));
}

function generateEncryptionService(): string {
  return `/**
 * Encryption Service
 * AES-256-GCM authenticated encryption for data at rest
 * OWASP A02:2021 compliant
 */

import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface EncryptionOptions {
  algorithm?: string;
  keyLength?: number;
  ivLength?: number;
}

// Minimum password/key requirements
const MIN_KEY_LENGTH = 16;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PLAINTEXT_LENGTH = 10 * 1024 * 1024; // 10MB max

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly saltLength = 32;

  // PBKDF2 iterations - OWASP recommends at least 600,000 for SHA-256
  private readonly pbkdf2Iterations = 600000;
  private readonly passwordHashIterations = 310000;

  /**
   * Encrypt data with AES-256-GCM
   * @throws Error if key is too short or plaintext too long
   */
  encrypt(plaintext: string, key: string): string {
    // Input validation
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Plaintext must be a non-empty string');
    }
    if (!key || typeof key !== 'string' || key.length < MIN_KEY_LENGTH) {
      throw new Error(\`Encryption key must be at least \${MIN_KEY_LENGTH} characters\`);
    }
    if (plaintext.length > MAX_PLAINTEXT_LENGTH) {
      throw new Error(\`Plaintext exceeds maximum length of \${MAX_PLAINTEXT_LENGTH} bytes\`);
    }

    const iv = crypto.randomBytes(this.ivLength);
    const salt = crypto.randomBytes(this.saltLength);
    const derivedKey = this.deriveKey(key, salt);

    const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Format: version:salt:iv:tag:encrypted (version for future algorithm changes)
    return [
      'v1',
      salt.toString('hex'),
      iv.toString('hex'),
      tag.toString('hex'),
      encrypted,
    ].join(':');
  }

  /**
   * Decrypt data
   * @throws Error if decryption fails (tampered or wrong key)
   */
  decrypt(ciphertext: string, key: string): string {
    if (!ciphertext || typeof ciphertext !== 'string') {
      throw new Error('Ciphertext must be a non-empty string');
    }
    if (!key || typeof key !== 'string' || key.length < MIN_KEY_LENGTH) {
      throw new Error(\`Decryption key must be at least \${MIN_KEY_LENGTH} characters\`);
    }

    const parts = ciphertext.split(':');

    // Support versioned format
    let saltHex: string, ivHex: string, tagHex: string, encrypted: string;

    if (parts[0] === 'v1' && parts.length === 5) {
      [, saltHex, ivHex, tagHex, encrypted] = parts;
    } else if (parts.length === 4) {
      // Legacy format without version
      [saltHex, ivHex, tagHex, encrypted] = parts;
    } else {
      throw new Error('Invalid ciphertext format');
    }

    try {
      const salt = Buffer.from(saltHex, 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const derivedKey = this.deriveKey(key, salt);

      const decipher = crypto.createDecipheriv(this.algorithm, derivedKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // Don't reveal specific error details
      this.logger.warn('Decryption failed - possibly tampered data or wrong key');
      throw new Error('Decryption failed');
    }
  }

  /**
   * Hash password using PBKDF2 with high iteration count
   * OWASP recommendation: 310,000 iterations for PBKDF2-HMAC-SHA256
   */
  async hashPassword(password: string): Promise<string> {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(\`Password must be at least \${MIN_PASSWORD_LENGTH} characters\`);
    }

    const salt = crypto.randomBytes(this.saltLength);
    const iterations = this.passwordHashIterations;

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, key) => {
        if (err) reject(err);
        // Include algorithm info for future migration
        resolve(\`pbkdf2:sha512:\${iterations}:\${salt.toString('hex')}:\${key.toString('hex')}\`);
      });
    });
  }

  /**
   * Verify password with timing-safe comparison
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      return false;
    }

    try {
      const parts = hash.split(':');
      let saltHex: string, keyHex: string, iterations: number;

      // Support new format with algorithm prefix
      if (parts[0] === 'pbkdf2' && parts.length === 5) {
        [, , iterations, saltHex, keyHex] = [parts[0], parts[1], parseInt(parts[2], 10), parts[3], parts[4]] as [string, string, number, string, string];
      } else if (parts.length === 3) {
        // Legacy format
        [saltHex, iterations, keyHex] = [parts[0], parseInt(parts[1], 10), parts[2]] as [string, number, string];
      } else {
        return false;
      }

      const salt = Buffer.from(saltHex, 'hex');
      const storedKey = Buffer.from(keyHex, 'hex');

      return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, derivedKey) => {
          if (err) {
            reject(err);
            return;
          }
          // Timing-safe comparison prevents timing attacks
          try {
            resolve(crypto.timingSafeEqual(storedKey, derivedKey));
          } catch {
            resolve(false);
          }
        });
      });
    } catch {
      return false;
    }
  }

  /**
   * Generate cryptographically secure random token
   */
  generateToken(length: number = 32): string {
    if (length < 16) {
      throw new Error('Token length must be at least 16 bytes');
    }
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate API key with checksum
   */
  generateApiKey(prefix: string = 'sk'): string {
    const sanitizedPrefix = prefix.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    const key = crypto.randomBytes(24).toString('base64url');
    const checksum = this.hash(key).substring(0, 4);
    return \`\${sanitizedPrefix}_\${key}_\${checksum}\`;
  }

  /**
   * Verify API key checksum
   */
  verifyApiKeyChecksum(apiKey: string): boolean {
    const parts = apiKey.split('_');
    if (parts.length !== 3) return false;

    const [, key, checksum] = parts;
    const expectedChecksum = this.hash(key).substring(0, 4);

    return crypto.timingSafeEqual(
      Buffer.from(checksum),
      Buffer.from(expectedChecksum)
    );
  }

  /**
   * Hash data (one-way) - defaults to SHA-256
   */
  hash(data: string, algorithm: string = 'sha256'): string {
    const allowedAlgorithms = ['sha256', 'sha384', 'sha512', 'sha3-256', 'sha3-512'];
    if (!allowedAlgorithms.includes(algorithm)) {
      throw new Error(\`Algorithm must be one of: \${allowedAlgorithms.join(', ')}\`);
    }
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  /**
   * HMAC signature using SHA-256
   */
  hmac(data: string, secret: string): string {
    if (!secret || secret.length < MIN_KEY_LENGTH) {
      throw new Error(\`HMAC secret must be at least \${MIN_KEY_LENGTH} characters\`);
    }
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC with timing-safe comparison
   */
  verifyHmac(data: string, signature: string, secret: string): boolean {
    try {
      const expected = this.hmac(data, secret);
      // Ensure both are same length for timing-safe comparison
      if (signature.length !== expected.length) {
        return false;
      }
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  /**
   * Securely compare two strings (timing-safe)
   */
  secureCompare(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, this.pbkdf2Iterations, this.keyLength, 'sha256');
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
      // Script tags and attributes
      /<script\\b[^>]*>/i,
      /<\\/script>/i,
      // JavaScript protocol
      /javascript:/i,
      /vbscript:/i,
      // Event handlers
      /on\\w+\\s*=/i,
      // Dangerous HTML elements
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<svg[^>]*onload/i,
      /<img[^>]*onerror/i,
      /<body[^>]*onload/i,
      // Data URIs with HTML/Script
      /data:\\s*text\\/html/i,
      /data:\\s*application\\/javascript/i,
      // CSS injection
      /expression\\s*\\(/i,
      /-moz-binding/i,
      // HTML5 attack vectors
      /<math/i,
      /<video[^>]*on/i,
      /<audio[^>]*on/i,
      // Template injection
      /\\{\\{.*\\}\\}/,
      /\\$\\{.*\\}/,
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
 * OWASP A03:2021 compliant
 */

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class InputSanitizer {
  private readonly logger = new Logger(InputSanitizer.name);

  /**
   * Sanitize string for HTML output - prevents XSS
   * Includes complete entity encoding for all dangerous characters
   */
  sanitizeHtml(input: string): string {
    if (!input || typeof input !== 'string') return '';

    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '\`': '&#x60;', // Backtick for template literals
      '=': '&#x3D;',  // Equals sign
    };
    return input.replace(/[&<>"'/\`=]/g, char => map[char] || char);
  }

  /**
   * @deprecated NEVER use this for SQL injection prevention!
   * Always use parameterized queries/prepared statements instead.
   * This method only exists for legacy compatibility.
   */
  sanitizeSql(input: string): string {
    this.logger.warn('sanitizeSql is deprecated! Use parameterized queries instead.');
    // This is NOT safe - always use parameterized queries
    return input.replace(/['";\\\\]/g, '');
  }

  /**
   * Sanitize for shell commands using WHITELIST approach
   * Only allows alphanumeric, hyphen, underscore, and dot
   * For complex shell operations, prefer using spawn with args array
   */
  sanitizeShell(input: string): string {
    if (!input || typeof input !== 'string') return '';

    // Strict whitelist - only allow safe characters
    const sanitized = input.replace(/[^a-zA-Z0-9_\\-.]/g, '');

    // Check for path traversal
    if (sanitized.includes('..')) {
      this.logger.warn(\`Shell sanitization blocked path traversal attempt: \${input}\`);
      return sanitized.replace(/\\.\\.+/g, '');
    }

    return sanitized;
  }

  /**
   * Sanitize filename - prevents path traversal and invalid chars
   */
  sanitizeFilename(input: string): string {
    if (!input || typeof input !== 'string') return '';

    return input
      .replace(/\\.\\./g, '')            // Remove path traversal
      .replace(/[/\\\\]/g, '')           // Remove path separators
      .replace(/[?%*:|"<>\\x00-\\x1f]/g, '-') // Remove invalid chars
      .replace(/^[-_.]+|[-_.]+$/g, '')   // Trim leading/trailing special chars
      .substring(0, 255);                // Limit length
  }

  /**
   * Sanitize URL - validates protocol and structure
   */
  sanitizeUrl(input: string): string {
    if (!input || typeof input !== 'string') return '';

    try {
      const url = new URL(input);

      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(url.protocol)) {
        this.logger.warn(\`URL sanitization blocked invalid protocol: \${url.protocol}\`);
        return '';
      }

      // Block javascript: and data: URIs (case-insensitive)
      if (/^(javascript|data|vbscript):/i.test(input)) {
        this.logger.warn(\`URL sanitization blocked dangerous scheme: \${input}\`);
        return '';
      }

      return url.toString();
    } catch {
      return '';
    }
  }

  /**
   * Strip all HTML tags - for plain text extraction
   */
  stripHtml(input: string): string {
    if (!input || typeof input !== 'string') return '';

    // Remove script and style content entirely
    let result = input
      .replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi, '')
      .replace(/<style[^>]*>[\\s\\S]*?<\\/style>/gi, '');

    // Then strip remaining tags
    result = result.replace(/<[^>]*>/g, '');

    // Decode entities
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&nbsp;': ' ',
    };
    for (const [entity, char] of Object.entries(entities)) {
      result = result.replace(new RegExp(entity, 'g'), char);
    }

    return result;
  }

  /**
   * Normalize whitespace
   */
  normalizeWhitespace(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input.replace(/[\\s\\u200B-\\u200D\\uFEFF]+/g, ' ').trim();
  }

  /**
   * Sanitize JSON - prevents XSS in JSON values and prototype pollution
   */
  sanitizeJson(input: any, depth = 0): any {
    // Prevent infinite recursion
    if (depth > 10) {
      this.logger.warn('JSON sanitization max depth exceeded');
      return null;
    }

    if (typeof input === 'string') {
      return this.sanitizeHtml(input);
    }
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeJson(item, depth + 1));
    }
    if (typeof input === 'object' && input !== null) {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(input)) {
        // Block prototype pollution attacks
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          this.logger.warn(\`JSON sanitization blocked prototype pollution key: \${key}\`);
          continue;
        }
        result[this.sanitizeHtml(key)] = this.sanitizeJson(value, depth + 1);
      }
      return result;
    }
    return input;
  }

  /**
   * Validate and sanitize email
   */
  sanitizeEmail(input: string): string | null {
    if (!input || typeof input !== 'string') return null;

    const email = input.toLowerCase().trim();

    // RFC 5321 max length
    if (email.length > 254) return null;

    // Basic email regex (more permissive to allow valid emails)
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(email) ? email : null;
  }

  /**
   * Sanitize phone number
   */
  sanitizePhone(input: string): string {
    if (!input || typeof input !== 'string') return '';
    const sanitized = input.replace(/[^0-9+\\-() ]/g, '');
    // E.164 max length is 15 digits plus '+'
    return sanitized.substring(0, 20);
  }

  /**
   * Validate field name for database queries
   * Prevents SQL injection via dynamic column names
   */
  validateFieldName(fieldName: string, allowedFields: string[]): string {
    if (!fieldName || typeof fieldName !== 'string') {
      throw new Error('Invalid field name');
    }

    // Must be in allowed list
    if (!allowedFields.includes(fieldName)) {
      throw new Error(\`Field "\${fieldName}" not allowed. Allowed: \${allowedFields.join(', ')}\`);
    }

    // Additional safety check - must match safe pattern
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldName)) {
      throw new Error(\`Field name format invalid: \${fieldName}\`);
    }

    return fieldName;
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

function generateCorsConfig(): string {
  return `/**
 * Secure CORS Configuration
 * OWASP A05:2021 - Security Misconfiguration prevention
 */

import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { Logger } from '@nestjs/common';

const logger = new Logger('CorsConfig');

/**
 * Create secure CORS configuration
 * - Strict origin validation (no wildcards in production)
 * - Explicit allowed methods
 * - Credentials handling with origin check
 */
export function createSecureCorsConfig(options: {
  allowedOrigins: string[];
  isProduction?: boolean;
}): CorsOptions {
  const { allowedOrigins, isProduction = process.env.NODE_ENV === 'production' } = options;

  // Validate origins
  if (isProduction && allowedOrigins.includes('*')) {
    throw new Error('CORS: Wildcard origin (*) not allowed in production');
  }

  // Normalize origins to prevent bypass (e.g., trailing slashes)
  const normalizedOrigins = allowedOrigins.map(origin => {
    if (origin === '*') return origin;
    return origin.replace(/\\/+$/, '').toLowerCase();
  });

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or Postman)
      // In production, you may want to be stricter
      if (!origin) {
        if (isProduction) {
          logger.warn('Request with no origin header - consider blocking in production');
        }
        callback(null, true);
        return;
      }

      const normalizedOrigin = origin.replace(/\\/+$/, '').toLowerCase();

      // Check against whitelist
      if (normalizedOrigins.includes('*') || normalizedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      // Check for subdomain matching (if pattern like *.example.com is allowed)
      for (const allowed of normalizedOrigins) {
        if (allowed.startsWith('*.')) {
          const domain = allowed.slice(2);
          if (normalizedOrigin.endsWith(domain)) {
            callback(null, true);
            return;
          }
        }
      }

      logger.warn(\`CORS blocked origin: \${origin}\`);
      callback(new Error('Not allowed by CORS'));
    },

    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // Only expose safe headers
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-CSRF-Token',
    ],

    // Credentials require explicit origin (not *)
    credentials: true,

    // Cache preflight for 24 hours
    maxAge: 86400,

    // Limit exposed headers to prevent information leak
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining'],

    // Don't allow OPTIONS to continue to route handlers
    preflightContinue: false,

    // Return 204 for OPTIONS
    optionsSuccessStatus: 204,
  };
}

/**
 * Validate origin against allowed list
 * Use for manual CORS checks
 */
export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (!origin) return false;

  const normalizedOrigin = origin.replace(/\\/+$/, '').toLowerCase();

  for (const allowed of allowedOrigins) {
    const normalizedAllowed = allowed.replace(/\\/+$/, '').toLowerCase();

    if (normalizedAllowed === '*') return true;
    if (normalizedAllowed === normalizedOrigin) return true;

    // Subdomain matching
    if (normalizedAllowed.startsWith('*.')) {
      const domain = normalizedAllowed.slice(2);
      if (normalizedOrigin.endsWith('.' + domain) || normalizedOrigin === domain) {
        return true;
      }
    }
  }

  return false;
}
`;
}

function generateCookieConfig(): string {
  return `/**
 * Secure Cookie Configuration
 * OWASP A07:2021 - Authentication best practices
 */

import { CookieOptions } from 'express';
import { Logger } from '@nestjs/common';

const logger = new Logger('CookieConfig');

export interface SecureCookieOptions {
  name: string;
  isProduction?: boolean;
  domain?: string;
  maxAgeSeconds?: number;
}

/**
 * Create secure cookie options
 * - HttpOnly to prevent XSS access
 * - Secure flag for HTTPS-only
 * - SameSite to prevent CSRF
 * - Proper path and domain scoping
 */
export function createSecureCookieOptions(options: SecureCookieOptions): CookieOptions {
  const {
    isProduction = process.env.NODE_ENV === 'production',
    domain,
    maxAgeSeconds = 3600, // 1 hour default
  } = options;

  return {
    // Prevent JavaScript access (XSS protection)
    httpOnly: true,

    // Only send over HTTPS in production
    secure: isProduction,

    // Strict SameSite prevents CSRF
    // Use 'lax' if you need cross-site GET requests (e.g., OAuth redirects)
    sameSite: 'strict',

    // Scope to specific path
    path: '/',

    // Domain scoping (omit to use current domain only)
    domain: domain,

    // Set explicit expiry
    maxAge: maxAgeSeconds * 1000, // Express uses milliseconds

    // Signed cookies for integrity (requires cookie-parser with secret)
    signed: true,
  };
}

/**
 * Session cookie configuration
 */
export function createSessionCookieOptions(options: {
  isProduction?: boolean;
  sessionMaxAgeHours?: number;
}): CookieOptions {
  const {
    isProduction = process.env.NODE_ENV === 'production',
    sessionMaxAgeHours = 24,
  } = options;

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: sessionMaxAgeHours * 60 * 60 * 1000,
    signed: true,
  };
}

/**
 * Authentication token cookie options
 * More restrictive for auth tokens
 */
export function createAuthCookieOptions(options: {
  isProduction?: boolean;
  tokenMaxAgeMinutes?: number;
  domain?: string;
}): CookieOptions {
  const {
    isProduction = process.env.NODE_ENV === 'production',
    tokenMaxAgeMinutes = 15, // Short-lived for security
    domain,
  } = options;

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    domain,
    maxAge: tokenMaxAgeMinutes * 60 * 1000,
    signed: true,
  };
}

/**
 * Refresh token cookie options
 * Longer lived but more restricted
 */
export function createRefreshTokenCookieOptions(options: {
  isProduction?: boolean;
  maxAgeDays?: number;
  domain?: string;
}): CookieOptions {
  const {
    isProduction = process.env.NODE_ENV === 'production',
    maxAgeDays = 7,
    domain,
  } = options;

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    // Restrict refresh token to specific path
    path: '/auth/refresh',
    domain,
    maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
    signed: true,
  };
}

/**
 * Clear cookie securely
 */
export function clearCookieOptions(isProduction: boolean = process.env.NODE_ENV === 'production'): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };
}

/**
 * Cookie name constants with prefix for clarity
 */
export const CookieNames = {
  SESSION: '__Host-session',      // __Host- prefix requires Secure and Path=/
  ACCESS_TOKEN: '__Host-access',
  REFRESH_TOKEN: '__Host-refresh',
  CSRF: '__Host-csrf',
} as const;

/**
 * Validate cookie name follows security best practices
 * __Host- prefix ensures Secure, no Domain, Path=/
 * __Secure- prefix ensures Secure
 */
export function validateCookieName(name: string, isProduction: boolean): void {
  if (isProduction) {
    if (name.startsWith('__Host-') || name.startsWith('__Secure-')) {
      return; // Valid secure prefix
    }
    logger.warn(\`Cookie "\${name}" should use __Host- or __Secure- prefix in production\`);
  }
}
`;
}

function generateJwtSecurity(): string {
  return `/**
 * JWT Security Service
 * OWASP A07:2021 - Identification and Authentication Failures prevention
 */

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface JwtHeader {
  alg: string;
  typ: string;
  kid?: string;
}

export interface JwtPayload {
  iss?: string;  // Issuer
  sub?: string;  // Subject
  aud?: string | string[];  // Audience
  exp?: number;  // Expiration
  nbf?: number;  // Not Before
  iat?: number;  // Issued At
  jti?: string;  // JWT ID (for revocation)
  [key: string]: any;
}

export interface JwtValidationOptions {
  issuer?: string;
  audience?: string | string[];
  algorithms?: string[];
  clockTolerance?: number;
  maxAge?: number;
}

// Secure algorithm whitelist - block 'none' and weak algorithms
const ALLOWED_ALGORITHMS = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'];
const WEAK_ALGORITHMS = ['none', 'HS1', 'RS1'];

@Injectable()
export class JwtSecurityService {
  private readonly logger = new Logger(JwtSecurityService.name);
  private readonly revokedTokens = new Set<string>();
  private readonly usedJtis = new Map<string, number>(); // jti -> expiry timestamp

  /**
   * Validate JWT structure and claims
   * Checks for common JWT attacks:
   * - Algorithm confusion (none attack, weak algorithms)
   * - Token replay (jti tracking)
   * - Expired/not-yet-valid tokens
   * - Issuer/audience mismatch
   */
  validateToken(token: string, options: JwtValidationOptions = {}): { header: JwtHeader; payload: JwtPayload } {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Token is required');
    }

    // Split and decode
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid token format');
    }

    let header: JwtHeader;
    let payload: JwtPayload;

    try {
      header = JSON.parse(this.base64UrlDecode(parts[0]));
      payload = JSON.parse(this.base64UrlDecode(parts[1]));
    } catch {
      throw new UnauthorizedException('Invalid token encoding');
    }

    // Validate algorithm
    this.validateAlgorithm(header.alg, options.algorithms);

    // Validate claims
    this.validateClaims(payload, options);

    // Check if token is revoked
    if (payload.jti && this.revokedTokens.has(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Check for replay (same jti used before expiry)
    if (payload.jti) {
      const existingExpiry = this.usedJtis.get(payload.jti);
      if (existingExpiry && Date.now() < existingExpiry) {
        // Potential replay - same jti, not expired
        this.logger.warn(\`Potential JWT replay detected: jti=\${payload.jti}\`);
        // Note: In some cases, legitimate retries may reuse tokens
        // Consider your use case before throwing here
      }
      if (payload.exp) {
        this.usedJtis.set(payload.jti, payload.exp * 1000);
      }
    }

    return { header, payload };
  }

  /**
   * Validate algorithm is allowed
   * Prevents algorithm confusion attacks
   */
  private validateAlgorithm(alg: string, allowedAlgorithms?: string[]): void {
    // Check against weak algorithms
    if (WEAK_ALGORITHMS.includes(alg.toLowerCase())) {
      this.logger.error(\`JWT with weak/dangerous algorithm detected: \${alg}\`);
      throw new UnauthorizedException('Invalid token algorithm');
    }

    // Check against allowed list
    const allowed = allowedAlgorithms?.length ? allowedAlgorithms : ALLOWED_ALGORITHMS;
    if (!allowed.includes(alg)) {
      throw new UnauthorizedException('Token algorithm not allowed');
    }
  }

  /**
   * Validate JWT claims
   */
  private validateClaims(payload: JwtPayload, options: JwtValidationOptions): void {
    const now = Math.floor(Date.now() / 1000);
    const clockTolerance = options.clockTolerance || 30; // 30 seconds tolerance

    // Check expiration
    if (payload.exp !== undefined) {
      if (now > payload.exp + clockTolerance) {
        throw new UnauthorizedException('Token has expired');
      }
    } else {
      // Tokens without expiration are risky
      this.logger.warn('JWT without expiration claim');
      if (options.maxAge) {
        throw new UnauthorizedException('Token missing required exp claim');
      }
    }

    // Check not before
    if (payload.nbf !== undefined) {
      if (now < payload.nbf - clockTolerance) {
        throw new UnauthorizedException('Token not yet valid');
      }
    }

    // Check issued at (with max age)
    if (options.maxAge && payload.iat !== undefined) {
      if (now - payload.iat > options.maxAge) {
        throw new UnauthorizedException('Token exceeds maximum age');
      }
    }

    // Check issuer
    if (options.issuer && payload.iss !== options.issuer) {
      throw new UnauthorizedException('Invalid token issuer');
    }

    // Check audience
    if (options.audience) {
      const expectedAudiences = Array.isArray(options.audience) ? options.audience : [options.audience];
      const tokenAudiences = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];

      const hasValidAudience = expectedAudiences.some(aud => tokenAudiences.includes(aud));
      if (!hasValidAudience) {
        throw new UnauthorizedException('Invalid token audience');
      }
    }
  }

  /**
   * Revoke a token by jti
   */
  revokeToken(jti: string): void {
    this.revokedTokens.add(jti);
    this.logger.log(\`Token revoked: jti=\${jti}\`);
  }

  /**
   * Generate a secure, unique JWT ID
   */
  generateJti(): string {
    return crypto.randomUUID();
  }

  /**
   * Clean up expired jti tracking
   * Call periodically to prevent memory bloat
   */
  cleanupExpiredJtis(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [jti, expiry] of this.usedJtis.entries()) {
      if (now > expiry) {
        this.usedJtis.delete(jti);
        this.revokedTokens.delete(jti);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(\`Cleaned up \${cleaned} expired JWT IDs\`);
    }
  }

  /**
   * Create secure token payload with required claims
   */
  createSecurePayload(options: {
    subject: string;
    issuer: string;
    audience: string | string[];
    expiresInSeconds?: number;
    data?: Record<string, any>;
  }): JwtPayload {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = options.expiresInSeconds || 900; // 15 minutes default

    return {
      sub: options.subject,
      iss: options.issuer,
      aud: options.audience,
      iat: now,
      nbf: now,
      exp: now + expiresIn,
      jti: this.generateJti(),
      ...options.data,
    };
  }

  private base64UrlDecode(str: string): string {
    // Add padding if needed
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf-8');
  }
}

/**
 * Secure JWT configuration recommendations
 */
export const JwtSecurityRecommendations = {
  // Use RS256 or ES256 in production (asymmetric)
  RECOMMENDED_ALGORITHM: 'RS256',

  // Short token lifetime (15 min for access, longer for refresh)
  ACCESS_TOKEN_LIFETIME: 15 * 60,     // 15 minutes
  REFRESH_TOKEN_LIFETIME: 7 * 24 * 60 * 60, // 7 days

  // Always include these claims
  REQUIRED_CLAIMS: ['iss', 'sub', 'aud', 'exp', 'iat', 'jti'],

  // Key rotation recommendation
  KEY_ROTATION_DAYS: 90,
};
`;
}

function generateSecurityHeadersConfig(): string {
  return `/**
 * Comprehensive Security Headers Configuration
 * OWASP A05:2021 - Security Misconfiguration prevention
 */

import { Response } from 'express';

export interface SecurityHeadersOptions {
  isProduction?: boolean;
  contentSecurityPolicy?: ContentSecurityPolicyOptions;
  permissionsPolicy?: PermissionsPolicyOptions;
  reportUri?: string;
}

export interface ContentSecurityPolicyOptions {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  fontSrc?: string[];
  connectSrc?: string[];
  frameSrc?: string[];
  objectSrc?: string[];
  mediaSrc?: string[];
  workerSrc?: string[];
  frameAncestors?: string[];
  formAction?: string[];
  baseUri?: string[];
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
  reportUri?: string;
}

export interface PermissionsPolicyOptions {
  accelerometer?: string;
  camera?: string;
  geolocation?: string;
  gyroscope?: string;
  magnetometer?: string;
  microphone?: string;
  payment?: string;
  usb?: string;
  fullscreen?: string;
  [key: string]: string | undefined;
}

/**
 * Set all security headers on a response
 */
export function setSecurityHeaders(res: Response, options: SecurityHeadersOptions = {}): void {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production';

  // Clickjacking protection
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS protection (legacy but still useful)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // HTTPS strict transport
  if (isProduction) {
    // 2 years, include subdomains, allow preloading
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  // Referrer policy - strict for security, relaxed for internal analytics
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  const csp = buildContentSecurityPolicy(options.contentSecurityPolicy);
  if (isProduction) {
    res.setHeader('Content-Security-Policy', csp);
  } else {
    // Report-only in development for debugging
    res.setHeader('Content-Security-Policy-Report-Only', csp);
  }

  // Permissions Policy (formerly Feature-Policy)
  res.setHeader('Permissions-Policy', buildPermissionsPolicy(options.permissionsPolicy));

  // Cross-Origin policies
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  // Prevent Adobe products from cross-domain requests
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Prevent caching of sensitive data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  // Clear site data on logout (set this header on logout endpoint)
  // res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
}

/**
 * Build Content Security Policy header value
 */
function buildContentSecurityPolicy(options: ContentSecurityPolicyOptions = {}): string {
  const directives: string[] = [];

  const addDirective = (name: string, values: string[] | undefined, defaultValue: string[]) => {
    const finalValues = values ?? defaultValue;
    if (finalValues.length > 0) {
      directives.push(\`\${name} \${finalValues.join(' ')}\`);
    }
  };

  // Restrictive defaults
  addDirective('default-src', options.defaultSrc, ["'self'"]);
  addDirective('script-src', options.scriptSrc, ["'self'"]);
  addDirective('style-src', options.styleSrc, ["'self'"]);
  addDirective('img-src', options.imgSrc, ["'self'", 'data:', 'https:']);
  addDirective('font-src', options.fontSrc, ["'self'"]);
  addDirective('connect-src', options.connectSrc, ["'self'"]);
  addDirective('frame-src', options.frameSrc, ["'none'"]);
  addDirective('object-src', options.objectSrc, ["'none'"]);
  addDirective('media-src', options.mediaSrc, ["'self'"]);
  addDirective('worker-src', options.workerSrc, ["'self'"]);
  addDirective('frame-ancestors', options.frameAncestors, ["'none'"]);
  addDirective('form-action', options.formAction, ["'self'"]);
  addDirective('base-uri', options.baseUri, ["'self'"]);

  if (options.upgradeInsecureRequests !== false) {
    directives.push('upgrade-insecure-requests');
  }

  if (options.blockAllMixedContent !== false) {
    directives.push('block-all-mixed-content');
  }

  if (options.reportUri) {
    directives.push(\`report-uri \${options.reportUri}\`);
  }

  return directives.join('; ');
}

/**
 * Build Permissions Policy header value
 */
function buildPermissionsPolicy(options: PermissionsPolicyOptions = {}): string {
  const defaultPolicy: PermissionsPolicyOptions = {
    accelerometer: '()',
    camera: '()',
    geolocation: '()',
    gyroscope: '()',
    magnetometer: '()',
    microphone: '()',
    payment: '()',
    usb: '()',
    fullscreen: '(self)',
    ...options,
  };

  return Object.entries(defaultPolicy)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => \`\${key}=\${value}\`)
    .join(', ');
}

/**
 * Security headers for API responses (less restrictive CSP)
 */
export function setApiSecurityHeaders(res: Response, options: SecurityHeadersOptions = {}): void {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production';

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }

  // API-specific: prevent caching by default
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');

  // Prevent embedding
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
}

/**
 * Headers to set on logout for session cleanup
 */
export function setLogoutHeaders(res: Response): void {
  // Clear all site data
  res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
}

/**
 * Security headers middleware factory
 */
export function securityHeadersMiddleware(options: SecurityHeadersOptions = {}) {
  return (req: any, res: Response, next: () => void) => {
    setSecurityHeaders(res, options);
    next();
  };
}

/**
 * API security headers middleware factory
 */
export function apiSecurityHeadersMiddleware(options: SecurityHeadersOptions = {}) {
  return (req: any, res: Response, next: () => void) => {
    setApiSecurityHeaders(res, options);
    next();
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
import { JwtSecurityService } from './jwt.security';
import { securityHeadersMiddleware } from './security-headers.config';

export interface SecurityModuleOptions {
  enableRbac?: boolean;
  enableOwasp?: boolean;
  enableCsrf?: boolean;
  enableSecurityHeaders?: boolean;
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
      JwtSecurityService,
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
        JwtSecurityService,
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
    if (SecurityModule.options.enableSecurityHeaders !== false) {
      consumer.apply(securityHeadersMiddleware()).forRoutes('*');
    }
  }
}
`;
}
