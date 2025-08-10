import pluralize from 'pluralize';

export function toPascalCase(str: string): string {
  return str
    .split(/[-_ ]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
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