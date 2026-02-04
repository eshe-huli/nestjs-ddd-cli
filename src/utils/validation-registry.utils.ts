/**
 * Comprehensive Input Validation & Schema Registry
 * Provides reusable validation rules and cross-field validation
 */

export interface ValidationRule {
  name: string;
  type: 'single' | 'cross-field' | 'conditional' | 'async';
  validator: string; // class-validator decorator or custom function
  message?: string;
  options?: Record<string, any>;
}

export interface ValidationSchema {
  name: string;
  rules: Record<string, ValidationRule[]>;
  crossFieldRules?: CrossFieldRule[];
}

export interface CrossFieldRule {
  name: string;
  fields: string[];
  condition: string;
  message: string;
}

export interface ValidatorDefinition {
  name: string;
  decorator: string;
  imports: string[];
  options?: string;
}

/**
 * Built-in validation rules registry
 */
export const BuiltInValidators: Record<string, ValidatorDefinition> = {
  // String validators
  'required': {
    name: 'required',
    decorator: '@IsNotEmpty()',
    imports: ['IsNotEmpty'],
  },
  'optional': {
    name: 'optional',
    decorator: '@IsOptional()',
    imports: ['IsOptional'],
  },
  'string': {
    name: 'string',
    decorator: '@IsString()',
    imports: ['IsString'],
  },
  'email': {
    name: 'email',
    decorator: '@IsEmail()',
    imports: ['IsEmail'],
  },
  'url': {
    name: 'url',
    decorator: '@IsUrl()',
    imports: ['IsUrl'],
  },
  'uuid': {
    name: 'uuid',
    decorator: '@IsUUID()',
    imports: ['IsUUID'],
  },
  'alpha': {
    name: 'alpha',
    decorator: '@IsAlpha()',
    imports: ['IsAlpha'],
  },
  'alphanumeric': {
    name: 'alphanumeric',
    decorator: '@IsAlphanumeric()',
    imports: ['IsAlphanumeric'],
  },
  'lowercase': {
    name: 'lowercase',
    decorator: '@IsLowercase()',
    imports: ['IsLowercase'],
  },
  'uppercase': {
    name: 'uppercase',
    decorator: '@IsUppercase()',
    imports: ['IsUppercase'],
  },

  // Number validators
  'number': {
    name: 'number',
    decorator: '@IsNumber()',
    imports: ['IsNumber'],
  },
  'int': {
    name: 'int',
    decorator: '@IsInt()',
    imports: ['IsInt'],
  },
  'positive': {
    name: 'positive',
    decorator: '@IsPositive()',
    imports: ['IsPositive'],
  },
  'negative': {
    name: 'negative',
    decorator: '@IsNegative()',
    imports: ['IsNegative'],
  },

  // Boolean validators
  'boolean': {
    name: 'boolean',
    decorator: '@IsBoolean()',
    imports: ['IsBoolean'],
  },

  // Date validators
  'date': {
    name: 'date',
    decorator: '@IsDate()',
    imports: ['IsDate'],
  },
  'dateString': {
    name: 'dateString',
    decorator: '@IsDateString()',
    imports: ['IsDateString'],
  },

  // Array validators
  'array': {
    name: 'array',
    decorator: '@IsArray()',
    imports: ['IsArray'],
  },

  // Object validators
  'object': {
    name: 'object',
    decorator: '@IsObject()',
    imports: ['IsObject'],
  },
  'nested': {
    name: 'nested',
    decorator: '@ValidateNested()',
    imports: ['ValidateNested'],
  },

  // Other validators
  'json': {
    name: 'json',
    decorator: '@IsJSON()',
    imports: ['IsJSON'],
  },
  'jwt': {
    name: 'jwt',
    decorator: '@IsJWT()',
    imports: ['IsJWT'],
  },
  'creditCard': {
    name: 'creditCard',
    decorator: '@IsCreditCard()',
    imports: ['IsCreditCard'],
  },
  'phone': {
    name: 'phone',
    decorator: '@IsPhoneNumber()',
    imports: ['IsPhoneNumber'],
  },
  'ip': {
    name: 'ip',
    decorator: '@IsIP()',
    imports: ['IsIP'],
  },
};

/**
 * Parameterized validators
 */
export const ParameterizedValidators: Record<string, (options: any) => ValidatorDefinition> = {
  'minLength': (min: number) => ({
    name: 'minLength',
    decorator: `@MinLength(${min})`,
    imports: ['MinLength'],
  }),
  'maxLength': (max: number) => ({
    name: 'maxLength',
    decorator: `@MaxLength(${max})`,
    imports: ['MaxLength'],
  }),
  'length': (options: { min?: number; max?: number }) => ({
    name: 'length',
    decorator: `@Length(${options.min || 0}, ${options.max || 255})`,
    imports: ['Length'],
  }),
  'min': (min: number) => ({
    name: 'min',
    decorator: `@Min(${min})`,
    imports: ['Min'],
  }),
  'max': (max: number) => ({
    name: 'max',
    decorator: `@Max(${max})`,
    imports: ['Max'],
  }),
  'matches': (pattern: string) => ({
    name: 'matches',
    decorator: `@Matches(/${pattern}/)`,
    imports: ['Matches'],
  }),
  'isIn': (values: any[]) => ({
    name: 'isIn',
    decorator: `@IsIn([${values.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ')}])`,
    imports: ['IsIn'],
  }),
  'isNotIn': (values: any[]) => ({
    name: 'isNotIn',
    decorator: `@IsNotIn([${values.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ')}])`,
    imports: ['IsNotIn'],
  }),
  'arrayMinSize': (min: number) => ({
    name: 'arrayMinSize',
    decorator: `@ArrayMinSize(${min})`,
    imports: ['ArrayMinSize'],
  }),
  'arrayMaxSize': (max: number) => ({
    name: 'arrayMaxSize',
    decorator: `@ArrayMaxSize(${max})`,
    imports: ['ArrayMaxSize'],
  }),
  'arrayUnique': () => ({
    name: 'arrayUnique',
    decorator: '@ArrayUnique()',
    imports: ['ArrayUnique'],
  }),
  'equals': (value: any) => ({
    name: 'equals',
    decorator: `@Equals(${typeof value === 'string' ? `'${value}'` : value})`,
    imports: ['Equals'],
  }),
  'notEquals': (value: any) => ({
    name: 'notEquals',
    decorator: `@NotEquals(${typeof value === 'string' ? `'${value}'` : value})`,
    imports: ['NotEquals'],
  }),
};

/**
 * Custom validation registry
 */
export class ValidationRegistry {
  private validators: Map<string, ValidatorDefinition> = new Map();
  private schemas: Map<string, ValidationSchema> = new Map();

  constructor() {
    // Register built-in validators
    for (const [name, def] of Object.entries(BuiltInValidators)) {
      this.validators.set(name, def);
    }
  }

  /**
   * Register a custom validator
   */
  registerValidator(name: string, definition: ValidatorDefinition): void {
    this.validators.set(name, definition);
  }

  /**
   * Get a validator by name
   */
  getValidator(name: string): ValidatorDefinition | undefined {
    return this.validators.get(name);
  }

  /**
   * Register a validation schema
   */
  registerSchema(name: string, schema: ValidationSchema): void {
    this.schemas.set(name, schema);
  }

  /**
   * Get a schema by name
   */
  getSchema(name: string): ValidationSchema | undefined {
    return this.schemas.get(name);
  }

  /**
   * Generate validation decorators for a field
   */
  generateDecorators(
    field: {
      name: string;
      type: string;
      required?: boolean;
      validators?: string[];
      validationOptions?: Record<string, any>;
    }
  ): { decorators: string[]; imports: Set<string> } {
    const decorators: string[] = [];
    const imports = new Set<string>();

    // Required/Optional
    if (field.required !== false) {
      decorators.push('@IsNotEmpty()');
      imports.add('IsNotEmpty');
    } else {
      decorators.push('@IsOptional()');
      imports.add('IsOptional');
    }

    // Type-based validators
    const typeValidator = this.getTypeValidator(field.type);
    if (typeValidator) {
      decorators.push(typeValidator.decorator);
      typeValidator.imports.forEach(i => imports.add(i));
    }

    // Additional validators
    if (field.validators) {
      for (const validatorName of field.validators) {
        const validator = this.resolveValidator(validatorName, field.validationOptions);
        if (validator) {
          decorators.push(validator.decorator);
          validator.imports.forEach(i => imports.add(i));
        }
      }
    }

    // Validation options (min, max, minLength, maxLength, etc.)
    if (field.validationOptions) {
      const opts = field.validationOptions;

      if (opts.minLength !== undefined) {
        decorators.push(`@MinLength(${opts.minLength})`);
        imports.add('MinLength');
      }
      if (opts.maxLength !== undefined) {
        decorators.push(`@MaxLength(${opts.maxLength})`);
        imports.add('MaxLength');
      }
      if (opts.min !== undefined) {
        decorators.push(`@Min(${opts.min})`);
        imports.add('Min');
      }
      if (opts.max !== undefined) {
        decorators.push(`@Max(${opts.max})`);
        imports.add('Max');
      }
      if (opts.pattern) {
        decorators.push(`@Matches(/${opts.pattern}/)`);
        imports.add('Matches');
      }
      if (opts.enum) {
        const values = opts.enum.map((v: string) => `'${v}'`).join(', ');
        decorators.push(`@IsIn([${values}])`);
        imports.add('IsIn');
      }
    }

    return { decorators, imports };
  }

  /**
   * Get type-based validator
   */
  private getTypeValidator(type: string): ValidatorDefinition | undefined {
    const typeMap: Record<string, string> = {
      'string': 'string',
      'text': 'string',
      'email': 'email',
      'url': 'url',
      'uuid': 'uuid',
      'number': 'number',
      'integer': 'int',
      'int': 'int',
      'float': 'number',
      'decimal': 'number',
      'boolean': 'boolean',
      'bool': 'boolean',
      'date': 'date',
      'datetime': 'date',
      'json': 'object',
      'array': 'array',
    };

    const validatorName = typeMap[type.toLowerCase()];
    return validatorName ? this.validators.get(validatorName) : undefined;
  }

  /**
   * Resolve validator with options
   */
  private resolveValidator(
    name: string,
    options?: Record<string, any>
  ): ValidatorDefinition | undefined {
    // Check for parameterized validator
    const paramMatch = name.match(/^(\w+)\((.+)\)$/);
    if (paramMatch) {
      const [, validatorName, params] = paramMatch;
      const factory = ParameterizedValidators[validatorName];
      if (factory) {
        try {
          const parsedParams = JSON.parse(params);
          return factory(parsedParams);
        } catch {
          return factory(params);
        }
      }
    }

    // Check for option-based parameterized validator
    if (options && ParameterizedValidators[name]) {
      return ParameterizedValidators[name](options[name]);
    }

    // Return built-in validator
    return this.validators.get(name);
  }
}

/**
 * Generate cross-field validation decorator
 */
export function generateCrossFieldValidator(rule: CrossFieldRule): string {
  return `
@ValidatorConstraint({ name: '${toCamelCase(rule.name)}', async: false })
export class ${toPascalCase(rule.name)}Constraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    return ${rule.condition};
  }

  defaultMessage(args: ValidationArguments) {
    return '${rule.message}';
  }
}

export function ${toPascalCase(rule.name)}(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: ${toPascalCase(rule.name)}Constraint,
    });
  };
}
`;
}

/**
 * Generate DTO class with validation
 */
export function generateValidatedDTO(
  name: string,
  fields: Array<{
    name: string;
    type: string;
    required?: boolean;
    validators?: string[];
    validationOptions?: Record<string, any>;
    description?: string;
  }>,
  registry: ValidationRegistry = new ValidationRegistry()
): { content: string; imports: string[] } {
  const allImports = new Set<string>();
  const fieldDefs: string[] = [];

  for (const field of fields) {
    const { decorators, imports } = registry.generateDecorators(field);
    imports.forEach(i => allImports.add(i));

    // Add Swagger decorator if description provided
    if (field.description) {
      allImports.add('ApiProperty');
    }

    const fieldLines: string[] = [];

    if (field.description) {
      fieldLines.push(`  @ApiProperty({ description: '${field.description}' })`);
    }

    for (const decorator of decorators) {
      fieldLines.push(`  ${decorator}`);
    }

    const tsType = fieldTypeToTs(field.type);
    const optionalMark = field.required === false ? '?' : '';
    fieldLines.push(`  ${field.name}${optionalMark}: ${tsType};`);

    fieldDefs.push(fieldLines.join('\n'));
  }

  const importStatements: string[] = [];

  // class-validator imports
  const validatorImports = [...allImports].filter(i => i !== 'ApiProperty');
  if (validatorImports.length > 0) {
    importStatements.push(`import { ${validatorImports.join(', ')} } from 'class-validator';`);
  }

  // Swagger imports
  if (allImports.has('ApiProperty')) {
    importStatements.push(`import { ApiProperty } from '@nestjs/swagger';`);
  }

  const content = `${importStatements.join('\n')}

export class ${name} {
${fieldDefs.join('\n\n')}
}
`;

  return { content, imports: importStatements };
}

// Helper functions
function toCamelCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^(.)/, c => c.toLowerCase());
}

function toPascalCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^(.)/, c => c.toUpperCase());
}

function fieldTypeToTs(type: string): string {
  const map: Record<string, string> = {
    'string': 'string',
    'text': 'string',
    'email': 'string',
    'url': 'string',
    'uuid': 'string',
    'number': 'number',
    'integer': 'number',
    'int': 'number',
    'float': 'number',
    'decimal': 'number',
    'boolean': 'boolean',
    'bool': 'boolean',
    'date': 'Date',
    'datetime': 'Date',
    'json': 'Record<string, any>',
    'array': 'any[]',
  };
  return map[type.toLowerCase()] || 'any';
}

/**
 * Common validation presets
 */
export const ValidationPresets = {
  email: {
    validators: ['email', 'maxLength(255)'],
    validationOptions: { maxLength: 255 },
  },
  password: {
    validators: ['string', 'minLength(8)', 'maxLength(100)'],
    validationOptions: {
      minLength: 8,
      maxLength: 100,
      pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)',
    },
  },
  username: {
    validators: ['string', 'minLength(3)', 'maxLength(50)', 'matches(^[a-zA-Z0-9_]+$)'],
    validationOptions: {
      minLength: 3,
      maxLength: 50,
      pattern: '^[a-zA-Z0-9_]+$',
    },
  },
  phone: {
    validators: ['phone'],
  },
  url: {
    validators: ['url', 'maxLength(2048)'],
    validationOptions: { maxLength: 2048 },
  },
  uuid: {
    validators: ['uuid'],
  },
  positiveNumber: {
    validators: ['number', 'positive'],
  },
  pagination: {
    page: {
      validators: ['int', 'min(1)'],
      validationOptions: { min: 1 },
    },
    limit: {
      validators: ['int', 'min(1)', 'max(100)'],
      validationOptions: { min: 1, max: 100 },
    },
  },
};

/**
 * Create validation registry with presets
 */
export function createValidationRegistry(): ValidationRegistry {
  return new ValidationRegistry();
}
