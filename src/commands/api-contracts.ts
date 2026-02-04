/**
 * API Contract Testing & Schema Validation Generator
 * Generates contract testing infrastructure
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface ApiContractsOptions {
  path?: string;
  format?: 'openapi' | 'asyncapi';
}

export async function setupApiContracts(
  basePath: string,
  options: ApiContractsOptions = {}
): Promise<void> {
  console.log(chalk.bold.blue('\n📜 Setting up API Contract Testing Framework\n'));

  const sharedPath = path.join(basePath, 'src/shared/contracts');
  const testsPath = path.join(basePath, 'test/contracts');

  for (const dir of [sharedPath, testsPath]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Generate contract validator
  const validatorContent = generateContractValidator();
  fs.writeFileSync(path.join(sharedPath, 'contract.validator.ts'), validatorContent);
  console.log(chalk.green(`  ✓ Created contract validator`));

  // Generate schema validator
  const schemaContent = generateSchemaValidator();
  fs.writeFileSync(path.join(sharedPath, 'schema.validator.ts'), schemaContent);
  console.log(chalk.green(`  ✓ Created schema validator`));

  // Generate consumer test helpers
  const consumerContent = generateConsumerTestHelpers();
  fs.writeFileSync(path.join(sharedPath, 'consumer-test.helpers.ts'), consumerContent);
  console.log(chalk.green(`  ✓ Created consumer test helpers`));

  // Generate provider test helpers
  const providerContent = generateProviderTestHelpers();
  fs.writeFileSync(path.join(sharedPath, 'provider-test.helpers.ts'), providerContent);
  console.log(chalk.green(`  ✓ Created provider test helpers`));

  // Generate contract store
  const storeContent = generateContractStore();
  fs.writeFileSync(path.join(sharedPath, 'contract.store.ts'), storeContent);
  console.log(chalk.green(`  ✓ Created contract store`));

  // Generate sample contract test
  const sampleTestContent = generateSampleContractTest();
  fs.writeFileSync(path.join(testsPath, 'sample.contract.spec.ts'), sampleTestContent);
  console.log(chalk.green(`  ✓ Created sample contract test`));

  console.log(chalk.bold.green('\n✅ API contract testing framework ready!\n'));
}

function generateContractValidator(): string {
  return `/**
 * Contract Validator
 * Validates API responses against contracts
 */

import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

export interface ContractValidationResult {
  valid: boolean;
  errors: ContractError[];
  warnings: ContractWarning[];
}

export interface ContractError {
  path: string;
  message: string;
  expected?: any;
  actual?: any;
}

export interface ContractWarning {
  path: string;
  message: string;
}

export interface Contract {
  name: string;
  version: string;
  provider: string;
  consumer?: string;
  endpoints: EndpointContract[];
}

export interface EndpointContract {
  method: string;
  path: string;
  description?: string;
  request?: {
    headers?: Record<string, SchemaDefinition>;
    query?: Record<string, SchemaDefinition>;
    body?: SchemaDefinition;
  };
  response: {
    statusCode: number;
    headers?: Record<string, SchemaDefinition>;
    body?: SchemaDefinition;
  };
  examples?: {
    request?: any;
    response?: any;
  };
}

export interface SchemaDefinition {
  type: string;
  properties?: Record<string, SchemaDefinition>;
  items?: SchemaDefinition;
  required?: string[];
  enum?: any[];
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  nullable?: boolean;
}

/**
 * Contract Validator
 */
export class ContractValidator {
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  /**
   * Register a contract
   */
  registerContract(contract: Contract): void {
    for (const endpoint of contract.endpoints) {
      const key = this.getEndpointKey(endpoint);

      if (endpoint.request?.body) {
        const requestKey = \`\${key}:request\`;
        this.validators.set(
          requestKey,
          this.ajv.compile(this.toJsonSchema(endpoint.request.body)),
        );
      }

      if (endpoint.response.body) {
        const responseKey = \`\${key}:response:\${endpoint.response.statusCode}\`;
        this.validators.set(
          responseKey,
          this.ajv.compile(this.toJsonSchema(endpoint.response.body)),
        );
      }
    }
  }

  /**
   * Validate request against contract
   */
  validateRequest(
    method: string,
    path: string,
    body: any,
  ): ContractValidationResult {
    const key = \`\${method.toUpperCase()}:\${path}:request\`;
    return this.validate(key, body);
  }

  /**
   * Validate response against contract
   */
  validateResponse(
    method: string,
    path: string,
    statusCode: number,
    body: any,
  ): ContractValidationResult {
    const key = \`\${method.toUpperCase()}:\${path}:response:\${statusCode}\`;
    return this.validate(key, body);
  }

  /**
   * Validate data against a key
   */
  private validate(key: string, data: any): ContractValidationResult {
    const validator = this.validators.get(key);

    if (!validator) {
      return {
        valid: false,
        errors: [{ path: '', message: \`No contract found for: \${key}\` }],
        warnings: [],
      };
    }

    const valid = validator(data);

    if (valid) {
      return { valid: true, errors: [], warnings: [] };
    }

    return {
      valid: false,
      errors: this.formatErrors(validator.errors || []),
      warnings: [],
    };
  }

  /**
   * Validate schema directly
   */
  validateSchema(schema: SchemaDefinition, data: any): ContractValidationResult {
    const validate = this.ajv.compile(this.toJsonSchema(schema));
    const valid = validate(data);

    if (valid) {
      return { valid: true, errors: [], warnings: [] };
    }

    return {
      valid: false,
      errors: this.formatErrors(validate.errors || []),
      warnings: [],
    };
  }

  private getEndpointKey(endpoint: EndpointContract): string {
    return \`\${endpoint.method.toUpperCase()}:\${endpoint.path}\`;
  }

  private toJsonSchema(schema: SchemaDefinition): any {
    return {
      type: schema.type,
      properties: schema.properties
        ? Object.fromEntries(
            Object.entries(schema.properties).map(([k, v]) => [
              k,
              this.toJsonSchema(v),
            ]),
          )
        : undefined,
      items: schema.items ? this.toJsonSchema(schema.items) : undefined,
      required: schema.required,
      enum: schema.enum,
      format: schema.format,
      pattern: schema.pattern,
      minimum: schema.minimum,
      maximum: schema.maximum,
      minLength: schema.minLength,
      maxLength: schema.maxLength,
      nullable: schema.nullable,
    };
  }

  private formatErrors(errors: ErrorObject[]): ContractError[] {
    return errors.map(error => ({
      path: error.instancePath || '/',
      message: error.message || 'Validation failed',
      expected: error.params,
    }));
  }
}

/**
 * Create contract validator
 */
export function createContractValidator(): ContractValidator {
  return new ContractValidator();
}
`;
}

function generateSchemaValidator(): string {
  return `/**
 * Schema Validator
 * Validates data against JSON schemas
 */

import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export interface Schema {
  $id?: string;
  type: string;
  properties?: Record<string, Schema | SchemaRef>;
  items?: Schema | SchemaRef;
  required?: string[];
  additionalProperties?: boolean | Schema;
  enum?: any[];
  const?: any;
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  oneOf?: (Schema | SchemaRef)[];
  anyOf?: (Schema | SchemaRef)[];
  allOf?: (Schema | SchemaRef)[];
  not?: Schema | SchemaRef;
  if?: Schema | SchemaRef;
  then?: Schema | SchemaRef;
  else?: Schema | SchemaRef;
}

export interface SchemaRef {
  $ref: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params: Record<string, any>;
}

/**
 * Schema Validator
 */
export class SchemaValidator {
  private ajv: Ajv;
  private schemas: Map<string, ValidateFunction> = new Map();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      validateFormats: true,
    });
    addFormats(this.ajv);
  }

  /**
   * Register a schema
   */
  register(id: string, schema: Schema): void {
    this.ajv.addSchema({ ...schema, $id: id });
    this.schemas.set(id, this.ajv.compile({ $ref: id }));
  }

  /**
   * Validate data against a registered schema
   */
  validate(schemaId: string, data: any): ValidationResult {
    const validator = this.schemas.get(schemaId);

    if (!validator) {
      return {
        valid: false,
        errors: [
          {
            path: '',
            message: \`Schema not found: \${schemaId}\`,
            keyword: 'schema',
            params: { schemaId },
          },
        ],
      };
    }

    const valid = validator(data);

    if (valid) {
      return { valid: true, errors: [] };
    }

    return {
      valid: false,
      errors: (validator.errors || []).map(error => ({
        path: error.instancePath || '/',
        message: error.message || 'Validation failed',
        keyword: error.keyword,
        params: error.params,
      })),
    };
  }

  /**
   * Validate data against an inline schema
   */
  validateInline(schema: Schema, data: any): ValidationResult {
    const validate = this.ajv.compile(schema);
    const valid = validate(data);

    if (valid) {
      return { valid: true, errors: [] };
    }

    return {
      valid: false,
      errors: (validate.errors || []).map(error => ({
        path: error.instancePath || '/',
        message: error.message || 'Validation failed',
        keyword: error.keyword,
        params: error.params,
      })),
    };
  }

  /**
   * Check if schema is registered
   */
  has(schemaId: string): boolean {
    return this.schemas.has(schemaId);
  }

  /**
   * Remove a schema
   */
  remove(schemaId: string): void {
    this.ajv.removeSchema(schemaId);
    this.schemas.delete(schemaId);
  }
}

/**
 * Schema builder for fluent API
 */
export class SchemaBuilder {
  private schema: Schema = { type: 'object' };

  type(type: string): this {
    this.schema.type = type;
    return this;
  }

  property(name: string, schema: Schema | SchemaRef): this {
    if (!this.schema.properties) {
      this.schema.properties = {};
    }
    this.schema.properties[name] = schema;
    return this;
  }

  required(...fields: string[]): this {
    this.schema.required = fields;
    return this;
  }

  items(schema: Schema | SchemaRef): this {
    this.schema.items = schema;
    return this;
  }

  enum(...values: any[]): this {
    this.schema.enum = values;
    return this;
  }

  format(format: string): this {
    this.schema.format = format;
    return this;
  }

  pattern(pattern: string): this {
    this.schema.pattern = pattern;
    return this;
  }

  min(value: number): this {
    this.schema.minimum = value;
    return this;
  }

  max(value: number): this {
    this.schema.maximum = value;
    return this;
  }

  build(): Schema {
    return { ...this.schema };
  }
}

/**
 * Create schema builder
 */
export function schema(): SchemaBuilder {
  return new SchemaBuilder();
}

/**
 * Common schema templates
 */
export const CommonSchemas = {
  uuid: { type: 'string', format: 'uuid' } as Schema,
  email: { type: 'string', format: 'email' } as Schema,
  date: { type: 'string', format: 'date' } as Schema,
  dateTime: { type: 'string', format: 'date-time' } as Schema,
  uri: { type: 'string', format: 'uri' } as Schema,
  positiveInteger: { type: 'integer', minimum: 1 } as Schema,
  nonNegativeInteger: { type: 'integer', minimum: 0 } as Schema,

  pagination: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100 },
      total: { type: 'integer', minimum: 0 },
      totalPages: { type: 'integer', minimum: 0 },
    },
    required: ['page', 'pageSize', 'total', 'totalPages'],
  } as Schema,

  error: {
    type: 'object',
    properties: {
      statusCode: { type: 'integer' },
      message: { type: 'string' },
      error: { type: 'string' },
    },
    required: ['statusCode', 'message'],
  } as Schema,
};
`;
}

function generateConsumerTestHelpers(): string {
  return `/**
 * Consumer Test Helpers
 * Helpers for consumer-driven contract testing
 */

import { ContractValidator, Contract, EndpointContract } from './contract.validator';

export interface Interaction {
  description: string;
  request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: any;
  };
  response: {
    statusCode: number;
    headers?: Record<string, string>;
    body?: any;
  };
}

export interface Pact {
  consumer: string;
  provider: string;
  interactions: Interaction[];
}

/**
 * Consumer Contract Builder
 * Creates pact-style consumer contracts
 */
export class ConsumerContractBuilder {
  private pact: Pact;
  private currentInteraction: Partial<Interaction> | null = null;

  constructor(consumer: string, provider: string) {
    this.pact = {
      consumer,
      provider,
      interactions: [],
    };
  }

  /**
   * Start new interaction
   */
  given(description: string): this {
    if (this.currentInteraction) {
      this.commitInteraction();
    }
    this.currentInteraction = { description };
    return this;
  }

  /**
   * Define request
   */
  uponReceiving(method: string, path: string): this {
    if (!this.currentInteraction) {
      throw new Error('Call given() first');
    }
    this.currentInteraction.request = { method, path };
    return this;
  }

  /**
   * Add request headers
   */
  withHeaders(headers: Record<string, string>): this {
    if (!this.currentInteraction?.request) {
      throw new Error('Call uponReceiving() first');
    }
    this.currentInteraction.request.headers = headers;
    return this;
  }

  /**
   * Add request query
   */
  withQuery(query: Record<string, string>): this {
    if (!this.currentInteraction?.request) {
      throw new Error('Call uponReceiving() first');
    }
    this.currentInteraction.request.query = query;
    return this;
  }

  /**
   * Add request body
   */
  withBody(body: any): this {
    if (!this.currentInteraction?.request) {
      throw new Error('Call uponReceiving() first');
    }
    this.currentInteraction.request.body = body;
    return this;
  }

  /**
   * Define expected response
   */
  willRespondWith(statusCode: number): this {
    if (!this.currentInteraction) {
      throw new Error('Call given() first');
    }
    this.currentInteraction.response = { statusCode };
    return this;
  }

  /**
   * Add response headers
   */
  withResponseHeaders(headers: Record<string, string>): this {
    if (!this.currentInteraction?.response) {
      throw new Error('Call willRespondWith() first');
    }
    this.currentInteraction.response.headers = headers;
    return this;
  }

  /**
   * Add response body
   */
  withResponseBody(body: any): this {
    if (!this.currentInteraction?.response) {
      throw new Error('Call willRespondWith() first');
    }
    this.currentInteraction.response.body = body;
    return this;
  }

  /**
   * Build the pact
   */
  build(): Pact {
    if (this.currentInteraction) {
      this.commitInteraction();
    }
    return this.pact;
  }

  private commitInteraction(): void {
    if (
      this.currentInteraction?.description &&
      this.currentInteraction?.request &&
      this.currentInteraction?.response
    ) {
      this.pact.interactions.push(this.currentInteraction as Interaction);
    }
    this.currentInteraction = null;
  }
}

/**
 * Consumer test runner
 */
export class ConsumerTestRunner {
  private validator: ContractValidator;

  constructor() {
    this.validator = new ContractValidator();
  }

  /**
   * Run consumer tests against a mock provider
   */
  async runTests(
    pact: Pact,
    mockProvider: (interaction: Interaction) => Promise<any>,
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const interaction of pact.interactions) {
      const result = await this.runInteraction(interaction, mockProvider);
      results.push(result);
    }

    return results;
  }

  private async runInteraction(
    interaction: Interaction,
    mockProvider: (interaction: Interaction) => Promise<any>,
  ): Promise<TestResult> {
    try {
      const response = await mockProvider(interaction);

      // Validate response matches expected
      const matches = this.matchResponse(interaction.response, response);

      return {
        description: interaction.description,
        passed: matches.passed,
        errors: matches.errors,
      };
    } catch (error) {
      return {
        description: interaction.description,
        passed: false,
        errors: [(error as Error).message],
      };
    }
  }

  private matchResponse(
    expected: Interaction['response'],
    actual: any,
  ): { passed: boolean; errors: string[] } {
    const errors: string[] = [];

    if (actual.statusCode !== expected.statusCode) {
      errors.push(
        \`Status code mismatch: expected \${expected.statusCode}, got \${actual.statusCode}\`,
      );
    }

    // Deep compare bodies if provided
    if (expected.body) {
      const bodyMatch = this.deepMatch(expected.body, actual.body);
      if (!bodyMatch.matches) {
        errors.push(\`Body mismatch: \${bodyMatch.path}\`);
      }
    }

    return {
      passed: errors.length === 0,
      errors,
    };
  }

  private deepMatch(
    expected: any,
    actual: any,
    path: string = '',
  ): { matches: boolean; path: string } {
    if (typeof expected !== typeof actual) {
      return { matches: false, path: path || 'root' };
    }

    if (expected === null || actual === null) {
      return { matches: expected === actual, path };
    }

    if (typeof expected !== 'object') {
      return { matches: expected === actual, path };
    }

    if (Array.isArray(expected)) {
      if (!Array.isArray(actual) || expected.length !== actual.length) {
        return { matches: false, path };
      }
      for (let i = 0; i < expected.length; i++) {
        const result = this.deepMatch(expected[i], actual[i], \`\${path}[\${i}]\`);
        if (!result.matches) return result;
      }
      return { matches: true, path };
    }

    for (const key of Object.keys(expected)) {
      const result = this.deepMatch(
        expected[key],
        actual[key],
        path ? \`\${path}.\${key}\` : key,
      );
      if (!result.matches) return result;
    }

    return { matches: true, path };
  }
}

interface TestResult {
  description: string;
  passed: boolean;
  errors: string[];
}

/**
 * Create consumer contract builder
 */
export function consumerContract(consumer: string, provider: string): ConsumerContractBuilder {
  return new ConsumerContractBuilder(consumer, provider);
}
`;
}

function generateProviderTestHelpers(): string {
  return `/**
 * Provider Test Helpers
 * Helpers for provider-side contract verification
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Pact, Interaction } from './consumer-test.helpers';
import { ContractValidator } from './contract.validator';

export interface ProviderState {
  name: string;
  setup: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface VerificationResult {
  interaction: string;
  passed: boolean;
  errors: string[];
  duration: number;
}

/**
 * Provider Verifier
 * Verifies provider against consumer contracts
 */
export class ProviderVerifier {
  private states: Map<string, ProviderState> = new Map();
  private validator: ContractValidator;

  constructor(private readonly app: INestApplication) {
    this.validator = new ContractValidator();
  }

  /**
   * Register provider state
   */
  registerState(state: ProviderState): this {
    this.states.set(state.name, state);
    return this;
  }

  /**
   * Verify all interactions in a pact
   */
  async verify(pact: Pact): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const interaction of pact.interactions) {
      const result = await this.verifyInteraction(interaction);
      results.push(result);
    }

    return results;
  }

  /**
   * Verify single interaction
   */
  async verifyInteraction(interaction: Interaction): Promise<VerificationResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Setup provider state if exists
      const state = this.states.get(interaction.description);
      if (state) {
        await state.setup();
      }

      // Make request
      const response = await this.makeRequest(interaction);

      // Verify response
      if (response.status !== interaction.response.statusCode) {
        errors.push(
          \`Status code mismatch: expected \${interaction.response.statusCode}, got \${response.status}\`,
        );
      }

      // Verify response body
      if (interaction.response.body) {
        const bodyErrors = this.verifyBody(interaction.response.body, response.body);
        errors.push(...bodyErrors);
      }

      // Verify response headers
      if (interaction.response.headers) {
        const headerErrors = this.verifyHeaders(interaction.response.headers, response.headers);
        errors.push(...headerErrors);
      }

      // Teardown provider state
      if (state?.teardown) {
        await state.teardown();
      }

      return {
        interaction: interaction.description,
        passed: errors.length === 0,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        interaction: interaction.description,
        passed: false,
        errors: [(error as Error).message],
        duration: Date.now() - startTime,
      };
    }
  }

  private async makeRequest(interaction: Interaction): Promise<any> {
    const req = interaction.request;
    let testRequest = request(this.app.getHttpServer());

    switch (req.method.toUpperCase()) {
      case 'GET':
        testRequest = testRequest.get(req.path);
        break;
      case 'POST':
        testRequest = testRequest.post(req.path);
        break;
      case 'PUT':
        testRequest = testRequest.put(req.path);
        break;
      case 'PATCH':
        testRequest = testRequest.patch(req.path);
        break;
      case 'DELETE':
        testRequest = testRequest.delete(req.path);
        break;
    }

    if (req.headers) {
      for (const [key, value] of Object.entries(req.headers)) {
        testRequest = testRequest.set(key, value);
      }
    }

    if (req.query) {
      testRequest = testRequest.query(req.query);
    }

    if (req.body) {
      testRequest = testRequest.send(req.body);
    }

    return testRequest;
  }

  private verifyBody(expected: any, actual: any): string[] {
    const errors: string[] = [];
    this.compareObjects(expected, actual, '', errors);
    return errors;
  }

  private verifyHeaders(expected: Record<string, string>, actual: any): string[] {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(expected)) {
      const actualValue = actual[key.toLowerCase()];
      if (actualValue !== value) {
        errors.push(\`Header '\${key}' mismatch: expected '\${value}', got '\${actualValue}'\`);
      }
    }

    return errors;
  }

  private compareObjects(expected: any, actual: any, path: string, errors: string[]): void {
    if (expected === null || expected === undefined) {
      if (actual !== null && actual !== undefined) {
        errors.push(\`\${path || 'root'}: expected null/undefined, got \${typeof actual}\`);
      }
      return;
    }

    if (typeof expected !== typeof actual) {
      errors.push(\`\${path || 'root'}: type mismatch - expected \${typeof expected}, got \${typeof actual}\`);
      return;
    }

    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) {
        errors.push(\`\${path || 'root'}: expected array, got \${typeof actual}\`);
        return;
      }

      for (let i = 0; i < expected.length; i++) {
        this.compareObjects(expected[i], actual[i], \`\${path}[\${i}]\`, errors);
      }
      return;
    }

    if (typeof expected === 'object') {
      for (const key of Object.keys(expected)) {
        this.compareObjects(
          expected[key],
          actual?.[key],
          path ? \`\${path}.\${key}\` : key,
          errors,
        );
      }
      return;
    }

    if (expected !== actual) {
      errors.push(\`\${path || 'root'}: value mismatch - expected \${expected}, got \${actual}\`);
    }
  }
}

/**
 * Create provider verifier
 */
export function createVerifier(app: INestApplication): ProviderVerifier {
  return new ProviderVerifier(app);
}
`;
}

function generateContractStore(): string {
  return `/**
 * Contract Store
 * Centralized storage for API contracts
 */

import * as fs from 'fs';
import * as path from 'path';
import { Contract } from './contract.validator';
import { Pact } from './consumer-test.helpers';

export interface StoredContract {
  id: string;
  contract: Contract | Pact;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Contract Store
 */
export class ContractStore {
  private contracts: Map<string, StoredContract> = new Map();
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(process.cwd(), 'contracts');
    this.ensureDirectory();
    this.loadContracts();
  }

  /**
   * Store a contract
   */
  store(id: string, contract: Contract | Pact, version: string, metadata?: Record<string, any>): void {
    const stored: StoredContract = {
      id,
      contract,
      version,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };

    this.contracts.set(id, stored);
    this.persist(id, stored);
  }

  /**
   * Get a contract
   */
  get(id: string): StoredContract | undefined {
    return this.contracts.get(id);
  }

  /**
   * Get contract by provider and consumer
   */
  getByProviderConsumer(provider: string, consumer: string): StoredContract[] {
    return Array.from(this.contracts.values()).filter(stored => {
      const contract = stored.contract;
      if ('provider' in contract) {
        return contract.provider === provider &&
          ('consumer' in contract ? contract.consumer === consumer : true);
      }
      return false;
    });
  }

  /**
   * List all contracts
   */
  list(): StoredContract[] {
    return Array.from(this.contracts.values());
  }

  /**
   * Remove a contract
   */
  remove(id: string): boolean {
    const existed = this.contracts.delete(id);
    if (existed) {
      this.deleteFile(id);
    }
    return existed;
  }

  /**
   * Get contract versions
   */
  getVersions(providerId: string): string[] {
    return Array.from(this.contracts.values())
      .filter(stored => stored.id.startsWith(providerId))
      .map(stored => stored.version)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
  }

  /**
   * Compare two contract versions
   */
  compareVersions(id: string, version1: string, version2: string): ContractDiff | null {
    const c1 = this.contracts.get(\`\${id}:\${version1}\`);
    const c2 = this.contracts.get(\`\${id}:\${version2}\`);

    if (!c1 || !c2) return null;

    return this.diffContracts(c1.contract, c2.contract);
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  private loadContracts(): void {
    if (!fs.existsSync(this.basePath)) return;

    const files = fs.readdirSync(this.basePath).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.basePath, file), 'utf-8');
        const stored = JSON.parse(content) as StoredContract;
        stored.createdAt = new Date(stored.createdAt);
        stored.updatedAt = new Date(stored.updatedAt);
        this.contracts.set(stored.id, stored);
      } catch (error) {
        console.warn(\`Failed to load contract: \${file}\`);
      }
    }
  }

  private persist(id: string, stored: StoredContract): void {
    const filePath = path.join(this.basePath, \`\${id.replace(/[:/]/g, '_')}.json\`);
    fs.writeFileSync(filePath, JSON.stringify(stored, null, 2));
  }

  private deleteFile(id: string): void {
    const filePath = path.join(this.basePath, \`\${id.replace(/[:/]/g, '_')}.json\`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  private diffContracts(c1: Contract | Pact, c2: Contract | Pact): ContractDiff {
    const diff: ContractDiff = {
      added: [],
      removed: [],
      modified: [],
    };

    // Simple diff based on endpoints/interactions
    const e1 = this.getEndpoints(c1);
    const e2 = this.getEndpoints(c2);

    const keys1 = new Set(e1.map(e => e.key));
    const keys2 = new Set(e2.map(e => e.key));

    for (const e of e2) {
      if (!keys1.has(e.key)) {
        diff.added.push(e.key);
      }
    }

    for (const e of e1) {
      if (!keys2.has(e.key)) {
        diff.removed.push(e.key);
      }
    }

    return diff;
  }

  private getEndpoints(contract: Contract | Pact): { key: string; data: any }[] {
    if ('endpoints' in contract) {
      return contract.endpoints.map(e => ({
        key: \`\${e.method}:\${e.path}\`,
        data: e,
      }));
    }
    if ('interactions' in contract) {
      return contract.interactions.map(i => ({
        key: \`\${i.request.method}:\${i.request.path}\`,
        data: i,
      }));
    }
    return [];
  }
}

interface ContractDiff {
  added: string[];
  removed: string[];
  modified: string[];
}

/**
 * Create contract store
 */
export function createContractStore(basePath?: string): ContractStore {
  return new ContractStore(basePath);
}
`;
}

function generateSampleContractTest(): string {
  return `/**
 * Sample Contract Test
 * Example of consumer-driven contract testing
 */

import { consumerContract, ConsumerTestRunner } from '../src/shared/contracts/consumer-test.helpers';
import { createVerifier } from '../src/shared/contracts/provider-test.helpers';
import { ContractValidator } from '../src/shared/contracts/contract.validator';

describe('User API Contract', () => {
  describe('Consumer Contract', () => {
    it('should define user creation contract', () => {
      const pact = consumerContract('web-app', 'user-service')
        .given('user creation')
        .uponReceiving('POST', '/api/users')
        .withHeaders({ 'Content-Type': 'application/json' })
        .withBody({
          email: 'test@example.com',
          name: 'Test User',
        })
        .willRespondWith(201)
        .withResponseBody({
          id: expect.any(String),
          email: 'test@example.com',
          name: 'Test User',
          createdAt: expect.any(String),
        })
        .given('get user by id')
        .uponReceiving('GET', '/api/users/123')
        .willRespondWith(200)
        .withResponseBody({
          id: '123',
          email: 'test@example.com',
          name: 'Test User',
        })
        .build();

      expect(pact.consumer).toBe('web-app');
      expect(pact.provider).toBe('user-service');
      expect(pact.interactions).toHaveLength(2);
    });
  });

  describe('Schema Validation', () => {
    it('should validate user response schema', () => {
      const validator = new ContractValidator();

      validator.registerContract({
        name: 'user-api',
        version: '1.0.0',
        provider: 'user-service',
        endpoints: [
          {
            method: 'GET',
            path: '/api/users/:id',
            response: {
              statusCode: 200,
              body: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  name: { type: 'string', minLength: 1 },
                },
                required: ['id', 'email', 'name'],
              },
            },
          },
        ],
      });

      const validResult = validator.validateResponse('GET', '/api/users/:id', 200, {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validateResponse('GET', '/api/users/:id', 200, {
        id: '123',
        email: 'invalid-email',
        name: '',
      });

      expect(invalidResult.valid).toBe(false);
    });
  });
});
`;
}
