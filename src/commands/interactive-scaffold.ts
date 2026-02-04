import chalk from 'chalk';
import inquirer from 'inquirer';
import { generateAll } from './generate-all';
import { toKebabCase, toPascalCase } from '../utils/naming.utils';
import * as fs from 'fs-extra';
import * as path from 'path';

interface InteractiveOptions {
  path?: string;
}

interface FieldInput {
  name: string;
  type: string;
  modifiers: string[];
}

const FIELD_TYPES = [
  { name: 'string - Text field', value: 'string' },
  { name: 'number - Integer number', value: 'number' },
  { name: 'float - Decimal number', value: 'float' },
  { name: 'boolean - True/False', value: 'boolean' },
  { name: 'date - Date only', value: 'date' },
  { name: 'datetime - Date and time', value: 'datetime' },
  { name: 'uuid - UUID reference', value: 'uuid' },
  { name: 'text - Long text', value: 'text' },
  { name: 'json - JSON object', value: 'json' },
  { name: 'enum - Enumerated values', value: 'enum' },
];

const FIELD_MODIFIERS = [
  { name: 'required (default)', value: 'required', checked: true },
  { name: 'optional - Field can be null', value: 'optional', checked: false },
  { name: 'unique - Must be unique in database', value: 'unique', checked: false },
  { name: 'relation - Foreign key reference', value: 'relation', checked: false },
];

export async function interactiveScaffold(options: InteractiveOptions) {
  console.log(chalk.blue('\n🧙 NestJS DDD Scaffold Wizard\n'));
  console.log(chalk.gray('This wizard will guide you through creating a complete CRUD module.\n'));

  const basePath = options.path || process.cwd();

  // Step 1: Entity name
  const { entityName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'entityName',
      message: 'What is the name of your entity?',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Entity name is required';
        }
        if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(input)) {
          return 'Entity name must start with a letter and contain only alphanumeric characters';
        }
        return true;
      },
      transformer: (input: string) => toPascalCase(input),
    },
  ]);

  // Step 2: Module name
  const existingModules = await getExistingModules(basePath);
  const moduleChoices = [
    { name: `Create new module: ${toKebabCase(entityName)}`, value: '__new__' },
    ...existingModules.map(m => ({ name: `Use existing: ${m}`, value: m })),
  ];

  const { moduleChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'moduleChoice',
      message: 'Which module should contain this entity?',
      choices: moduleChoices,
    },
  ]);

  let moduleName = moduleChoice;
  if (moduleChoice === '__new__') {
    const { newModuleName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newModuleName',
        message: 'Enter new module name:',
        default: entityName,
        validate: (input: string) => {
          if (!input || input.trim() === '') {
            return 'Module name is required';
          }
          return true;
        },
      },
    ]);
    moduleName = newModuleName;
  }

  // Step 3: ORM choice
  const { orm } = await inquirer.prompt([
    {
      type: 'list',
      name: 'orm',
      message: 'Which ORM do you want to use?',
      choices: [
        { name: 'TypeORM - Traditional ORM with decorators', value: 'typeorm' },
        { name: 'Prisma - Modern type-safe database client', value: 'prisma' },
      ],
      default: 'typeorm',
    },
  ]);

  // Step 4: Fields
  const fields: FieldInput[] = [];
  let addMoreFields = true;

  console.log(chalk.cyan('\n📝 Define entity fields'));
  console.log(chalk.gray('(Press enter with empty name to finish adding fields)\n'));

  while (addMoreFields) {
    const { fieldName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'fieldName',
        message: `Field ${fields.length + 1} name (empty to finish):`,
        validate: (input: string) => {
          if (input && !/^[a-zA-Z][a-zA-Z0-9]*$/.test(input)) {
            return 'Field name must start with a letter and contain only alphanumeric characters';
          }
          return true;
        },
      },
    ]);

    if (!fieldName || fieldName.trim() === '') {
      addMoreFields = false;
      continue;
    }

    const { fieldType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'fieldType',
        message: `Type for "${fieldName}":`,
        choices: FIELD_TYPES,
      },
    ]);

    // Handle enum values
    let enumValues: string[] = [];
    if (fieldType === 'enum') {
      const { enumValuesInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'enumValuesInput',
          message: 'Enter enum values (comma-separated):',
          validate: (input: string) => {
            if (!input || input.trim() === '') {
              return 'At least one enum value is required';
            }
            return true;
          },
        },
      ]);
      enumValues = enumValuesInput.split(',').map((v: string) => v.trim());
    }

    const { fieldModifiers } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'fieldModifiers',
        message: `Modifiers for "${fieldName}":`,
        choices: FIELD_MODIFIERS,
      },
    ]);

    // Process modifiers
    const modifiers: string[] = [];
    if (fieldModifiers.includes('optional')) modifiers.push('optional');
    if (fieldModifiers.includes('unique')) modifiers.push('unique');
    if (fieldModifiers.includes('relation')) modifiers.push('relation');
    if (enumValues.length > 0) modifiers.push(enumValues.join(','));

    fields.push({
      name: fieldName,
      type: fieldType,
      modifiers,
    });

    console.log(chalk.green(`  ✓ Added field: ${fieldName}: ${fieldType}${modifiers.length > 0 ? ' [' + modifiers.join(', ') + ']' : ''}`));
  }

  // Step 5: Additional options
  const { additionalOptions } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'additionalOptions',
      message: 'Additional options:',
      choices: [
        { name: 'Generate unit tests', value: 'withTests', checked: false },
        { name: 'Include domain events', value: 'withEvents', checked: false },
        { name: 'Include query handlers', value: 'withQueries', checked: true },
        { name: 'Install dependencies', value: 'installDeps', checked: false },
      ],
    },
  ]);

  // Step 6: Confirmation
  console.log(chalk.cyan('\n📋 Summary\n'));
  console.log(`  ${chalk.white('Entity:')} ${toPascalCase(entityName)}`);
  console.log(`  ${chalk.white('Module:')} ${toKebabCase(moduleName)}`);
  console.log(`  ${chalk.white('ORM:')} ${orm === 'prisma' ? 'Prisma' : 'TypeORM'}`);
  console.log(`  ${chalk.white('Fields:')} ${fields.length > 0 ? fields.map(f => f.name).join(', ') : '(none)'}`);
  console.log(`  ${chalk.white('Options:')} ${additionalOptions.length > 0 ? additionalOptions.join(', ') : '(none)'}`);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Generate scaffolding with these settings?',
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\n✖ Scaffold cancelled.'));
    return;
  }

  // Build fields string
  const fieldsString = fields
    .map(f => {
      let fieldStr = `${f.name}:${f.type}`;
      if (f.modifiers.length > 0) {
        fieldStr += ':' + f.modifiers.join(':');
      }
      return fieldStr;
    })
    .join(' ');

  // Run scaffold
  await generateAll(entityName, {
    module: moduleName,
    path: basePath,
    fields: fieldsString,
    orm,
    withTests: additionalOptions.includes('withTests'),
    withEvents: additionalOptions.includes('withEvents'),
    withQueries: additionalOptions.includes('withQueries'),
    installDeps: additionalOptions.includes('installDeps'),
    complete: true,
  });
}

async function getExistingModules(basePath: string): Promise<string[]> {
  const modulesPath = path.join(basePath, 'src/modules');

  if (!(await fs.pathExists(modulesPath))) {
    return [];
  }

  const entries = await fs.readdir(modulesPath, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
}
