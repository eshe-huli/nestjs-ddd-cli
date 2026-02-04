/**
 * Security utilities for the CLI
 * Implements OWASP-recommended practices for input validation and path safety
 */

import * as path from 'path';

/**
 * Validates that a path does not escape the base directory
 * Prevents path traversal attacks (OWASP A01:2021)
 */
export function validateSafePath(basePath: string, targetPath: string): string {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(basePath, targetPath);

  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new Error(`Security: Path traversal detected in "${targetPath}"`);
  }

  return resolvedTarget;
}

/**
 * Sanitizes entity/module names for safe file system operations
 * Prevents directory traversal and special character injection
 */
export function sanitizeEntityName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Security: Entity name must be a non-empty string');
  }

  // Remove any path separators, dots (for traversal), and special characters
  const sanitized = name
    .replace(/\.{2,}/g, '') // Remove consecutive dots (path traversal)
    .replace(/[\/\\]/g, '') // Remove path separators
    .replace(/[<>:"|?*\x00-\x1f]/g, '') // Remove invalid filename chars
    .replace(/^[\s.-]+|[\s.-]+$/g, '') // Trim leading/trailing dots, spaces, hyphens
    .trim();

  if (sanitized.length === 0) {
    throw new Error(`Security: Invalid entity name after sanitization: "${name}"`);
  }

  if (sanitized.length > 100) {
    throw new Error(`Security: Entity name exceeds maximum length (100): "${name}"`);
  }

  // Block common injection patterns
  const dangerousPatterns = [
    /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i, // Windows reserved names
    /[\x00-\x1f]/g, // Control characters
    /__proto__|constructor|prototype/i, // Prototype pollution
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      throw new Error(`Security: Entity name contains dangerous pattern: "${name}"`);
    }
  }

  return sanitized;
}

/**
 * Validates that field names are safe for use in SQL/ORM queries
 * Only allows alphanumeric characters and underscores, starting with letter
 */
export function validateFieldName(fieldName: string, allowedFields?: string[]): string {
  if (!fieldName || typeof fieldName !== 'string') {
    throw new Error('Security: Field name must be a non-empty string');
  }

  // If allowed fields list provided, strict whitelist validation
  if (allowedFields && allowedFields.length > 0) {
    if (!allowedFields.includes(fieldName)) {
      throw new Error(
        `Security: Field "${fieldName}" not in allowed list: ${allowedFields.join(', ')}`
      );
    }
    return fieldName;
  }

  // Pattern: must start with letter or underscore, followed by alphanumeric/underscore
  const SAFE_FIELD_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

  if (!SAFE_FIELD_REGEX.test(fieldName)) {
    throw new Error(`Security: Invalid field name format: "${fieldName}"`);
  }

  if (fieldName.length > 64) {
    throw new Error(`Security: Field name exceeds maximum length (64): "${fieldName}"`);
  }

  // Block SQL keywords as field names
  const SQL_KEYWORDS = [
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'CREATE',
    'ALTER',
    'TRUNCATE',
    'GRANT',
    'REVOKE',
    'UNION',
    'WHERE',
    'FROM',
    'JOIN',
    'OR',
    'AND',
    'NOT',
    'NULL',
    'TRUE',
    'FALSE',
    'EXEC',
    'EXECUTE',
    'XP_',
    'SP_',
  ];

  if (SQL_KEYWORDS.includes(fieldName.toUpperCase())) {
    throw new Error(`Security: Field name "${fieldName}" is a reserved SQL keyword`);
  }

  return fieldName;
}

/**
 * Sanitizes input for use in shell commands
 * Implements whitelist approach - only allows safe characters
 */
export function sanitizeShellInput(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Security: Shell input must be a non-empty string');
  }

  // Strict whitelist: only alphanumeric, hyphen, underscore, dot, forward slash
  // (for paths within allowed directories)
  const SAFE_SHELL_REGEX = /^[a-zA-Z0-9_\-./]+$/;

  if (!SAFE_SHELL_REGEX.test(input)) {
    // Instead of throwing, sanitize by removing unsafe characters
    const sanitized = input.replace(/[^a-zA-Z0-9_\-./]/g, '');
    if (sanitized.length === 0) {
      throw new Error('Security: Shell input contains only disallowed characters');
    }
    return sanitized;
  }

  // Block command injection patterns
  if (/\.\./g.test(input)) {
    throw new Error('Security: Shell input contains path traversal');
  }

  return input;
}

/**
 * Validates numeric input is within safe bounds
 */
export function validateNumericInput(
  value: number,
  options: { min?: number; max?: number; allowNegative?: boolean; allowZero?: boolean } = {}
): number {
  const { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, allowNegative = true, allowZero = true } = options;

  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    throw new Error(`Security: Invalid numeric value: ${value}`);
  }

  if (!allowNegative && value < 0) {
    throw new Error(`Security: Negative values not allowed: ${value}`);
  }

  if (!allowZero && value === 0) {
    throw new Error('Security: Zero value not allowed');
  }

  if (value < min || value > max) {
    throw new Error(`Security: Value ${value} out of range [${min}, ${max}]`);
  }

  return value;
}

/**
 * Sanitizes string for safe HTML output
 * Prevents XSS attacks (OWASP A03:2021)
 */
export function sanitizeHtmlOutput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  return input.replace(/[&<>"'/`=]/g, (char) => htmlEntities[char] || char);
}

/**
 * Masks sensitive data in strings (API keys, passwords, etc.)
 * For safe logging
 */
export function maskSensitiveData(input: string): string {
  if (!input || typeof input !== 'string') {
    return '[EMPTY]';
  }

  if (input.length <= 8) {
    return '****';
  }

  // Show first 4 and last 4 characters
  return `${input.substring(0, 4)}${'*'.repeat(Math.min(input.length - 8, 20))}${input.substring(input.length - 4)}`;
}

/**
 * Validates URL is safe and uses allowed protocols
 */
export function validateUrl(url: string, allowedProtocols: string[] = ['https:', 'http:']): string {
  if (!url || typeof url !== 'string') {
    throw new Error('Security: URL must be a non-empty string');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Security: Invalid URL format: ${url}`);
  }

  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error(
      `Security: URL protocol "${parsed.protocol}" not allowed. Allowed: ${allowedProtocols.join(', ')}`
    );
  }

  // Block localhost and internal IPs in production
  const hostname = parsed.hostname.toLowerCase();
  const blockedHostPatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^0\.0\.0\.0$/,
    /^\[::1\]$/,
    /^metadata\.google\.internal$/,
    /^169\.254\./,
  ];

  if (process.env.NODE_ENV === 'production') {
    for (const pattern of blockedHostPatterns) {
      if (pattern.test(hostname)) {
        throw new Error(`Security: URL hostname "${hostname}" blocked in production`);
      }
    }
  }

  return url;
}

/**
 * Creates a rate limit key from request data
 * Sanitizes to prevent key injection
 */
export function createRateLimitKey(prefix: string, identifier: string): string {
  const sanitizedPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
  const sanitizedIdentifier = identifier.replace(/[^a-zA-Z0-9_\-@.]/g, '').substring(0, 128);

  return `${sanitizedPrefix}:${sanitizedIdentifier}`;
}

/**
 * Validates JSON input for safe parsing
 * Prevents prototype pollution
 */
export function safeJsonParse<T>(input: string): T {
  if (!input || typeof input !== 'string') {
    throw new Error('Security: JSON input must be a non-empty string');
  }

  // Check for potential prototype pollution patterns before parsing
  if (/__proto__|constructor|prototype/.test(input)) {
    throw new Error('Security: JSON contains prototype pollution attempt');
  }

  try {
    const parsed = JSON.parse(input);

    // Deep check for prototype pollution
    function checkObject(obj: any, depth = 0): void {
      if (depth > 10) return; // Limit recursion depth

      if (obj && typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            throw new Error('Security: JSON object contains prototype pollution key');
          }
          checkObject(obj[key], depth + 1);
        }
      }
    }

    checkObject(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Security:')) {
      throw error;
    }
    throw new Error(`Security: Invalid JSON: ${(error as Error).message}`);
  }
}
