/**
 * Type-Safe Field Schema System
 * Provides structured field definitions with validation guarantees
 */

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'text'
  | 'json'
  | 'uuid'
  | 'email'
  | 'url'
  | 'enum'
  | 'decimal'
  | 'float'
  | 'integer'
  | 'bigint';

export type FieldModifier =
  | 'optional'
  | 'unique'
  | 'index'
  | 'primary'
  | 'generated'
  | 'nullable'
  | 'readonly';

export type RelationType =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many';

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  email?: boolean;
  url?: boolean;
  uuid?: boolean;
  enum?: string[];
  custom?: string; // Custom validator name
}

export interface FieldSchema {
  name: string;
  type: FieldType;
  modifiers: FieldModifier[];
  validation: FieldValidation;
  description?: string;
  defaultValue?: string | number | boolean;
  enumValues?: string[];
  length?: number;
  precision?: number;
  scale?: number;
}

export interface RelationSchema {
  name: string;
  type: RelationType;
  target: string;
  inverseSide?: string;
  joinColumn?: string;
  joinTable?: string;
  cascade?: ('insert' | 'update' | 'remove' | 'soft-remove' | 'recover')[];
  eager?: boolean;
  nullable?: boolean;
  onDelete?: 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT';
}

export interface EntitySchema {
  name: string;
  tableName?: string;
  fields: FieldSchema[];
  relations: RelationSchema[];
  indexes?: IndexSchema[];
  timestamps?: boolean;
  softDelete?: boolean;
  audit?: boolean;
}

export interface IndexSchema {
  name?: string;
  columns: string[];
  unique?: boolean;
  where?: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaError[];
  warnings: SchemaWarning[];
}

export interface SchemaError {
  path: string;
  message: string;
  code: string;
}

export interface SchemaWarning {
  path: string;
  message: string;
  suggestion?: string;
}

/**
 * Parse field string into structured FieldSchema
 * Format: name:type:modifier1:modifier2
 * Examples:
 *   - email:string:unique
 *   - age:number:optional
 *   - status:enum(active,inactive,pending)
 *   - price:decimal(10,2)
 */
export function parseFieldString(fieldStr: string): FieldSchema {
  const parts = fieldStr.split(':');
  const name = parts[0];
  let typeStr = parts[1] || 'string';
  const modifierStrs = parts.slice(2);

  // Parse type with parameters
  let type: FieldType = 'string';
  let enumValues: string[] | undefined;
  let length: number | undefined;
  let precision: number | undefined;
  let scale: number | undefined;

  const enumMatch = typeStr.match(/^enum\(([^)]+)\)$/i);
  const decimalMatch = typeStr.match(/^decimal\((\d+),(\d+)\)$/i);
  const stringMatch = typeStr.match(/^string\((\d+)\)$/i);

  if (enumMatch) {
    type = 'enum';
    enumValues = enumMatch[1].split(',').map(v => v.trim());
  } else if (decimalMatch) {
    type = 'decimal';
    precision = parseInt(decimalMatch[1], 10);
    scale = parseInt(decimalMatch[2], 10);
  } else if (stringMatch) {
    type = 'string';
    length = parseInt(stringMatch[1], 10);
  } else {
    type = normalizeFieldType(typeStr);
  }

  // Parse modifiers
  const modifiers: FieldModifier[] = [];
  const validation: FieldValidation = { required: true };

  for (const mod of modifierStrs) {
    const normalizedMod = mod.toLowerCase();

    if (isFieldModifier(normalizedMod)) {
      modifiers.push(normalizedMod);

      if (normalizedMod === 'optional' || normalizedMod === 'nullable') {
        validation.required = false;
      }
    }

    // Parse validation modifiers
    const minLenMatch = mod.match(/^minLength\((\d+)\)$/i);
    const maxLenMatch = mod.match(/^maxLength\((\d+)\)$/i);
    const minMatch = mod.match(/^min\((\d+)\)$/i);
    const maxMatch = mod.match(/^max\((\d+)\)$/i);
    const patternMatch = mod.match(/^pattern\(([^)]+)\)$/i);

    if (minLenMatch) validation.minLength = parseInt(minLenMatch[1], 10);
    if (maxLenMatch) validation.maxLength = parseInt(maxLenMatch[1], 10);
    if (minMatch) validation.min = parseInt(minMatch[1], 10);
    if (maxMatch) validation.max = parseInt(maxMatch[1], 10);
    if (patternMatch) validation.pattern = patternMatch[1];
  }

  // Auto-set validation based on type
  if (type === 'email') validation.email = true;
  if (type === 'url') validation.url = true;
  if (type === 'uuid') validation.uuid = true;
  if (enumValues) validation.enum = enumValues;

  return {
    name,
    type,
    modifiers,
    validation,
    enumValues,
    length,
    precision,
    scale,
  };
}

/**
 * Parse multiple field strings
 */
export function parseFieldStrings(fieldsStr: string): FieldSchema[] {
  if (!fieldsStr) return [];

  return fieldsStr
    .split(/\s+/)
    .filter(f => f.trim())
    .map(parseFieldString);
}

/**
 * Normalize type string to FieldType
 */
function normalizeFieldType(typeStr: string): FieldType {
  const typeMap: Record<string, FieldType> = {
    'string': 'string',
    'str': 'string',
    'varchar': 'string',
    'char': 'string',
    'number': 'number',
    'num': 'number',
    'int': 'integer',
    'integer': 'integer',
    'bigint': 'bigint',
    'float': 'float',
    'double': 'float',
    'decimal': 'decimal',
    'boolean': 'boolean',
    'bool': 'boolean',
    'date': 'date',
    'datetime': 'datetime',
    'timestamp': 'datetime',
    'text': 'text',
    'json': 'json',
    'jsonb': 'json',
    'uuid': 'uuid',
    'email': 'email',
    'url': 'url',
    'enum': 'enum',
  };

  return typeMap[typeStr.toLowerCase()] || 'string';
}

/**
 * Check if string is a valid field modifier
 */
function isFieldModifier(str: string): str is FieldModifier {
  const modifiers: FieldModifier[] = [
    'optional', 'unique', 'index', 'primary',
    'generated', 'nullable', 'readonly'
  ];
  return modifiers.includes(str as FieldModifier);
}

/**
 * Convert FieldSchema to TypeScript type
 */
export function fieldToTypeScript(field: FieldSchema): string {
  const typeMap: Record<FieldType, string> = {
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
    'enum': field.enumValues ? field.enumValues.map(v => `'${v}'`).join(' | ') : 'string',
    'decimal': 'number',
    'float': 'number',
    'integer': 'number',
    'bigint': 'bigint',
  };

  let tsType = typeMap[field.type] || 'any';

  if (!field.validation.required) {
    tsType += ' | null';
  }

  return tsType;
}

/**
 * Convert FieldSchema to TypeORM column decorator
 */
export function fieldToTypeORMDecorator(field: FieldSchema): string {
  const options: string[] = [];

  // Type mapping
  const typeMap: Record<FieldType, string> = {
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
    'enum': 'enum',
    'decimal': 'decimal',
    'float': 'float',
    'integer': 'int',
    'bigint': 'bigint',
  };

  const dbType = typeMap[field.type];
  options.push(`type: '${dbType}'`);

  if (field.length) options.push(`length: ${field.length}`);
  if (field.precision) options.push(`precision: ${field.precision}`);
  if (field.scale) options.push(`scale: ${field.scale}`);
  if (field.enumValues) options.push(`enum: [${field.enumValues.map(v => `'${v}'`).join(', ')}]`);
  if (!field.validation.required) options.push('nullable: true');
  if (field.modifiers.includes('unique')) options.push('unique: true');
  if (field.defaultValue !== undefined) {
    const defaultVal = typeof field.defaultValue === 'string'
      ? `'${field.defaultValue}'`
      : field.defaultValue;
    options.push(`default: ${defaultVal}`);
  }

  return `@Column({ ${options.join(', ')} })`;
}

/**
 * Convert FieldSchema to class-validator decorators
 */
export function fieldToValidatorDecorators(field: FieldSchema): string[] {
  const decorators: string[] = [];
  const v = field.validation;

  if (v.required) {
    decorators.push('@IsNotEmpty()');
  } else {
    decorators.push('@IsOptional()');
  }

  switch (field.type) {
    case 'string':
    case 'text':
      decorators.push('@IsString()');
      if (v.minLength) decorators.push(`@MinLength(${v.minLength})`);
      if (v.maxLength) decorators.push(`@MaxLength(${v.maxLength})`);
      if (v.pattern) decorators.push(`@Matches(/${v.pattern}/)`);
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
      if (v.min !== undefined) decorators.push(`@Min(${v.min})`);
      if (v.max !== undefined) decorators.push(`@Max(${v.max})`);
      break;
    case 'boolean':
      decorators.push('@IsBoolean()');
      break;
    case 'date':
    case 'datetime':
      decorators.push('@IsDate()');
      decorators.push('@Type(() => Date)');
      break;
    case 'enum':
      if (v.enum) {
        decorators.push(`@IsIn([${v.enum.map(e => `'${e}'`).join(', ')}])`);
      }
      break;
    case 'json':
      decorators.push('@IsObject()');
      break;
  }

  return decorators;
}

/**
 * Validate an EntitySchema
 */
export function validateEntitySchema(schema: EntitySchema): SchemaValidationResult {
  const errors: SchemaError[] = [];
  const warnings: SchemaWarning[] = [];

  // Validate entity name
  if (!schema.name) {
    errors.push({ path: 'name', message: 'Entity name is required', code: 'MISSING_NAME' });
  } else if (!/^[A-Z][a-zA-Z0-9]*$/.test(schema.name)) {
    errors.push({ path: 'name', message: 'Entity name must be PascalCase', code: 'INVALID_NAME' });
  }

  // Validate fields
  const fieldNames = new Set<string>();
  for (let i = 0; i < schema.fields.length; i++) {
    const field = schema.fields[i];
    const path = `fields[${i}]`;

    if (!field.name) {
      errors.push({ path: `${path}.name`, message: 'Field name is required', code: 'MISSING_FIELD_NAME' });
    } else {
      if (fieldNames.has(field.name)) {
        errors.push({ path: `${path}.name`, message: `Duplicate field name: ${field.name}`, code: 'DUPLICATE_FIELD' });
      }
      fieldNames.add(field.name);

      if (!/^[a-z][a-zA-Z0-9]*$/.test(field.name)) {
        warnings.push({
          path: `${path}.name`,
          message: `Field name should be camelCase: ${field.name}`,
          suggestion: toCamelCase(field.name)
        });
      }
    }

    // Validate enum fields have values
    if (field.type === 'enum' && (!field.enumValues || field.enumValues.length === 0)) {
      errors.push({ path: `${path}.type`, message: 'Enum fields must have enumValues', code: 'MISSING_ENUM_VALUES' });
    }

    // Validate decimal fields have precision
    if (field.type === 'decimal' && !field.precision) {
      warnings.push({
        path: `${path}.type`,
        message: 'Decimal fields should specify precision and scale',
        suggestion: 'Use decimal(10,2) format'
      });
    }
  }

  // Validate relations
  for (let i = 0; i < schema.relations.length; i++) {
    const relation = schema.relations[i];
    const path = `relations[${i}]`;

    if (!relation.name) {
      errors.push({ path: `${path}.name`, message: 'Relation name is required', code: 'MISSING_RELATION_NAME' });
    }

    if (!relation.target) {
      errors.push({ path: `${path}.target`, message: 'Relation target is required', code: 'MISSING_RELATION_TARGET' });
    }

    // Check for missing inverse side
    if ((relation.type === 'one-to-many' || relation.type === 'many-to-many') && !relation.inverseSide) {
      warnings.push({
        path: `${path}.inverseSide`,
        message: `${relation.type} relations should specify inverseSide`,
        suggestion: `Add inverseSide property pointing to the relation on ${relation.target}`
      });
    }
  }

  // Check for common issues
  if (!schema.fields.some(f => f.modifiers.includes('primary'))) {
    warnings.push({
      path: 'fields',
      message: 'No primary key field defined',
      suggestion: 'Add a field with "primary" modifier or use "id:uuid:primary:generated"'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generate complete EntitySchema from field strings
 */
export function createEntitySchema(
  name: string,
  fieldsStr: string,
  options: {
    timestamps?: boolean;
    softDelete?: boolean;
    audit?: boolean;
    relations?: RelationSchema[];
  } = {}
): EntitySchema {
  const fields = parseFieldStrings(fieldsStr);

  // Add id field if not present
  if (!fields.some(f => f.modifiers.includes('primary'))) {
    fields.unshift({
      name: 'id',
      type: 'uuid',
      modifiers: ['primary', 'generated'],
      validation: { required: true },
    });
  }

  // Add timestamp fields
  if (options.timestamps !== false) {
    fields.push(
      { name: 'createdAt', type: 'datetime', modifiers: ['readonly'], validation: { required: true } },
      { name: 'updatedAt', type: 'datetime', modifiers: ['readonly'], validation: { required: true } }
    );
  }

  // Add soft delete field
  if (options.softDelete) {
    fields.push({ name: 'deletedAt', type: 'datetime', modifiers: ['nullable'], validation: { required: false } });
  }

  // Add audit fields
  if (options.audit) {
    fields.push(
      { name: 'createdBy', type: 'string', modifiers: ['nullable'], validation: { required: false } },
      { name: 'updatedBy', type: 'string', modifiers: ['nullable'], validation: { required: false } }
    );
  }

  return {
    name,
    fields,
    relations: options.relations || [],
    timestamps: options.timestamps !== false,
    softDelete: options.softDelete,
    audit: options.audit,
  };
}

function toCamelCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '').replace(/^(.)/, c => c.toLowerCase());
}

/**
 * Export schema to JSON format
 */
export function schemaToJSON(schema: EntitySchema): string {
  return JSON.stringify(schema, null, 2);
}

/**
 * Import schema from JSON
 */
export function schemaFromJSON(json: string): EntitySchema {
  return JSON.parse(json) as EntitySchema;
}
