import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../utils/file.utils';

export interface TestScaffoldOptions {
  path?: string;
  module?: string;
  type?: 'unit' | 'integration' | 'e2e' | 'all';
  coverage?: boolean;
}

interface EntityInfo {
  name: string;
  moduleName: string;
  fields: Array<{ name: string; type: string }>;
  hasRelations: boolean;
}

export async function generateTestScaffold(entityName: string, options: TestScaffoldOptions = {}): Promise<void> {
  console.log(chalk.bold.blue(`\n🧪 Generating Test Scaffold for ${entityName}\n`));

  const basePath = options.path || process.cwd();
  const moduleName = options.module || entityName.toLowerCase();
  const modulePath = path.join(basePath, 'src/modules', moduleName);

  if (!fs.existsSync(modulePath)) {
    console.log(chalk.red(`❌ Module "${moduleName}" not found.`));
    return;
  }

  // Find entity and extract info
  const entityInfo = await extractEntityInfo(modulePath, entityName);

  if (!entityInfo) {
    console.log(chalk.yellow(`⚠️ Entity "${entityName}" not found, generating generic tests.`));
  }

  const testType = options.type || 'all';

  // Generate test factory
  await generateFactory(modulePath, entityName, entityInfo);

  // Generate unit tests
  if (testType === 'unit' || testType === 'all') {
    await generateUnitTests(modulePath, entityName, entityInfo);
  }

  // Generate integration tests
  if (testType === 'integration' || testType === 'all') {
    await generateIntegrationTests(modulePath, entityName, entityInfo);
  }

  // Generate E2E tests
  if (testType === 'e2e' || testType === 'all') {
    await generateE2ETests(basePath, moduleName, entityName, entityInfo);
  }

  console.log(chalk.green(`\n✅ Test scaffold generated for ${entityName}`));
}

async function extractEntityInfo(modulePath: string, entityName: string): Promise<EntityInfo | null> {
  const entityFiles = findFiles(modulePath, '.entity.ts');
  const entityFile = entityFiles.find(f =>
    path.basename(f).toLowerCase().includes(entityName.toLowerCase())
  );

  if (!entityFile) return null;

  const content = fs.readFileSync(entityFile, 'utf-8');
  const fields: Array<{ name: string; type: string }> = [];

  // Extract fields
  const fieldRegex = /@Column[^)]*\)\s*(\w+)(?:\?)?:\s*(\w+)/g;
  let match;

  while ((match = fieldRegex.exec(content)) !== null) {
    fields.push({ name: match[1], type: match[2] });
  }

  const hasRelations = content.includes('@ManyToOne') ||
                       content.includes('@OneToMany') ||
                       content.includes('@OneToOne') ||
                       content.includes('@ManyToMany');

  return {
    name: entityName,
    moduleName: path.basename(modulePath),
    fields,
    hasRelations,
  };
}

async function generateFactory(modulePath: string, entityName: string, info: EntityInfo | null): Promise<void> {
  const testPath = path.join(modulePath, '__tests__');
  const factoriesPath = path.join(testPath, 'factories');
  await ensureDir(factoriesPath);

  const pascalName = toPascalCase(entityName);
  const camelName = toCamelCase(entityName);

  const fieldGenerators = info?.fields.map(f => {
    const generator = getFieldGenerator(f.name, f.type);
    return `    ${f.name}: ${generator},`;
  }).join('\n') || `    id: faker.string.uuid(),
    name: faker.lorem.word(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),`;

  const content = `import { faker } from '@faker-js/faker';
import { ${pascalName} } from '../../domain/entities/${toKebabCase(entityName)}.entity';

export interface ${pascalName}FactoryOptions {
  id?: string;
${info?.fields.map(f => `  ${f.name}?: ${mapToTsType(f.type)};`).join('\n') || '  name?: string;'}
}

/**
 * Factory for creating ${pascalName} instances for testing
 */
export class ${pascalName}Factory {
  /**
   * Create a single ${pascalName} instance with random data
   */
  static create(overrides: Partial<${pascalName}FactoryOptions> = {}): ${pascalName} {
    const defaults = {
      id: faker.string.uuid(),
${fieldGenerators}
    };

    return Object.assign(new ${pascalName}(), { ...defaults, ...overrides });
  }

  /**
   * Create multiple ${pascalName} instances
   */
  static createMany(count: number, overrides: Partial<${pascalName}FactoryOptions> = {}): ${pascalName}[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create a ${pascalName} with minimal required fields
   */
  static createMinimal(overrides: Partial<${pascalName}FactoryOptions> = {}): ${pascalName} {
    return this.create({
      id: faker.string.uuid(),
      ...overrides,
    });
  }

  /**
   * Create ${pascalName} data without instantiating entity (for DTOs)
   */
  static createData(overrides: Partial<${pascalName}FactoryOptions> = {}): ${pascalName}FactoryOptions {
    return {
      id: faker.string.uuid(),
${fieldGenerators}
      ...overrides,
    };
  }
}

/**
 * Builder pattern for complex ${pascalName} setup
 */
export class ${pascalName}Builder {
  private data: Partial<${pascalName}FactoryOptions> = {};

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

${info?.fields.map(f => `  with${toPascalCase(f.name)}(${f.name}: ${mapToTsType(f.type)}): this {
    this.data.${f.name} = ${f.name};
    return this;
  }`).join('\n\n') || `  withName(name: string): this {
    this.data.name = name;
    return this;
  }`}

  build(): ${pascalName} {
    return ${pascalName}Factory.create(this.data);
  }

  buildData(): ${pascalName}FactoryOptions {
    return ${pascalName}Factory.createData(this.data);
  }
}
`;

  await writeFile(path.join(factoriesPath, `${toKebabCase(entityName)}.factory.ts`), content);
  console.log(chalk.green(`  ✓ Factory: ${entityName}Factory`));
}

async function generateUnitTests(modulePath: string, entityName: string, info: EntityInfo | null): Promise<void> {
  const testPath = path.join(modulePath, '__tests__/unit');
  await ensureDir(testPath);

  const pascalName = toPascalCase(entityName);
  const camelName = toCamelCase(entityName);

  // Service unit test
  const serviceTestContent = `import { Test, TestingModule } from '@nestjs/testing';
import { ${pascalName}Service } from '../../application/services/${toKebabCase(entityName)}.service';
import { ${pascalName}Repository } from '../../infrastructure/repositories/${toKebabCase(entityName)}.repository';
import { ${pascalName}Factory } from '../factories/${toKebabCase(entityName)}.factory';

describe('${pascalName}Service', () => {
  let service: ${pascalName}Service;
  let repository: jest.Mocked<${pascalName}Repository>;

  const mockRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ${pascalName}Service,
        {
          provide: ${pascalName}Repository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<${pascalName}Service>(${pascalName}Service);
    repository = module.get(${pascalName}Repository);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all ${camelName}s', async () => {
      const expected = ${pascalName}Factory.createMany(3);
      mockRepository.findAll.mockResolvedValue(expected);

      const result = await service.findAll();

      expect(result).toEqual(expected);
      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no ${camelName}s exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return ${camelName} when found', async () => {
      const expected = ${pascalName}Factory.create();
      mockRepository.findById.mockResolvedValue(expected);

      const result = await service.findById(expected.id);

      expect(result).toEqual(expected);
      expect(mockRepository.findById).toHaveBeenCalledWith(expected.id);
    });

    it('should return null when ${camelName} not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create and return new ${camelName}', async () => {
      const data = ${pascalName}Factory.createData();
      const expected = ${pascalName}Factory.create(data);
      mockRepository.create.mockResolvedValue(expected);

      const result = await service.create(data);

      expect(result).toEqual(expected);
      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining(data));
    });
  });

  describe('update', () => {
    it('should update and return ${camelName}', async () => {
      const existing = ${pascalName}Factory.create();
      const updateData = { id: existing.id };
      mockRepository.update.mockResolvedValue({ ...existing, ...updateData });

      const result = await service.update(existing.id, updateData);

      expect(result).toBeDefined();
      expect(mockRepository.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete ${camelName}', async () => {
      const ${camelName} = ${pascalName}Factory.create();
      mockRepository.delete.mockResolvedValue(undefined);

      await service.delete(${camelName}.id);

      expect(mockRepository.delete).toHaveBeenCalledWith(${camelName}.id);
    });
  });
});
`;

  await writeFile(path.join(testPath, `${toKebabCase(entityName)}.service.spec.ts`), serviceTestContent);
  console.log(chalk.green(`  ✓ Unit test: ${entityName}Service`));

  // Entity unit test
  const entityTestContent = `import { ${pascalName} } from '../../domain/entities/${toKebabCase(entityName)}.entity';
import { ${pascalName}Factory } from '../factories/${toKebabCase(entityName)}.factory';

describe('${pascalName} Entity', () => {
  describe('creation', () => {
    it('should create a valid ${camelName}', () => {
      const ${camelName} = ${pascalName}Factory.create();

      expect(${camelName}).toBeInstanceOf(${pascalName});
      expect(${camelName}.id).toBeDefined();
    });

    it('should create with custom values', () => {
      const customId = 'custom-id';
      const ${camelName} = ${pascalName}Factory.create({ id: customId });

      expect(${camelName}.id).toBe(customId);
    });
  });

  describe('validation', () => {
    it('should have required fields', () => {
      const ${camelName} = ${pascalName}Factory.create();

      expect(${camelName}.id).toBeDefined();
      // Add more field validations based on entity
    });
  });
});
`;

  await writeFile(path.join(testPath, `${toKebabCase(entityName)}.entity.spec.ts`), entityTestContent);
  console.log(chalk.green(`  ✓ Unit test: ${entityName} Entity`));
}

async function generateIntegrationTests(modulePath: string, entityName: string, info: EntityInfo | null): Promise<void> {
  const testPath = path.join(modulePath, '__tests__/integration');
  await ensureDir(testPath);

  const pascalName = toPascalCase(entityName);
  const camelName = toCamelCase(entityName);

  const content = `import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${pascalName}Service } from '../../application/services/${toKebabCase(entityName)}.service';
import { ${pascalName}Repository } from '../../infrastructure/repositories/${toKebabCase(entityName)}.repository';
import { ${pascalName} } from '../../domain/entities/${toKebabCase(entityName)}.entity';
import { ${pascalName}Factory } from '../factories/${toKebabCase(entityName)}.factory';

describe('${pascalName}Service Integration', () => {
  let module: TestingModule;
  let service: ${pascalName}Service;
  let repository: ${pascalName}Repository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [${pascalName}],
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([${pascalName}]),
      ],
      providers: [${pascalName}Service, ${pascalName}Repository],
    }).compile();

    service = module.get<${pascalName}Service>(${pascalName}Service);
    repository = module.get<${pascalName}Repository>(${pascalName}Repository);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    // await repository.clear();
  });

  describe('CRUD operations', () => {
    it('should create and retrieve ${camelName}', async () => {
      const data = ${pascalName}Factory.createData();

      const created = await service.create(data);
      expect(created.id).toBeDefined();

      const found = await service.findById(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should update ${camelName}', async () => {
      const created = await service.create(${pascalName}Factory.createData());

      const updated = await service.update(created.id, { /* update data */ });

      expect(updated).toBeDefined();
    });

    it('should delete ${camelName}', async () => {
      const created = await service.create(${pascalName}Factory.createData());

      await service.delete(created.id);

      const found = await service.findById(created.id);
      expect(found).toBeNull();
    });

    it('should list all ${camelName}s', async () => {
      // Create multiple
      await Promise.all([
        service.create(${pascalName}Factory.createData()),
        service.create(${pascalName}Factory.createData()),
      ]);

      const all = await service.findAll();

      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });
});
`;

  await writeFile(path.join(testPath, `${toKebabCase(entityName)}.integration.spec.ts`), content);
  console.log(chalk.green(`  ✓ Integration test: ${entityName}Service`));
}

async function generateE2ETests(basePath: string, moduleName: string, entityName: string, info: EntityInfo | null): Promise<void> {
  const e2ePath = path.join(basePath, 'test');
  await ensureDir(e2ePath);

  const pascalName = toPascalCase(entityName);
  const kebabName = toKebabCase(entityName);
  const pluralName = kebabName + 's';

  const content = `import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('${pascalName}Controller (e2e)', () => {
  let app: INestApplication;
  let created${pascalName}Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /${pluralName}', () => {
    it('should create a new ${kebabName}', () => {
      return request(app.getHttpServer())
        .post('/${pluralName}')
        .send({
          // Add required fields
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          created${pascalName}Id = res.body.id;
        });
    });

    it('should return 400 for invalid data', () => {
      return request(app.getHttpServer())
        .post('/${pluralName}')
        .send({})
        .expect(400);
    });
  });

  describe('GET /${pluralName}', () => {
    it('should return all ${pluralName}', () => {
      return request(app.getHttpServer())
        .get('/${pluralName}')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/${pluralName}?page=1&limit=10')
        .expect(200);
    });
  });

  describe('GET /${pluralName}/:id', () => {
    it('should return a ${kebabName} by id', () => {
      return request(app.getHttpServer())
        .get(\`/${pluralName}/\${created${pascalName}Id}\`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(created${pascalName}Id);
        });
    });

    it('should return 404 for non-existent id', () => {
      return request(app.getHttpServer())
        .get('/${pluralName}/non-existent-id')
        .expect(404);
    });
  });

  describe('PATCH /${pluralName}/:id', () => {
    it('should update a ${kebabName}', () => {
      return request(app.getHttpServer())
        .patch(\`/${pluralName}/\${created${pascalName}Id}\`)
        .send({
          // Add update data
        })
        .expect(200);
    });
  });

  describe('DELETE /${pluralName}/:id', () => {
    it('should delete a ${kebabName}', () => {
      return request(app.getHttpServer())
        .delete(\`/${pluralName}/\${created${pascalName}Id}\`)
        .expect(200);
    });

    it('should return 404 after deletion', () => {
      return request(app.getHttpServer())
        .get(\`/${pluralName}/\${created${pascalName}Id}\`)
        .expect(404);
    });
  });
});
`;

  await writeFile(path.join(e2ePath, `${toKebabCase(entityName)}.e2e-spec.ts`), content);
  console.log(chalk.green(`  ✓ E2E test: ${entityName}Controller`));
}

function getFieldGenerator(name: string, type: string): string {
  const generators: Record<string, string> = {
    'string': 'faker.lorem.word()',
    'number': 'faker.number.int({ min: 1, max: 1000 })',
    'boolean': 'faker.datatype.boolean()',
    'Date': 'faker.date.past()',
    'text': 'faker.lorem.paragraph()',
  };

  // Special cases based on field name
  if (name.includes('email')) return 'faker.internet.email()';
  if (name.includes('name')) return 'faker.person.fullName()';
  if (name.includes('firstName')) return 'faker.person.firstName()';
  if (name.includes('lastName')) return 'faker.person.lastName()';
  if (name.includes('url') || name.includes('Url')) return 'faker.internet.url()';
  if (name.includes('phone')) return 'faker.phone.number()';
  if (name.includes('address')) return 'faker.location.streetAddress()';
  if (name.includes('price') || name.includes('amount')) return 'faker.number.float({ min: 0, max: 1000, fractionDigits: 2 })';
  if (name.includes('description') || name.includes('bio')) return 'faker.lorem.paragraph()';

  return generators[type] || 'faker.lorem.word()';
}

function mapToTsType(type: string): string {
  const map: Record<string, string> = {
    'string': 'string',
    'number': 'number',
    'boolean': 'boolean',
    'Date': 'Date',
    'text': 'string',
  };
  return map[type] || 'any';
}

function findFiles(dir: string, extension: string): string[] {
  const files: string[] = [];
  function scan(d: string) {
    if (!fs.existsSync(d)) return;
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) scan(p);
      else if (e.name.endsWith(extension)) files.push(p);
    }
  }
  scan(dir);
  return files;
}

function toPascalCase(str: string): string {
  return str.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}
