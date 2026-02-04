import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import Handlebars from 'handlebars';

export interface TemplateDebugOptions {
  template?: string;
  data?: string;
  output?: string;
  validate?: boolean;
  listHelpers?: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: Array<{
    line: number;
    column: number;
    message: string;
    context?: string;
  }>;
  warnings: Array<{
    line: number;
    message: string;
  }>;
  variables: string[];
  helpers: string[];
  partials: string[];
}

export async function debugTemplate(basePath: string, options: TemplateDebugOptions): Promise<void> {
  console.log(chalk.bold.blue('\n🔧 Template Debugger\n'));

  if (options.listHelpers) {
    listRegisteredHelpers();
    return;
  }

  if (options.validate && options.template) {
    await validateTemplate(options.template);
    return;
  }

  if (options.template && options.data) {
    await previewTemplate(options.template, options.data, options.output);
    return;
  }

  // Default: scan all templates in project
  await scanTemplates(basePath);
}

function listRegisteredHelpers(): void {
  console.log(chalk.cyan('Built-in Handlebars Helpers:'));
  const builtIn = ['if', 'unless', 'each', 'with', 'lookup', 'log'];
  builtIn.forEach(h => console.log(chalk.gray(`  • ${h}`)));

  console.log(chalk.cyan('\nCustom DDD CLI Helpers:'));
  const customHelpers = [
    { name: 'toPascalCase', desc: 'Convert string to PascalCase' },
    { name: 'toCamelCase', desc: 'Convert string to camelCase' },
    { name: 'toKebabCase', desc: 'Convert string to kebab-case' },
    { name: 'toSnakeCase', desc: 'Convert string to snake_case' },
    { name: 'toUpperCase', desc: 'Convert string to UPPERCASE' },
    { name: 'toLowerCase', desc: 'Convert string to lowercase' },
    { name: 'pluralize', desc: 'Convert to plural form' },
    { name: 'singularize', desc: 'Convert to singular form' },
    { name: 'eq', desc: 'Equality comparison' },
    { name: 'ne', desc: 'Not equal comparison' },
    { name: 'or', desc: 'Logical OR' },
    { name: 'and', desc: 'Logical AND' },
    { name: 'not', desc: 'Logical NOT' },
    { name: 'includes', desc: 'Check if array includes value' },
    { name: 'json', desc: 'Stringify to JSON' },
    { name: 'default', desc: 'Default value if falsy' },
  ];

  customHelpers.forEach(h => {
    console.log(`  ${chalk.green(h.name.padEnd(15))} ${chalk.gray(h.desc)}`);
  });
}

async function validateTemplate(templatePath: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    variables: [],
    helpers: [],
    partials: [],
  };

  if (!fs.existsSync(templatePath)) {
    console.log(chalk.red(`❌ Template file not found: ${templatePath}`));
    result.valid = false;
    result.errors.push({
      line: 0,
      column: 0,
      message: 'Template file not found',
    });
    return result;
  }

  const content = fs.readFileSync(templatePath, 'utf-8');
  const lines = content.split('\n');

  console.log(chalk.cyan(`Validating: ${templatePath}\n`));

  // Try to compile the template
  try {
    const compiled = Handlebars.precompile(content);
    console.log(chalk.green('✓ Template syntax is valid'));
  } catch (error: any) {
    result.valid = false;

    const match = error.message.match(/Parse error on line (\d+)/);
    const line = match ? parseInt(match[1], 10) : 1;

    result.errors.push({
      line,
      column: 0,
      message: error.message,
      context: lines[line - 1],
    });

    console.log(chalk.red('✗ Template has syntax errors:\n'));
    console.log(chalk.red(`  Line ${line}: ${error.message}`));
    if (lines[line - 1]) {
      console.log(chalk.gray(`  > ${lines[line - 1]}`));
    }
  }

  // Extract variables
  const variablePattern = /\{\{(?!#|\/|!|>)([^}]+)\}\}/g;
  let match;
  while ((match = variablePattern.exec(content)) !== null) {
    const variable = match[1].trim().split(' ')[0];
    if (!result.variables.includes(variable)) {
      result.variables.push(variable);
    }
  }

  // Extract helpers
  const helperPattern = /\{\{#?(\w+)\s/g;
  while ((match = helperPattern.exec(content)) !== null) {
    const helper = match[1];
    if (!['if', 'unless', 'each', 'with'].includes(helper)) {
      if (!result.helpers.includes(helper)) {
        result.helpers.push(helper);
      }
    }
  }

  // Extract partials
  const partialPattern = /\{\{>\s*(\w+)/g;
  while ((match = partialPattern.exec(content)) !== null) {
    const partial = match[1];
    if (!result.partials.includes(partial)) {
      result.partials.push(partial);
    }
  }

  // Check for common issues
  checkCommonIssues(content, lines, result);

  // Print analysis
  if (result.variables.length > 0) {
    console.log(chalk.cyan('\nVariables used:'));
    result.variables.forEach(v => console.log(chalk.gray(`  • ${v}`)));
  }

  if (result.helpers.length > 0) {
    console.log(chalk.cyan('\nCustom helpers used:'));
    result.helpers.forEach(h => console.log(chalk.gray(`  • ${h}`)));
  }

  if (result.partials.length > 0) {
    console.log(chalk.cyan('\nPartials referenced:'));
    result.partials.forEach(p => console.log(chalk.gray(`  • ${p}`)));
  }

  if (result.warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️  Warnings:'));
    result.warnings.forEach(w => {
      console.log(chalk.yellow(`  Line ${w.line}: ${w.message}`));
    });
  }

  return result;
}

function checkCommonIssues(content: string, lines: string[], result: ValidationResult): void {
  // Check for unclosed blocks
  const blockOpeners = ['#if', '#unless', '#each', '#with'];
  const blockClosers = ['/if', '/unless', '/each', '/with'];

  const stack: Array<{ type: string; line: number }> = [];

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Find block openers
    for (const opener of blockOpeners) {
      if (line.includes(`{{${opener}`)) {
        stack.push({ type: opener.substring(1), line: lineNum });
      }
    }

    // Find block closers
    for (const closer of blockClosers) {
      if (line.includes(`{{${closer}`)) {
        const expected = closer.substring(1);
        const last = stack.pop();

        if (!last) {
          result.warnings.push({
            line: lineNum,
            message: `Unexpected closing tag: {{${closer}}}`,
          });
        } else if (last.type !== expected) {
          result.warnings.push({
            line: lineNum,
            message: `Mismatched block: expected {{/${last.type}}}, found {{${closer}}}`,
          });
        }
      }
    }
  });

  // Check for unclosed blocks
  for (const unclosed of stack) {
    result.warnings.push({
      line: unclosed.line,
      message: `Unclosed block: {{#${unclosed.type}}}`,
    });
  }

  // Check for triple braces (unescaped)
  lines.forEach((line, index) => {
    if (line.includes('{{{')) {
      result.warnings.push({
        line: index + 1,
        message: 'Unescaped output {{{...}}} - ensure this is intentional',
      });
    }
  });

  // Check for missing spaces in helpers
  const badHelperPattern = /\{\{#\w+[^\s}]/g;
  let match;
  while ((match = badHelperPattern.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split('\n').length;
    result.warnings.push({
      line: lineNum,
      message: 'Helper may be missing space before argument',
    });
  }
}

async function previewTemplate(templatePath: string, dataPath: string, outputPath?: string): Promise<void> {
  if (!fs.existsSync(templatePath)) {
    console.log(chalk.red(`❌ Template not found: ${templatePath}`));
    return;
  }

  if (!fs.existsSync(dataPath)) {
    console.log(chalk.red(`❌ Data file not found: ${dataPath}`));
    return;
  }

  const templateContent = fs.readFileSync(templatePath, 'utf-8');
  let data: any;

  try {
    data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  } catch (error) {
    console.log(chalk.red('❌ Invalid JSON in data file'));
    return;
  }

  // Register common helpers
  registerHelpers();

  try {
    const template = Handlebars.compile(templateContent);
    const output = template(data);

    if (outputPath) {
      fs.writeFileSync(outputPath, output);
      console.log(chalk.green(`✓ Output written to: ${outputPath}`));
    } else {
      console.log(chalk.cyan('Preview output:\n'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(output);
      console.log(chalk.gray('─'.repeat(50)));
    }
  } catch (error: any) {
    console.log(chalk.red('❌ Template rendering failed:'));
    console.log(chalk.red(`  ${error.message}`));
  }
}

async function scanTemplates(basePath: string): Promise<void> {
  const templatesPath = path.join(basePath, 'src/templates');
  const customTemplatesPath = path.join(basePath, '.ddd/templates');

  const paths = [templatesPath, customTemplatesPath].filter(fs.existsSync);

  if (paths.length === 0) {
    console.log(chalk.yellow('No template directories found.'));
    return;
  }

  console.log(chalk.cyan('Scanning templates...\n'));

  let totalTemplates = 0;
  let validTemplates = 0;
  let invalidTemplates = 0;

  for (const templatesDir of paths) {
    const templates = findTemplateFiles(templatesDir);

    for (const template of templates) {
      totalTemplates++;
      const relativePath = path.relative(basePath, template);

      try {
        const content = fs.readFileSync(template, 'utf-8');
        Handlebars.precompile(content);
        validTemplates++;
        console.log(chalk.green(`  ✓ ${relativePath}`));
      } catch (error: any) {
        invalidTemplates++;
        console.log(chalk.red(`  ✗ ${relativePath}`));
        console.log(chalk.gray(`    ${error.message.split('\n')[0]}`));
      }
    }
  }

  console.log(chalk.bold('\n─────────────────────────────────────'));
  console.log(chalk.bold('Summary:'));
  console.log(chalk.green(`  Valid: ${validTemplates}`));
  console.log(chalk.red(`  Invalid: ${invalidTemplates}`));
  console.log(chalk.gray(`  Total: ${totalTemplates}`));
}

function findTemplateFiles(dir: string): string[] {
  const files: string[] = [];

  function scan(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (
        entry.name.endsWith('.hbs') ||
        entry.name.endsWith('.handlebars') ||
        entry.name.endsWith('.template')
      ) {
        files.push(fullPath);
      }
    }
  }

  scan(dir);
  return files;
}

function registerHelpers(): void {
  // Case conversion helpers
  Handlebars.registerHelper('toPascalCase', (str: string) => {
    if (!str) return '';
    return str
      .split(/[-_\s]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
  });

  Handlebars.registerHelper('toCamelCase', (str: string) => {
    if (!str) return '';
    const pascal = str
      .split(/[-_\s]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  });

  Handlebars.registerHelper('toKebabCase', (str: string) => {
    if (!str) return '';
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  });

  Handlebars.registerHelper('toSnakeCase', (str: string) => {
    if (!str) return '';
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
  });

  Handlebars.registerHelper('toUpperCase', (str: string) => str?.toUpperCase() || '');
  Handlebars.registerHelper('toLowerCase', (str: string) => str?.toLowerCase() || '');

  // Comparison helpers
  Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
  Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
  Handlebars.registerHelper('or', (...args: any[]) => args.slice(0, -1).some(Boolean));
  Handlebars.registerHelper('and', (...args: any[]) => args.slice(0, -1).every(Boolean));
  Handlebars.registerHelper('not', (a: any) => !a);

  // Array helpers
  Handlebars.registerHelper('includes', (arr: any[], value: any) => arr?.includes(value));

  // Utility helpers
  Handlebars.registerHelper('json', (obj: any) => JSON.stringify(obj, null, 2));
  Handlebars.registerHelper('default', (value: any, defaultValue: any) => value || defaultValue);
}

// Export for testing
export { validateTemplate, registerHelpers };
