import * as fs from 'fs-extra';
import * as path from 'path';
import Handlebars from 'handlebars';
import {
  toKebabCase,
  toPascalCase,
  toCamelCase,
  toSnakeCase,
  toPlural,
  toTableName,
} from './naming.utils';
import { FieldDefinition, parseFields, generateFieldsTemplateData } from './field.utils';
import { loadConfig } from './config.utils';

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
  requestFields?: FieldDefinition[];
  serverOwnedFields?: FieldDefinition[];
  hasFields: boolean;
  hasRequestFields: boolean;
  hasServerOwnedFields: boolean;
  entityProperties?: string;
  entityPropsInterface?: string;
  dtoProperties?: string;
  ormColumns?: string;
  migrationColumns?: string;
  responseProperties?: string;
  // Relation properties
  hasRelations: boolean;
  relationImports?: string;
  // Configuration-aware generation properties
  orm: 'typeorm' | 'prisma' | 'mikro-orm';
  isPrisma: boolean;
  softDelete: boolean;
  hardDelete: boolean;
}

export interface TemplateGenerationConfig {
  orm?: 'typeorm' | 'prisma' | 'mikro-orm';
  features?: {
    softDelete?: boolean;
    hardDelete?: boolean;
  };
}

export interface ConfiguredTemplateDataOptions extends TemplateGenerationConfig {
  basePath: string;
  fieldsString?: string;
}

export async function prepareConfiguredTemplateData(
  entityName: string,
  moduleName: string,
  options: ConfiguredTemplateDataOptions,
): Promise<TemplateData> {
  const config = await loadConfig(options.basePath);

  return prepareTemplateData(entityName, moduleName, options.fieldsString, {
    orm: options.orm ?? config.orm,
    features: {
      softDelete: options.features?.softDelete ?? config.features.softDelete,
      hardDelete: options.features?.hardDelete ?? config.features.hardDelete,
    },
  });
}

export function prepareTemplateData(
  entityName: string,
  moduleName: string,
  fieldsString?: string,
  generationConfig: TemplateGenerationConfig = {},
): TemplateData {
  const parsedFields = fieldsString ? parseFields(fieldsString) : null;
  const fieldsTemplateData = parsedFields?.fields.length
    ? generateFieldsTemplateData(parsedFields.fields)
    : null;

  // Check for relations and generate imports
  const relationFields = parsedFields?.fields.filter((f) => f.isRelation) || [];
  const requestFields = parsedFields?.fields.filter((field) => !field.isServerOwned) || [];
  const serverOwnedFields = parsedFields?.fields.filter((field) => field.isServerOwned) || [];
  const hasRelations = relationFields.length > 0;

  // Generate unique relation imports
  const relationTargets = [...new Set(relationFields.map((f) => f.relationTarget).filter(Boolean))];
  const relationImports =
    relationTargets.length > 0
      ? relationTargets
          .map(
            (target) =>
              `import { ${target}OrmEntity } from "./${toKebabCase(target!)}.orm-entity";`,
          )
          .join('\n')
      : '';
  const softDelete = generationConfig.features?.softDelete ?? true;

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
    requestFields,
    serverOwnedFields,
    hasFields: (parsedFields?.fields.length || 0) > 0,
    hasRequestFields: requestFields.length > 0,
    hasServerOwnedFields: serverOwnedFields.length > 0,
    entityProperties: fieldsTemplateData?.entityProperties || '',
    entityPropsInterface: fieldsTemplateData?.entityPropsInterface || '',
    dtoProperties: fieldsTemplateData?.dtoProperties || '',
    ormColumns: fieldsTemplateData?.ormColumns || '',
    migrationColumns: fieldsTemplateData?.migrationColumns || '',
    responseProperties: fieldsTemplateData?.responseProperties || '',
    // Relation properties
    hasRelations,
    relationImports,
    // Configuration-aware generation properties
    orm: generationConfig.orm ?? 'typeorm',
    isPrisma: generationConfig.orm === 'prisma',
    softDelete,
    hardDelete: softDelete && (generationConfig.features?.hardDelete ?? false),
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
  validateContentSize(content);

  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

function validateContentSize(content: string): void {
  const maxContentSize = 10 * 1024 * 1024; // 10MB max
  if (content && content.length > maxContentSize) {
    throw new Error(`Content exceeds maximum size of ${maxContentSize} bytes`);
  }
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
  const compiledTemplate = Handlebars.compile(template, { noEscape: true });
  return compiledTemplate(data);
}

export async function generateFromTemplate(
  templatePath: string,
  outputPath: string,
  data: TemplateData,
  dryRun = false,
): Promise<string> {
  const template = await readTemplate(templatePath);
  const content = compileTemplate(template, data);

  await writeGeneratedFile(outputPath, content, dryRun);

  return outputPath;
}

// Dry run tracking
export type DryRunAction = 'create' | 'update';

export interface DryRunChange {
  filePath: string;
  action: DryRunAction;
}

let dryRunFiles: DryRunChange[] = [];

export function resetDryRunFiles(): void {
  dryRunFiles = [];
}

export function getDryRunFiles(): DryRunChange[] {
  return [...dryRunFiles];
}

export function addDryRunFile(filePath: string, action: DryRunAction = 'create'): void {
  if (dryRunFiles.some((change) => change.filePath === filePath)) {
    return;
  }

  dryRunFiles.push({ filePath, action });
}

export async function writeGeneratedFile(
  filePath: string,
  content: string,
  dryRun = false,
): Promise<void> {
  validatePath(filePath);
  validateContentSize(content);

  if (dryRun) {
    addDryRunFile(filePath, (await fileExists(filePath)) ? 'update' : 'create');
    return;
  }

  await writeFile(filePath, content);
}

export interface BarrelFileUpdate {
  exports?: string[];
  imports?: string[];
  arrayName?: string;
  arrayItems?: string[];
  dryRun?: boolean;
}

export async function updateBarrelFile(filePath: string, update: BarrelFileUpdate): Promise<void> {
  validatePath(filePath);

  let content = '';
  if (await fileExists(filePath)) {
    content = await fs.readFile(filePath, 'utf-8');
  }

  const originalContent = content;

  content = appendUniqueLines(content, update.exports || [], update.arrayName);
  content = appendUniqueLines(content, update.imports || [], update.arrayName);

  if (update.arrayName && update.arrayItems?.length) {
    content = mergeExportedArray(content, update.arrayName, update.arrayItems);
  }

  content = normalizeFileContent(content);

  if (content !== normalizeFileContent(originalContent)) {
    await writeGeneratedFile(filePath, content, !!update.dryRun);
  }
}

function appendUniqueLines(content: string, lines: string[], beforeArrayName?: string): string {
  const existingLines = new Set(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
  const missingLines = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !existingLines.has(line));

  if (!missingLines.length) {
    return content;
  }

  const insertion = `${missingLines.join('\n')}\n`;

  if (beforeArrayName) {
    const arrayPattern = new RegExp(
      `export const ${escapeRegExp(beforeArrayName)}(:[^=]+)?\\s*=\\s*\\[`,
    );
    const arrayMatch = arrayPattern.exec(content);

    if (arrayMatch?.index !== undefined) {
      const beforeArray = content.slice(0, arrayMatch.index).trimEnd();
      const afterArray = content.slice(arrayMatch.index);
      const prefix = beforeArray.length > 0 ? `${beforeArray}\n` : '';
      return `${prefix}${insertion}${afterArray}`;
    }
  }

  const trimmedContent = content.trimEnd();
  const prefix = trimmedContent.length > 0 ? `${trimmedContent}\n` : '';
  return `${prefix}${insertion}`;
}

function mergeExportedArray(content: string, arrayName: string, arrayItems: string[]): string {
  const uniqueItems = [...new Set(arrayItems.map((item) => item.trim()).filter(Boolean))];
  const escapedArrayName = escapeRegExp(arrayName);
  const arrayPattern = new RegExp(
    `export const ${escapedArrayName}(:[^=]+)?\\s*=\\s*\\[([\\s\\S]*?)\\];`,
  );
  const match = arrayPattern.exec(content);

  if (!match) {
    const arrayContent = uniqueItems.map((item) => `  ${item},`).join('\n');
    return appendUniqueLines(content, [`export const ${arrayName} = [\n${arrayContent}\n];`]);
  }

  const typeAnnotation = match[1] || '';
  const body = match[2] || '';
  const missingItems = uniqueItems.filter((item) => !hasArrayItem(body, item));

  if (!missingItems.length) {
    return content;
  }

  const nextBody = appendArrayItems(body, missingItems);
  const nextArray = `export const ${arrayName}${typeAnnotation} = [${nextBody}];`;

  return content.replace(match[0], nextArray);
}

function hasArrayItem(body: string, item: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9_$])${escapeRegExp(item)}([^A-Za-z0-9_$]|$)`).test(body);
}

function appendArrayItems(body: string, missingItems: string[]): string {
  const linesToAdd = missingItems.map((item) => `  ${item},`).join('\n');
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    return `\n${linesToAdd}\n`;
  }

  if (!body.includes('\n')) {
    return `\n  ${trimmedBody.replace(/,\s*$/, '')},\n${linesToAdd}\n`;
  }

  const bodyWithTrailingComma = /,\s*$/.test(body.trimEnd())
    ? body.trimEnd()
    : `${body.trimEnd()},`;

  return `${bodyWithTrailingComma}\n${linesToAdd}\n`;
}

function normalizeFileContent(content: string): string {
  return content.trimEnd() ? `${content.trimEnd()}\n` : '';
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getModulePath(basePath: string, moduleName: string): string {
  return path.join(basePath, 'src', 'modules', toKebabCase(moduleName));
}
