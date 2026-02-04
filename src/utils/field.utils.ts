import { toCamelCase, toSnakeCase, toPascalCase } from './naming.utils';

export interface FieldDefinition {
  name: string;
  camelCase: string;
  snakeCase: string;
  pascalCase: string;
  type: string;
  tsType: string;
  dbType: string;
  prismaType: string;
  isRequired: boolean;
  isOptional: boolean;
  isUnique: boolean;
  isArray: boolean;
  validators: string[];
  description: string;
  example?: string;
  defaultValue?: string;
  enumValues?: string[];
  // Relation properties
  isRelation: boolean;
  relationType?: 'OneToOne' | 'OneToMany' | 'ManyToOne' | 'ManyToMany';
  relationTarget?: string;
  relationInverse?: string;
}

export interface ParsedFields {
  fields: FieldDefinition[];
  hasEmail: boolean;
  hasDate: boolean;
  hasEnum: boolean;
  hasRelation: boolean;
}

/**
 * Parse field definitions from CLI --fields flag
 * Format: "name:type:modifier1:modifier2"
 *
 * Examples:
 *   "name:string"                    -> required string
 *   "email:string:unique"            -> required unique string with IsEmail
 *   "age:number:optional"            -> optional number
 *   "status:enum:active,inactive"    -> enum with values
 *   "tags:string[]"                  -> string array
 *   "userId:uuid:relation"           -> foreign key relation
 */
export function parseFields(fieldsString: string): ParsedFields {
  if (!fieldsString || fieldsString.trim() === '') {
    return { fields: [], hasEmail: false, hasDate: false, hasEnum: false, hasRelation: false };
  }

  const fieldDefs = fieldsString.split(' ').filter(f => f.trim() !== '');
  let hasEmail = false;
  let hasDate = false;
  let hasEnum = false;
  let hasRelation = false;

  const fields: FieldDefinition[] = fieldDefs.map(fieldDef => {
    const parts = fieldDef.split(':');
    const name = parts[0];
    const typeWithArray = parts[1] || 'string';
    const modifiers = parts.slice(2);

    const isArray = typeWithArray.endsWith('[]');
    const baseType = isArray ? typeWithArray.slice(0, -2) : typeWithArray;

    const isOptional = modifiers.includes('optional');
    const isUnique = modifiers.includes('unique');

    // Check for relation type
    const relationTypes = ['OneToOne', 'OneToMany', 'ManyToOne', 'ManyToMany'];
    const relationTypeModifier = modifiers.find(m => relationTypes.includes(m)) as 'OneToOne' | 'OneToMany' | 'ManyToOne' | 'ManyToMany' | undefined;
    const isRelation = baseType === 'relation' || modifiers.includes('relation') || !!relationTypeModifier;

    // Parse relation details
    let relationTarget: string | undefined;
    let relationType: 'OneToOne' | 'OneToMany' | 'ManyToOne' | 'ManyToMany' | undefined;
    let relationInverse: string | undefined;

    if (isRelation) {
      if (baseType === 'relation') {
        // Format: fieldName:relation:TargetEntity:RelationType:inverseSide
        relationTarget = modifiers[0]; // First modifier is target entity
        relationType = (modifiers.find(m => relationTypes.includes(m)) || 'ManyToOne') as any;
        // Find inverse (anything that's not a relation type or target)
        relationInverse = modifiers.find(m => !relationTypes.includes(m) && m !== relationTarget && m !== 'optional' && m !== 'unique');
      } else {
        // Legacy format or uuid:relation
        relationTarget = toPascalCase(name.replace(/Id$/, ''));
        relationType = 'ManyToOne';
      }
    }

    // Find enum values if present
    const enumModifier = modifiers.find(m => m.includes(',') || (baseType === 'enum' && m && !relationTypes.includes(m)));
    const enumValues = baseType === 'enum' && enumModifier ? enumModifier.split(',') : undefined;

    // Determine TypeScript type
    let tsType = mapToTsType(baseType, enumValues);
    if (isArray) tsType = `${tsType}[]`;

    // Determine database type
    const dbType = mapToDbType(baseType, isArray);

    // Determine Prisma type
    const prismaType = mapToPrismaType(baseType, isArray);

    // Generate validators
    const validators = generateValidators(name, baseType, isOptional, isUnique, isArray, enumValues);

    // Track special types
    if (name.toLowerCase().includes('email')) hasEmail = true;
    if (baseType === 'date' || baseType === 'datetime') hasDate = true;
    if (baseType === 'enum') hasEnum = true;
    if (isRelation) hasRelation = true;

    const camelCase = toCamelCase(name);
    const snakeCase = toSnakeCase(name);
    const pascalCase = name.charAt(0).toUpperCase() + toCamelCase(name).slice(1);

    return {
      name,
      camelCase,
      snakeCase,
      pascalCase,
      type: baseType,
      tsType: isRelation ? (relationType === 'OneToMany' || relationType === 'ManyToMany' ? `${relationTarget}[]` : relationTarget || 'string') : tsType,
      dbType,
      prismaType,
      isRequired: !isOptional,
      isOptional,
      isUnique,
      isArray,
      validators,
      description: generateDescription(name, baseType),
      example: generateExample(name, baseType),
      enumValues,
      isRelation,
      relationType,
      relationTarget,
      relationInverse,
    };
  });

  return { fields, hasEmail, hasDate, hasEnum, hasRelation };
}

function mapToTsType(type: string, enumValues?: string[]): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    int: 'number',
    integer: 'number',
    float: 'number',
    decimal: 'number',
    boolean: 'boolean',
    bool: 'boolean',
    date: 'Date',
    datetime: 'Date',
    timestamp: 'Date',
    uuid: 'string',
    json: 'Record<string, any>',
    text: 'string',
    enum: enumValues ? enumValues.map(v => `'${v}'`).join(' | ') : 'string',
  };

  return typeMap[type.toLowerCase()] || 'string';
}

function mapToDbType(type: string, isArray: boolean): string {
  const typeMap: Record<string, string> = {
    string: 'varchar',
    number: 'int',
    int: 'int',
    integer: 'int',
    float: 'float',
    decimal: 'decimal',
    boolean: 'boolean',
    bool: 'boolean',
    date: 'date',
    datetime: 'timestamp',
    timestamp: 'timestamp',
    uuid: 'uuid',
    json: 'jsonb',
    text: 'text',
    enum: 'varchar',
  };

  const dbType = typeMap[type.toLowerCase()] || 'varchar';
  return isArray ? 'jsonb' : dbType;
}

function mapToPrismaType(type: string, isArray: boolean): string {
  const typeMap: Record<string, string> = {
    string: 'String',
    number: 'Int',
    int: 'Int',
    integer: 'Int',
    float: 'Float',
    decimal: 'Decimal',
    boolean: 'Boolean',
    bool: 'Boolean',
    date: 'DateTime',
    datetime: 'DateTime',
    timestamp: 'DateTime',
    uuid: 'String',
    json: 'Json',
    text: 'String',
    enum: 'String',
  };

  const prismaType = typeMap[type.toLowerCase()] || 'String';
  return isArray ? `${prismaType}[]` : prismaType;
}

function generateValidators(
  name: string,
  type: string,
  isOptional: boolean,
  isUnique: boolean,
  isArray: boolean,
  enumValues?: string[]
): string[] {
  const validators: string[] = [];
  const nameLower = name.toLowerCase();

  if (isOptional) {
    validators.push('@IsOptional()');
  } else {
    validators.push('@IsNotEmpty()');
    validators.push('@IsDefined()');
  }

  // Type-specific validators with security-focused length limits
  switch (type.toLowerCase()) {
    case 'string':
    case 'text':
      validators.push('@IsString()');

      // Field-specific validation with length limits
      if (nameLower.includes('email')) {
        validators.push('@IsEmail()');
        validators.push('@MaxLength(254)'); // RFC 5321
      } else if (nameLower.includes('url') || nameLower.includes('link')) {
        validators.push('@IsUrl()');
        validators.push('@MaxLength(2048)'); // Common browser limit
      } else if (nameLower.includes('phone') || nameLower.includes('mobile')) {
        validators.push("@Matches(/^[+]?[0-9\\\\s\\\\-().]+$/, { message: 'Invalid phone format' })");
        validators.push('@MaxLength(20)'); // E.164 max
      } else if (nameLower.includes('name') && !nameLower.includes('username')) {
        validators.push('@MaxLength(100)');
        validators.push('@MinLength(1)');
      } else if (nameLower.includes('username') || nameLower.includes('login')) {
        validators.push("@Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Username can only contain letters, numbers, underscores, and hyphens' })");
        validators.push('@MaxLength(50)');
        validators.push('@MinLength(3)');
      } else if (nameLower.includes('password')) {
        validators.push('@MinLength(8)');
        validators.push('@MaxLength(128)');
      } else if (nameLower.includes('description') || nameLower.includes('content') || type.toLowerCase() === 'text') {
        validators.push('@MaxLength(10000)'); // Long text fields
      } else if (nameLower.includes('title') || nameLower.includes('subject')) {
        validators.push('@MaxLength(255)');
      } else if (nameLower.includes('code') || nameLower.includes('slug')) {
        validators.push("@Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Invalid format - use only letters, numbers, underscores, and hyphens' })");
        validators.push('@MaxLength(100)');
      } else if (nameLower.includes('ip') || nameLower.includes('address')) {
        validators.push('@MaxLength(45)'); // IPv6 max
      } else {
        // Default string length limit to prevent DoS
        validators.push('@MaxLength(1000)');
      }
      break;

    case 'number':
    case 'int':
    case 'integer':
      validators.push('@IsNumber()');
      validators.push('@IsInt()');
      // Add safe integer bounds
      validators.push('@Min(-2147483648)');
      validators.push('@Max(2147483647)');
      break;

    case 'float':
    case 'decimal':
      validators.push('@IsNumber()');
      // Prevent extremely large numbers
      validators.push('@Min(-1e15)');
      validators.push('@Max(1e15)');
      break;

    case 'boolean':
    case 'bool':
      validators.push('@IsBoolean()');
      break;

    case 'date':
    case 'datetime':
    case 'timestamp':
      validators.push('@IsDate()');
      validators.push('@Type(() => Date)');
      break;

    case 'uuid':
      validators.push('@IsUUID()');
      break;

    case 'enum':
      if (enumValues) {
        validators.push(`@IsIn([${enumValues.map(v => `'${v}'`).join(', ')}])`);
      }
      break;

    case 'json':
      validators.push('@IsObject()');
      break;
  }

  if (isArray) {
    validators.push('@IsArray()');
    validators.push('@ArrayMaxSize(100)'); // Limit array size by default
  }

  return validators;
}

function generateRelationDecorator(f: FieldDefinition): string {
  const { camelCase, relationType, relationTarget, relationInverse } = f;

  switch (relationType) {
    case 'OneToOne':
      return `  @OneToOne(() => ${relationTarget}${relationInverse ? `, (${relationInverse.toLowerCase()}) => ${relationInverse.toLowerCase()}.${camelCase}` : ''})\n  @JoinColumn()\n  ${camelCase}${f.isOptional ? '?' : ''}: ${relationTarget};`;

    case 'OneToMany':
      return `  @OneToMany(() => ${relationTarget}, (${relationTarget!.toLowerCase()}) => ${relationTarget!.toLowerCase()}.${relationInverse || camelCase})\n  ${camelCase}: ${relationTarget}[];`;

    case 'ManyToOne':
      return `  @ManyToOne(() => ${relationTarget}${relationInverse ? `, (${relationTarget!.toLowerCase()}) => ${relationTarget!.toLowerCase()}.${relationInverse}` : ''})\n  @JoinColumn({ name: '${f.snakeCase}_id' })\n  ${camelCase}${f.isOptional ? '?' : ''}: ${relationTarget};`;

    case 'ManyToMany':
      return `  @ManyToMany(() => ${relationTarget})\n  @JoinTable()\n  ${camelCase}: ${relationTarget}[];`;

    default:
      return `  // Unknown relation type for ${camelCase}`;
  }
}

function generateDescription(name: string, type: string): string {
  const readableName = name
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .toLowerCase();

  return `The ${readableName} of the entity`;
}

function generateExample(name: string, type: string): string | undefined {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('email')) return 'user@example.com';
  if (lowerName.includes('name')) return 'John Doe';
  if (lowerName.includes('phone')) return '+1234567890';
  if (lowerName.includes('url') || lowerName.includes('link')) return 'https://example.com';
  if (lowerName.includes('price') || lowerName.includes('amount')) return '99.99';
  if (lowerName.includes('count') || lowerName.includes('quantity')) return '10';

  switch (type.toLowerCase()) {
    case 'string':
    case 'text':
      return 'Sample text';
    case 'number':
    case 'int':
    case 'integer':
      return '42';
    case 'float':
    case 'decimal':
      return '3.14';
    case 'boolean':
    case 'bool':
      return 'true';
    case 'uuid':
      return '550e8400-e29b-41d4-a716-446655440000';
    default:
      return undefined;
  }
}

/**
 * Generate field-aware template data
 */
export function generateFieldsTemplateData(fields: FieldDefinition[]): {
  entityProperties: string;
  entityPropsInterface: string;
  dtoProperties: string;
  ormColumns: string;
  migrationColumns: string;
  responseProperties: string;
} {
  const entityProperties = fields
    .map(f => `  public readonly ${f.camelCase}${f.isOptional ? '?' : ''}: ${f.tsType};`)
    .join('\n');

  const entityPropsInterface = fields
    .map(f => `  ${f.camelCase}${f.isOptional ? '?' : ''}: ${f.tsType};`)
    .join('\n');

  const dtoProperties = fields
    .map(f => {
      const decorators = [
        `  @ApiProperty({ description: "${f.description}"${f.example ? `, example: "${f.example}"` : ''} })`,
        ...f.validators.map(v => `  ${v}`),
      ].join('\n');
      return `${decorators}\n  ${f.snakeCase}${f.isOptional ? '?' : ''}: ${f.tsType};`;
    })
    .join('\n\n');

  const ormColumns = fields
    .map(f => {
      if (f.isRelation && f.relationType && f.relationTarget) {
        // Generate relation decorator
        const relationDecorator = generateRelationDecorator(f);
        return relationDecorator;
      }

      const columnOptions: string[] = [];
      if (f.isUnique) columnOptions.push('unique: true');
      if (f.isOptional) columnOptions.push('nullable: true');
      if (f.dbType !== 'varchar') columnOptions.push(`type: "${f.dbType}"`);

      const optionsStr = columnOptions.length > 0 ? `{ ${columnOptions.join(', ')} }` : '';
      return `  @Column(${optionsStr})\n  ${f.snakeCase}${f.isOptional ? '?' : ''}: ${f.tsType};`;
    })
    .join('\n\n');

  const migrationColumns = fields
    .map(f => {
      return `          {
            name: "${f.snakeCase}",
            type: "${f.dbType}",
            isNullable: ${f.isOptional},
            ${f.isUnique ? 'isUnique: true,' : ''}
          },`;
    })
    .join('\n');

  const responseProperties = fields
    .map(f => `  @ApiProperty({ description: "${f.description}" })\n  @Expose()\n  ${f.camelCase}: ${f.tsType};`)
    .join('\n\n');

  return {
    entityProperties,
    entityPropsInterface,
    dtoProperties,
    ormColumns,
    migrationColumns,
    responseProperties,
  };
}
