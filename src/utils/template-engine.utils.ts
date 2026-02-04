/**
 * Config-Driven Template System
 * Provides template inheritance, hooks, and per-module overrides
 */

import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';

export interface TemplateConfig {
  extends?: string;
  overrides?: Record<string, string>;
  hooks?: {
    preGenerate?: string;
    postGenerate?: string;
    preCompile?: string;
    postCompile?: string;
  };
  helpers?: Record<string, string>;
  partials?: Record<string, string>;
}

export interface GenerationContext {
  entityName: string;
  moduleName: string;
  fields: any[];
  relations?: any[];
  config: Record<string, any>;
  options: Record<string, any>;
  meta: {
    timestamp: Date;
    version: string;
    generator: string;
  };
}

export interface GenerationHook {
  (context: GenerationContext): Promise<GenerationContext> | GenerationContext;
}

export interface TemplateRegistry {
  templates: Map<string, CompiledTemplate>;
  partials: Map<string, Handlebars.TemplateDelegate>;
  helpers: Map<string, Handlebars.HelperDelegate>;
  hooks: {
    preGenerate: GenerationHook[];
    postGenerate: GenerationHook[];
  };
}

export interface CompiledTemplate {
  name: string;
  source: string;
  compiled: Handlebars.TemplateDelegate;
  config?: TemplateConfig;
}

/**
 * Create a new template registry
 */
export function createTemplateRegistry(): TemplateRegistry {
  const registry: TemplateRegistry = {
    templates: new Map(),
    partials: new Map(),
    helpers: new Map(),
    hooks: {
      preGenerate: [],
      postGenerate: [],
    },
  };

  // Register built-in helpers
  registerBuiltInHelpers(registry);

  return registry;
}

/**
 * Register built-in Handlebars helpers
 */
function registerBuiltInHelpers(registry: TemplateRegistry): void {
  const helpers: Record<string, Handlebars.HelperDelegate> = {
    // Case transformations
    camelCase: (str: string) => toCamelCase(str),
    pascalCase: (str: string) => toPascalCase(str),
    kebabCase: (str: string) => toKebabCase(str),
    snakeCase: (str: string) => toSnakeCase(str),
    upperCase: (str: string) => str.toUpperCase(),
    lowerCase: (str: string) => str.toLowerCase(),

    // Pluralization
    pluralize: (str: string) => pluralize(str),
    singularize: (str: string) => singularize(str),

    // Conditionals
    eq: (a: any, b: any) => a === b,
    ne: (a: any, b: any) => a !== b,
    gt: (a: number, b: number) => a > b,
    lt: (a: number, b: number) => a < b,
    gte: (a: number, b: number) => a >= b,
    lte: (a: number, b: number) => a <= b,
    and: (...args: any[]) => args.slice(0, -1).every(Boolean),
    or: (...args: any[]) => args.slice(0, -1).some(Boolean),
    not: (val: any) => !val,

    // Array helpers
    first: (arr: any[]) => arr?.[0],
    last: (arr: any[]) => arr?.[arr.length - 1],
    length: (arr: any[]) => arr?.length ?? 0,
    join: (arr: any[], sep: string) => arr?.join(typeof sep === 'string' ? sep : ', '),
    includes: (arr: any[], val: any) => arr?.includes(val),

    // String helpers
    concat: (...args: any[]) => args.slice(0, -1).join(''),
    replace: (str: string, search: string, replacement: string) =>
      str?.replace(new RegExp(search, 'g'), replacement),
    trim: (str: string) => str?.trim(),
    split: (str: string, sep: string) => str?.split(sep),
    padStart: (str: string, len: number, char: string) =>
      String(str).padStart(len, char),
    padEnd: (str: string, len: number, char: string) =>
      String(str).padEnd(len, char),

    // Type helpers
    typeOf: (val: any) => typeof val,
    isArray: (val: any) => Array.isArray(val),
    isObject: (val: any) => val && typeof val === 'object' && !Array.isArray(val),
    isString: (val: any) => typeof val === 'string',
    isNumber: (val: any) => typeof val === 'number',
    isBoolean: (val: any) => typeof val === 'boolean',

    // Date helpers
    now: () => new Date().toISOString(),
    formatDate: (date: Date | string, format?: string) => {
      const d = new Date(date);
      return format ? formatDateString(d, format) : d.toISOString();
    },

    // TypeScript/NestJS specific
    toTsType: (fieldType: string) => fieldTypeToTs(fieldType),
    toDbType: (fieldType: string, orm?: string) => fieldTypeToDb(fieldType, orm),
    toValidatorDecorators: (field: any) => generateValidatorDecorators(field),
    toColumnDecorator: (field: any) => generateColumnDecorator(field),

    // JSON helpers
    json: (obj: any) => JSON.stringify(obj, null, 2),
    jsonInline: (obj: any) => JSON.stringify(obj),

    // Import helpers
    importPath: (from: string, to: string) => calculateImportPath(from, to),

    // Block helpers
    times: function(n: number, options: Handlebars.HelperOptions) {
      let result = '';
      for (let i = 0; i < n; i++) {
        result += options.fn({ index: i, first: i === 0, last: i === n - 1 });
      }
      return result;
    },

    each_with_index: function(arr: any[], options: Handlebars.HelperOptions) {
      let result = '';
      arr?.forEach((item, index) => {
        result += options.fn({
          ...item,
          '@index': index,
          '@first': index === 0,
          '@last': index === arr.length - 1,
        });
      });
      return result;
    },

    ifCond: function(v1: any, operator: string, v2: any, options: Handlebars.HelperOptions) {
      switch (operator) {
        case '==': return v1 == v2 ? options.fn(this) : options.inverse(this);
        case '===': return v1 === v2 ? options.fn(this) : options.inverse(this);
        case '!=': return v1 != v2 ? options.fn(this) : options.inverse(this);
        case '!==': return v1 !== v2 ? options.fn(this) : options.inverse(this);
        case '<': return v1 < v2 ? options.fn(this) : options.inverse(this);
        case '<=': return v1 <= v2 ? options.fn(this) : options.inverse(this);
        case '>': return v1 > v2 ? options.fn(this) : options.inverse(this);
        case '>=': return v1 >= v2 ? options.fn(this) : options.inverse(this);
        case '&&': return v1 && v2 ? options.fn(this) : options.inverse(this);
        case '||': return v1 || v2 ? options.fn(this) : options.inverse(this);
        default: return options.inverse(this);
      }
    },
  };

  for (const [name, helper] of Object.entries(helpers)) {
    registry.helpers.set(name, helper);
    Handlebars.registerHelper(name, helper);
  }
}

/**
 * Load template from file with optional config
 */
export function loadTemplate(
  registry: TemplateRegistry,
  templatePath: string,
  name?: string
): CompiledTemplate {
  const source = fs.readFileSync(templatePath, 'utf-8');
  const templateName = name || path.basename(templatePath, path.extname(templatePath));

  // Check for config file
  const configPath = templatePath.replace(/\.hbs$/, '.config.json');
  let config: TemplateConfig | undefined;

  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  const compiled = Handlebars.compile(source);

  const template: CompiledTemplate = {
    name: templateName,
    source,
    compiled,
    config,
  };

  registry.templates.set(templateName, template);
  return template;
}

/**
 * Load all templates from a directory
 */
export function loadTemplatesFromDirectory(
  registry: TemplateRegistry,
  dirPath: string
): void {
  if (!fs.existsSync(dirPath)) return;

  const files = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);

    if (file.isDirectory()) {
      loadTemplatesFromDirectory(registry, fullPath);
    } else if (file.name.endsWith('.hbs')) {
      loadTemplate(registry, fullPath);
    }
  }
}

/**
 * Register a partial template
 */
export function registerPartial(
  registry: TemplateRegistry,
  name: string,
  source: string
): void {
  const compiled = Handlebars.compile(source);
  registry.partials.set(name, compiled);
  Handlebars.registerPartial(name, source);
}

/**
 * Register a custom helper
 */
export function registerHelper(
  registry: TemplateRegistry,
  name: string,
  helper: Handlebars.HelperDelegate
): void {
  registry.helpers.set(name, helper);
  Handlebars.registerHelper(name, helper);
}

/**
 * Register a generation hook
 */
export function registerHook(
  registry: TemplateRegistry,
  phase: 'preGenerate' | 'postGenerate',
  hook: GenerationHook
): void {
  registry.hooks[phase].push(hook);
}

/**
 * Render a template with context
 */
export async function renderTemplate(
  registry: TemplateRegistry,
  templateName: string,
  context: GenerationContext
): Promise<string> {
  const template = registry.templates.get(templateName);
  if (!template) {
    throw new Error(`Template not found: ${templateName}`);
  }

  // Run pre-generate hooks
  let processedContext = context;
  for (const hook of registry.hooks.preGenerate) {
    processedContext = await hook(processedContext);
  }

  // Handle template inheritance
  let source = template.source;
  if (template.config?.extends) {
    const parentTemplate = registry.templates.get(template.config.extends);
    if (parentTemplate) {
      source = mergeTemplates(parentTemplate.source, source);
    }
  }

  // Compile and render
  const compiled = Handlebars.compile(source);
  let result = compiled(processedContext);

  // Run post-generate hooks
  for (const hook of registry.hooks.postGenerate) {
    const hookResult = await hook({ ...processedContext, _output: result } as any);
    if ((hookResult as any)._output) {
      result = (hookResult as any)._output;
    }
  }

  return result;
}

/**
 * Merge parent and child templates (block-based inheritance)
 */
function mergeTemplates(parentSource: string, childSource: string): string {
  // Extract blocks from child
  const blockPattern = /\{\{#block\s+"(\w+)"\}\}([\s\S]*?)\{\{\/block\}\}/g;
  const blocks = new Map<string, string>();

  let match;
  while ((match = blockPattern.exec(childSource)) !== null) {
    blocks.set(match[1], match[2]);
  }

  // Replace parent blocks with child blocks
  let result = parentSource;
  for (const [name, content] of blocks) {
    const parentBlockPattern = new RegExp(
      `\\{\\{#block\\s+"${name}"\\}\\}[\\s\\S]*?\\{\\{\\/block\\}\\}`,
      'g'
    );
    result = result.replace(parentBlockPattern, content);
  }

  return result;
}

/**
 * Create per-module template overrides
 */
export function createModuleTemplateConfig(
  moduleName: string,
  overrides: Record<string, string>
): TemplateConfig {
  return {
    overrides: Object.fromEntries(
      Object.entries(overrides).map(([template, customPath]) => [
        template,
        path.join('src/modules', moduleName, '.templates', customPath),
      ])
    ),
  };
}

// Helper implementations
function toCamelCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^(.)/, c => c.toLowerCase());
}

function toPascalCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^(.)/, c => c.toUpperCase());
}

function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function pluralize(str: string): string {
  const irregulars: Record<string, string> = {
    'person': 'people',
    'child': 'children',
    'mouse': 'mice',
    'goose': 'geese',
  };

  if (irregulars[str.toLowerCase()]) {
    return irregulars[str.toLowerCase()];
  }

  if (str.endsWith('y') && !['ay', 'ey', 'iy', 'oy', 'uy'].some(v => str.endsWith(v))) {
    return str.slice(0, -1) + 'ies';
  }
  if (str.endsWith('s') || str.endsWith('x') || str.endsWith('ch') || str.endsWith('sh')) {
    return str + 'es';
  }
  return str + 's';
}

function singularize(str: string): string {
  if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
  if (str.endsWith('es')) return str.slice(0, -2);
  if (str.endsWith('s')) return str.slice(0, -1);
  return str;
}

function fieldTypeToTs(type: string): string {
  const map: Record<string, string> = {
    'string': 'string',
    'number': 'number',
    'boolean': 'boolean',
    'date': 'Date',
    'datetime': 'Date',
    'text': 'string',
    'json': 'Record<string, any>',
    'uuid': 'string',
    'email': 'string',
    'url': 'string',
    'decimal': 'number',
    'float': 'number',
    'integer': 'number',
    'bigint': 'bigint',
  };
  return map[type] || 'any';
}

function fieldTypeToDb(type: string, orm: string = 'typeorm'): string {
  const typeormMap: Record<string, string> = {
    'string': 'varchar',
    'number': 'int',
    'boolean': 'boolean',
    'date': 'date',
    'datetime': 'timestamp',
    'text': 'text',
    'json': 'jsonb',
    'uuid': 'uuid',
    'email': 'varchar',
    'url': 'varchar',
    'decimal': 'decimal',
    'float': 'float',
    'integer': 'int',
    'bigint': 'bigint',
  };

  const prismaMap: Record<string, string> = {
    'string': 'String',
    'number': 'Int',
    'boolean': 'Boolean',
    'date': 'DateTime',
    'datetime': 'DateTime',
    'text': 'String',
    'json': 'Json',
    'uuid': 'String',
    'email': 'String',
    'url': 'String',
    'decimal': 'Decimal',
    'float': 'Float',
    'integer': 'Int',
    'bigint': 'BigInt',
  };

  return orm === 'prisma' ? (prismaMap[type] || 'String') : (typeormMap[type] || 'varchar');
}

function generateValidatorDecorators(field: any): string {
  const decorators: string[] = [];

  if (field.required !== false) {
    decorators.push('@IsNotEmpty()');
  } else {
    decorators.push('@IsOptional()');
  }

  switch (field.type) {
    case 'string':
    case 'text':
      decorators.push('@IsString()');
      break;
    case 'email':
      decorators.push('@IsEmail()');
      break;
    case 'url':
      decorators.push('@IsUrl()');
      break;
    case 'uuid':
      decorators.push('@IsUUID()');
      break;
    case 'number':
    case 'integer':
    case 'float':
    case 'decimal':
      decorators.push('@IsNumber()');
      break;
    case 'boolean':
      decorators.push('@IsBoolean()');
      break;
    case 'date':
    case 'datetime':
      decorators.push('@IsDate()');
      break;
  }

  return decorators.join('\n  ');
}

function generateColumnDecorator(field: any): string {
  const options: string[] = [];
  if (field.type) options.push(`type: '${fieldTypeToDb(field.type)}'`);
  if (field.nullable) options.push('nullable: true');
  if (field.unique) options.push('unique: true');
  if (field.default !== undefined) {
    const val = typeof field.default === 'string' ? `'${field.default}'` : field.default;
    options.push(`default: ${val}`);
  }
  return options.length > 0 ? `@Column({ ${options.join(', ')} })` : '@Column()';
}

function calculateImportPath(from: string, to: string): string {
  const fromDir = path.dirname(from);
  const relativePath = path.relative(fromDir, to);
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function formatDateString(date: Date, format: string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return format
    .replace('YYYY', date.getFullYear().toString())
    .replace('MM', pad(date.getMonth() + 1))
    .replace('DD', pad(date.getDate()))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()));
}
