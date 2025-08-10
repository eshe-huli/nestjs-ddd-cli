import * as fs from 'fs-extra';
import * as path from 'path';
import Handlebars from 'handlebars';
import { toKebabCase, toPascalCase, toCamelCase, toSnakeCase, toPlural, toTableName } from './naming.utils';

export interface TemplateData {
  entityName: string;
  entityNamePascal: string;
  entityNameCamel: string;
  entityNameKebab: string;
  entityNameSnake: string;
  entityNamePlural: string;
  entityNamePluralKebab: string;
  tableName: string;
  moduleName: string;
  moduleNameKebab: string;
  properties?: Array<{
    name: string;
    type: string;
    isRequired: boolean;
    isRelation: boolean;
  }>;
}

export function prepareTemplateData(entityName: string, moduleName: string): TemplateData {
  return {
    entityName,
    entityNamePascal: toPascalCase(entityName),
    entityNameCamel: toCamelCase(entityName),
    entityNameKebab: toKebabCase(entityName),
    entityNameSnake: toSnakeCase(entityName),
    entityNamePlural: toPlural(toPascalCase(entityName)),
    entityNamePluralKebab: toKebabCase(toPlural(entityName)),
    tableName: toTableName(entityName),
    moduleName,
    moduleNameKebab: toKebabCase(moduleName),
  };
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function readTemplate(templatePath: string): Promise<string> {
  return fs.readFile(templatePath, 'utf-8');
}

export function compileTemplate(template: string, data: TemplateData): string {
  const compiledTemplate = Handlebars.compile(template);
  return compiledTemplate(data);
}

export async function generateFromTemplate(
  templatePath: string,
  outputPath: string,
  data: TemplateData
): Promise<void> {
  const template = await readTemplate(templatePath);
  const content = compileTemplate(template, data);
  await writeFile(outputPath, content);
}

export function getModulePath(basePath: string, moduleName: string): string {
  return path.join(basePath, 'src', 'modules', toKebabCase(moduleName));
}