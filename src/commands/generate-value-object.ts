/**
 * Value Object & Domain Primitives Generator
 * Generates strongly-typed value objects with validation, comparison, and serialization
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface ValueObjectOptions {
  path?: string;
  module?: string;
  type?: 'simple' | 'composite' | 'primitive';
}

export interface ValueObjectDefinition {
  name: string;
  type: 'simple' | 'composite' | 'primitive';
  properties: ValueObjectProperty[];
  validation?: ValidationRule[];
  comparator?: 'structural' | 'identity';
}

export interface ValueObjectProperty {
  name: string;
  type: string;
  required?: boolean;
  validation?: ValidationRule[];
}

export interface ValidationRule {
  type: string;
  options?: Record<string, any>;
  message?: string;
}

export async function generateValueObject(
  name: string,
  basePath: string,
  options: ValueObjectOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n💎 Generating Value Object\n'));

  const moduleName = options.module || 'shared';
  const voPath = path.join(basePath, 'src', moduleName, 'domain', 'value-objects');

  if (!fs.existsSync(voPath)) {
    fs.mkdirSync(voPath, { recursive: true });
  }

  // Generate the value object file
  const voContent = generateValueObjectClass(name, options.type || 'simple');
  const voFile = path.join(voPath, `${toKebabCase(name)}.value-object.ts`);
  fs.writeFileSync(voFile, voContent);
  console.log(chalk.green(`  ✓ Created ${voFile}`));

  // Generate base value object if not exists
  const baseVoPath = path.join(basePath, 'src/shared/domain');
  if (!fs.existsSync(baseVoPath)) {
    fs.mkdirSync(baseVoPath, { recursive: true });
  }

  const baseVoFile = path.join(baseVoPath, 'value-object.base.ts');
  if (!fs.existsSync(baseVoFile)) {
    fs.writeFileSync(baseVoFile, generateBaseValueObject());
    console.log(chalk.green(`  ✓ Created ${baseVoFile}`));
  }

  // Generate common primitives
  const primitivesFile = path.join(baseVoPath, 'primitives.ts');
  if (!fs.existsSync(primitivesFile)) {
    fs.writeFileSync(primitivesFile, generatePrimitives());
    console.log(chalk.green(`  ✓ Created ${primitivesFile}`));
  }

  console.log(chalk.bold.green('\n✅ Value object generated successfully!\n'));
}

function generateValueObjectClass(name: string, type: string): string {
  const className = toPascalCase(name);

  return `import { ValueObject } from '@shared/domain/value-object.base';

/**
 * ${className} Value Object
 * Immutable value representing ${name}
 */
export interface ${className}Props {
  value: string;
}

export class ${className} extends ValueObject<${className}Props> {
  private constructor(props: ${className}Props) {
    super(props);
  }

  /**
   * Get the raw value
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Factory method with validation
   */
  public static create(value: string): ${className} {
    // Validation rules
    if (!value || value.trim().length === 0) {
      throw new Error('${className} cannot be empty');
    }

    return new ${className}({ value: value.trim() });
  }

  /**
   * Create from an existing value (bypasses validation for trusted sources)
   */
  public static fromPersistence(value: string): ${className} {
    return new ${className}({ value });
  }

  /**
   * Convert to primitive for persistence
   */
  public toPrimitive(): string {
    return this.props.value;
  }

  /**
   * String representation
   */
  public toString(): string {
    return this.props.value;
  }

  /**
   * Check if empty
   */
  public isEmpty(): boolean {
    return !this.props.value || this.props.value.length === 0;
  }
}
`;
}

function generateBaseValueObject(): string {
  return `/**
 * Base Value Object
 * Foundation for all value objects in the domain
 */

export interface ValueObjectProps {
  [key: string]: any;
}

/**
 * Abstract Value Object base class
 * Implements structural equality and immutability
 */
export abstract class ValueObject<T extends ValueObjectProps> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = Object.freeze(props);
  }

  /**
   * Check equality based on all properties
   */
  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (vo.props === undefined) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }

  /**
   * Create a copy with updated properties
   */
  protected clone(props: Partial<T>): this {
    const Constructor = this.constructor as new (props: T) => this;
    return new Constructor({ ...this.props, ...props } as T);
  }

  /**
   * Get hash code for the value object
   */
  public hashCode(): number {
    const str = JSON.stringify(this.props);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * Convert to primitive for serialization
   */
  public abstract toPrimitive(): unknown;
}

/**
 * Identifier Value Object
 * Base for entity identifiers with type safety
 */
export abstract class Identifier<T> extends ValueObject<{ value: T }> {
  constructor(value: T) {
    super({ value });
  }

  get value(): T {
    return this.props.value;
  }

  toString(): string {
    return String(this.props.value);
  }

  toPrimitive(): T {
    return this.props.value;
  }
}

/**
 * UUID Identifier
 */
export class UniqueEntityID extends Identifier<string> {
  constructor(id?: string) {
    super(id || generateUUID());
  }

  public static create(id?: string): UniqueEntityID {
    return new UniqueEntityID(id);
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Result type for value object creation
 */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { success: true, value };
}

export function err<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Guard utilities for value object validation
 */
export class Guard {
  public static againstNullOrUndefined(value: any, name: string): Result<void> {
    if (value === null || value === undefined) {
      return err(new Error(\`\${name} is null or undefined\`));
    }
    return ok(undefined);
  }

  public static againstEmpty(value: string, name: string): Result<void> {
    if (value.trim().length === 0) {
      return err(new Error(\`\${name} is empty\`));
    }
    return ok(undefined);
  }

  public static againstNullOrUndefinedBulk(args: { value: any; name: string }[]): Result<void> {
    for (const arg of args) {
      const result = this.againstNullOrUndefined(arg.value, arg.name);
      if (!result.success) return result;
    }
    return ok(undefined);
  }

  public static isOneOf(value: any, validValues: any[], name: string): Result<void> {
    if (!validValues.includes(value)) {
      return err(new Error(\`\${name} must be one of \${validValues.join(', ')}\`));
    }
    return ok(undefined);
  }

  public static inRange(num: number, min: number, max: number, name: string): Result<void> {
    if (num < min || num > max) {
      return err(new Error(\`\${name} must be between \${min} and \${max}\`));
    }
    return ok(undefined);
  }

  public static combine(results: Result<void>[]): Result<void> {
    for (const result of results) {
      if (!result.success) return result;
    }
    return ok(undefined);
  }
}
`;
}

function generatePrimitives(): string {
  return `/**
 * Domain Primitives
 * Common value objects for typical domain properties
 */

import { ValueObject, Guard, ok, err, Result } from './value-object.base';

/**
 * Email Value Object
 */
export interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  private static readonly EMAIL_REGEX = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

  private constructor(props: EmailProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(email: string): Result<Email> {
    const guardResult = Guard.againstNullOrUndefined(email, 'email');
    if (!guardResult.success) return guardResult as Result<Email>;

    if (!this.isValidEmail(email)) {
      return err(new Error('Invalid email format'));
    }

    return ok(new Email({ value: email.toLowerCase() }));
  }

  private static isValidEmail(email: string): boolean {
    return this.EMAIL_REGEX.test(email);
  }

  public toPrimitive(): string {
    return this.props.value;
  }

  public get domain(): string {
    return this.props.value.split('@')[1];
  }

  public get local(): string {
    return this.props.value.split('@')[0];
  }
}

/**
 * Money Value Object
 */
export interface MoneyProps {
  amount: number;
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  private static readonly VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'XOF', 'XAF', 'NGN'];

  private constructor(props: MoneyProps) {
    super(props);
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  public static create(amount: number, currency: string): Result<Money> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(amount, 'amount'),
      Guard.againstNullOrUndefined(currency, 'currency'),
    ]);
    if (!guardResult.success) return guardResult as Result<Money>;

    if (!this.VALID_CURRENCIES.includes(currency.toUpperCase())) {
      return err(new Error(\`Invalid currency: \${currency}\`));
    }

    return ok(new Money({
      amount: Math.round(amount * 100) / 100,
      currency: currency.toUpperCase(),
    }));
  }

  public add(money: Money): Result<Money> {
    if (this.currency !== money.currency) {
      return err(new Error('Cannot add money with different currencies'));
    }
    return Money.create(this.amount + money.amount, this.currency);
  }

  public subtract(money: Money): Result<Money> {
    if (this.currency !== money.currency) {
      return err(new Error('Cannot subtract money with different currencies'));
    }
    return Money.create(this.amount - money.amount, this.currency);
  }

  public multiply(factor: number): Result<Money> {
    return Money.create(this.amount * factor, this.currency);
  }

  public isZero(): boolean {
    return this.amount === 0;
  }

  public isNegative(): boolean {
    return this.amount < 0;
  }

  public isPositive(): boolean {
    return this.amount > 0;
  }

  public toPrimitive(): MoneyProps {
    return { ...this.props };
  }

  public format(locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
    }).format(this.amount);
  }
}

/**
 * Phone Number Value Object
 */
export interface PhoneNumberProps {
  number: string;
  countryCode: string;
}

export class PhoneNumber extends ValueObject<PhoneNumberProps> {
  private constructor(props: PhoneNumberProps) {
    super(props);
  }

  get number(): string {
    return this.props.number;
  }

  get countryCode(): string {
    return this.props.countryCode;
  }

  get full(): string {
    return \`+\${this.props.countryCode}\${this.props.number}\`;
  }

  public static create(number: string, countryCode: string): Result<PhoneNumber> {
    const cleanNumber = number.replace(/\\D/g, '');

    if (cleanNumber.length < 7 || cleanNumber.length > 15) {
      return err(new Error('Invalid phone number length'));
    }

    return ok(new PhoneNumber({
      number: cleanNumber,
      countryCode: countryCode.replace('+', ''),
    }));
  }

  public toPrimitive(): PhoneNumberProps {
    return { ...this.props };
  }
}

/**
 * Address Value Object
 */
export interface AddressProps {
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export class Address extends ValueObject<AddressProps> {
  private constructor(props: AddressProps) {
    super(props);
  }

  get street(): string { return this.props.street; }
  get city(): string { return this.props.city; }
  get state(): string | undefined { return this.props.state; }
  get postalCode(): string | undefined { return this.props.postalCode; }
  get country(): string { return this.props.country; }

  public static create(props: AddressProps): Result<Address> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.street, 'street'),
      Guard.againstNullOrUndefined(props.city, 'city'),
      Guard.againstNullOrUndefined(props.country, 'country'),
    ]);
    if (!guardResult.success) return guardResult as Result<Address>;

    return ok(new Address(props));
  }

  public toPrimitive(): AddressProps {
    return { ...this.props };
  }

  public format(): string {
    const parts = [this.street, this.city];
    if (this.state) parts.push(this.state);
    if (this.postalCode) parts.push(this.postalCode);
    parts.push(this.country);
    return parts.join(', ');
  }
}

/**
 * Date Range Value Object
 */
export interface DateRangeProps {
  start: Date;
  end: Date;
}

export class DateRange extends ValueObject<DateRangeProps> {
  private constructor(props: DateRangeProps) {
    super(props);
  }

  get start(): Date { return this.props.start; }
  get end(): Date { return this.props.end; }

  public static create(start: Date, end: Date): Result<DateRange> {
    if (start > end) {
      return err(new Error('Start date must be before end date'));
    }
    return ok(new DateRange({ start, end }));
  }

  public contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }

  public overlaps(other: DateRange): boolean {
    return this.start <= other.end && this.end >= other.start;
  }

  public duration(): number {
    return this.end.getTime() - this.start.getTime();
  }

  public durationInDays(): number {
    return Math.ceil(this.duration() / (1000 * 60 * 60 * 24));
  }

  public toPrimitive(): { start: string; end: string } {
    return {
      start: this.props.start.toISOString(),
      end: this.props.end.toISOString(),
    };
  }
}

/**
 * Percentage Value Object
 */
export interface PercentageProps {
  value: number;
}

export class Percentage extends ValueObject<PercentageProps> {
  private constructor(props: PercentageProps) {
    super(props);
  }

  get value(): number {
    return this.props.value;
  }

  public static create(value: number): Result<Percentage> {
    if (value < 0 || value > 100) {
      return err(new Error('Percentage must be between 0 and 100'));
    }
    return ok(new Percentage({ value }));
  }

  public static fromDecimal(decimal: number): Result<Percentage> {
    return this.create(decimal * 100);
  }

  public toDecimal(): number {
    return this.value / 100;
  }

  public apply(amount: number): number {
    return amount * this.toDecimal();
  }

  public toPrimitive(): number {
    return this.value;
  }
}

/**
 * Slug Value Object
 */
export interface SlugProps {
  value: string;
}

export class Slug extends ValueObject<SlugProps> {
  private constructor(props: SlugProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(text: string): Result<Slug> {
    const slugified = text
      .toLowerCase()
      .trim()
      .replace(/[^\\w\\s-]/g, '')
      .replace(/[\\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (slugified.length === 0) {
      return err(new Error('Cannot create slug from empty text'));
    }

    return ok(new Slug({ value: slugified }));
  }

  public toPrimitive(): string {
    return this.value;
  }
}
`;
}

// Helper functions
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\\s_]+/g, '-')
    .toLowerCase();
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^(.)/, c => c.toUpperCase());
}

/**
 * Generate common value objects for a module
 */
export async function setupValueObjects(basePath: string, options: ValueObjectOptions = {}): Promise<void> {
  console.log(chalk.bold.blue('\n💎 Setting up Value Objects Infrastructure\n'));

  const sharedPath = path.join(basePath, 'src/shared/domain');

  if (!fs.existsSync(sharedPath)) {
    fs.mkdirSync(sharedPath, { recursive: true });
  }

  // Generate base value object
  const baseVoFile = path.join(sharedPath, 'value-object.base.ts');
  fs.writeFileSync(baseVoFile, generateBaseValueObject());
  console.log(chalk.green(`  ✓ Created ${baseVoFile}`));

  // Generate primitives
  const primitivesFile = path.join(sharedPath, 'primitives.ts');
  fs.writeFileSync(primitivesFile, generatePrimitives());
  console.log(chalk.green(`  ✓ Created ${primitivesFile}`));

  // Generate index
  const indexContent = `export * from './value-object.base';
export * from './primitives';
`;
  const indexFile = path.join(sharedPath, 'index.ts');
  fs.writeFileSync(indexFile, indexContent);
  console.log(chalk.green(`  ✓ Created ${indexFile}`));

  console.log(chalk.bold.green('\n✅ Value objects infrastructure ready!\n'));
}
