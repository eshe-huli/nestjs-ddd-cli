import * as fs from 'fs-extra';
import * as path from 'path';
import Handlebars from 'handlebars';
import { toKebabCase, toPascalCase, toCamelCase, toSnakeCase, toPlural, toTableName } from './naming.utils';
import { FieldDefinition, parseFields, generateFieldsTemplateData } from './field.utils';

// Register Handlebars helpers
Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

Handlebars.registerHelper('lowercase', function (str) {
  return typeof str === 'string' ? str.toLowerCase() : str;
});

Handlebars.registerHelper('uppercase', function (str) {
  return typeof str === 'string' ? str.toUpperCase() : str;
});

Handlebars.registerHelper('pascalCase', function (str) {
  return typeof str === 'string' ? toPascalCase(str) : str;
});

Handlebars.registerHelper('camelCase', function (str) {
  return typeof str === 'string' ? toCamelCase(str) : str;
});

Handlebars.registerHelper('kebabCase', function (str) {
  return typeof str === 'string' ? toKebabCase(str) : str;
});

export interface TemplateData {
  entityName: string;
  entityNamePascal: string;
  entityNameCamel: string;
  entityNameKebab: string;
  entityNameSnake: string;
  entityNamePlural: string;
  entityNamePluralPascal: string;
  entityNamePluralCamel: string;
  entityNamePluralKebab: string;
  tableName: string;
  moduleName: string;
  moduleNameKebab: string;
  moduleNamePascal: string;
  // Field-aware properties
  fields?: FieldDefinition[];
  hasFields: boolean;
  entityProperties?: string;
  entityPropsInterface?: string;
  dtoProperties?: string;
  ormColumns?: string;
  migrationColumns?: string;
  responseProperties?: string;
  // Relation properties
  hasRelations: boolean;
  relationImports?: string;
}

export function prepareTemplateData(entityName: string, moduleName: string, fieldsString?: string): TemplateData {
  const parsedFields = fieldsString ? parseFields(fieldsString) : null;
  const fieldsTemplateData = parsedFields?.fields.length
    ? generateFieldsTemplateData(parsedFields.fields)
    : null;

  // Check for relations and generate imports
  const relationFields = parsedFields?.fields.filter(f => f.isRelation) || [];
  const hasRelations = relationFields.length > 0;

  // Generate unique relation imports
  const relationTargets = [...new Set(relationFields.map(f => f.relationTarget).filter(Boolean))];
  const relationImports = relationTargets.length > 0
    ? relationTargets.map(target => `import { ${target}OrmEntity } from "./${toKebabCase(target!)}.orm-entity";`).join('\n')
    : '';

  return {
    entityName,
    entityNamePascal: toPascalCase(entityName),
    entityNameCamel: toCamelCase(entityName),
    entityNameKebab: toKebabCase(entityName),
    entityNameSnake: toSnakeCase(entityName),
    entityNamePlural: toPlural(toPascalCase(entityName)),
    entityNamePluralPascal: toPlural(toPascalCase(entityName)),
    entityNamePluralCamel: toCamelCase(toPlural(entityName)),
    entityNamePluralKebab: toKebabCase(toPlural(entityName)),
    tableName: toTableName(entityName),
    moduleName: toPascalCase(moduleName),
    moduleNameKebab: toKebabCase(moduleName),
    moduleNamePascal: toPascalCase(moduleName),
    // Field-aware properties
    fields: parsedFields?.fields || [],
    hasFields: (parsedFields?.fields.length || 0) > 0,
    entityProperties: fieldsTemplateData?.entityProperties || '',
    entityPropsInterface: fieldsTemplateData?.entityPropsInterface || '',
    dtoProperties: fieldsTemplateData?.dtoProperties || '',
    ormColumns: fieldsTemplateData?.ormColumns || '',
    migrationColumns: fieldsTemplateData?.migrationColumns || '',
    responseProperties: fieldsTemplateData?.responseProperties || '',
    // Relation properties
    hasRelations,
    relationImports,
  };
}

/**
 * Validate that a path is safe and within allowed bounds
 * Prevents path traversal attacks (OWASP A01:2021)
 */
function validatePath(targetPath: string, basePath?: string): void {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Path must be a non-empty string');
  }

  // Check for null bytes (can bypass security checks)
  if (targetPath.includes('\0')) {
    throw new Error('Path contains null byte');
  }

  // Check for path traversal patterns
  const normalizedPath = path.normalize(targetPath);
  if (normalizedPath.includes('..')) {
    // After normalization, if .. still exists, it's going above root
    const resolvedPath = path.resolve(targetPath);
    const cwdPath = basePath || process.cwd();

    if (!resolvedPath.startsWith(cwdPath)) {
      throw new Error('Path traversal detected: path escapes base directory');
    }
  }

  // Block access to sensitive system directories
  const blockedPatterns = [
    /^\/etc\//i,
    /^\/proc\//i,
    /^\/sys\//i,
    /^\/dev\//i,
    /^\/root\//i,
    /^C:\\Windows/i,
    /^C:\\Program Files/i,
    /\.env$/i,
    /\.git\//i,
    /\.ssh\//i,
    /id_rsa/i,
    /\.pem$/i,
    /\.key$/i,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(normalizedPath)) {
      throw new Error(`Access to path is blocked: ${normalizedPath}`);
    }
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  validatePath(dirPath);
  await fs.ensureDir(dirPath);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    validatePath(filePath);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  validatePath(filePath);

  // Validate content size (prevent DoS via huge files)
  const maxContentSize = 10 * 1024 * 1024; // 10MB max
  if (content && content.length > maxContentSize) {
    throw new Error(`Content exceeds maximum size of ${maxContentSize} bytes`);
  }

  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function readTemplate(templatePath: string): Promise<string> {
  validatePath(templatePath);

  // Get file stats to check size before reading
  try {
    const stats = await fs.stat(templatePath);
    const maxTemplateSize = 1024 * 1024; // 1MB max for templates
    if (stats.size > maxTemplateSize) {
      throw new Error(`Template file exceeds maximum size of ${maxTemplateSize} bytes`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    throw error;
  }

  return fs.readFile(templatePath, 'utf-8');
}

export function compileTemplate(template: string, data: TemplateData): string {
  const compiledTemplate = Handlebars.compile(template);
  return compiledTemplate(data);
}

export async function generateFromTemplate(
  templatePath: string,
  outputPath: string,
  data: TemplateData,
  dryRun = false
): Promise<string> {
  const template = await readTemplate(templatePath);
  const content = compileTemplate(template, data);

  if (!dryRun) {
    await writeFile(outputPath, content);
  }

  return outputPath;
}

// Dry run tracking
let dryRunFiles: string[] = [];

export function resetDryRunFiles(): void {
  dryRunFiles = [];
}

export function getDryRunFiles(): string[] {
  return [...dryRunFiles];
}

export function addDryRunFile(filePath: string): void {
  dryRunFiles.push(filePath);
}

export function getModulePath(basePath: string, moduleName: string): string {
  return path.join(basePath, 'src', 'modules', toKebabCase(moduleName));
}