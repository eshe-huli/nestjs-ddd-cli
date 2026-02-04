import pluralize from 'pluralize';

/**
 * Sanitizes input string to prevent path traversal attacks
 * Called before any naming transformation
 */
function sanitizeInput(str: string): string {
  if (!str || typeof str !== 'string') {
    throw new Error('Invalid input: must be a non-empty string');
  }
  // Remove path traversal attempts and path separators
  return str
    .replace(/\.{2,}/g, '') // Remove consecutive dots
    .replace(/[\/\\]/g, '') // Remove path separators
    .replace(/[\x00-\x1f]/g, ''); // Remove control characters
}

export function toPascalCase(str: string): string {
  const sanitized = sanitizeInput(str);

  // If the string is already PascalCase (starts with uppercase and has no separators), return as-is
  if (/^[A-Z][a-zA-Z0-9]*$/.test(sanitized) && !/[-_ ]/.test(sanitized)) {
    return sanitized;
  }

  return sanitized
    .split(/[-_ ]/)
    .filter(word => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toKebabCase(str: string): string {
  const sanitized = sanitizeInput(str);
  return sanitized
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
    .toLowerCase();
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

export function toPlural(str: string): string {
  return pluralize(str);
}

export function toSingular(str: string): string {
  return pluralize.singular(str);
}

export function toTableName(entityName: string): string {
  const singular = toSingular(entityName);
  const snakeCase = toSnakeCase(singular);
  return toPlural(snakeCase);
}