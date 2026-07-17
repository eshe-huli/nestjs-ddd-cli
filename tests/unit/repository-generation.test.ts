import { afterEach, describe, expect, it } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { generateAll } from '../../src/commands/generate-all';
import { generateEntity } from '../../src/commands/generate-entity';
import { resetConfigCache } from '../../src/utils/config.utils';
import {
  compileGeneratedRepositoryFixture,
  FixtureOrm,
} from '../helpers/generated-fixture-compiler';

interface GeneratedSafetySummary {
  orm: FixtureOrm;
  domainHasDeletedAt: boolean;
  storageHasDeletedAt: boolean;
  migrationOrSchemaHasDeletedAt: boolean;
  mapperHasDeletedAt: boolean;
  repositoryFiltersDeletedRows: boolean;
  deleteStrategy: 'soft' | 'physical' | 'unknown';
  hasHardDeleteHelper: boolean;
  hasBoundedOrderByContract: boolean;
  queryChecksOrderByField: boolean;
  repositoryTestAdapter: 'typeorm' | 'prisma' | 'unknown';
  repositoryTestUsesDeletedAt: boolean;
}

describe('Safe repository scaffold generation', () => {
  const testDir = path.join(__dirname, '../.test-repository-generation-output');

  afterEach(async () => {
    resetConfigCache();
    await fs.remove(testDir);
  });

  it('generates compile-safe ordinary CRUD without soft-delete artifacts', async () => {
    const summaries = [
      await generateFixture('typeorm-soft-delete-off', 'typeorm', false),
      await generateFixture('prisma-soft-delete-off', 'prisma', false),
    ];

    expect(summaries).toMatchInlineSnapshot(`
[
  {
    "deleteStrategy": "physical",
    "domainHasDeletedAt": false,
    "hasBoundedOrderByContract": true,
    "hasHardDeleteHelper": false,
    "mapperHasDeletedAt": false,
    "migrationOrSchemaHasDeletedAt": false,
    "orm": "typeorm",
    "queryChecksOrderByField": true,
    "repositoryFiltersDeletedRows": false,
    "repositoryTestAdapter": "typeorm",
    "repositoryTestUsesDeletedAt": false,
    "storageHasDeletedAt": false,
  },
  {
    "deleteStrategy": "physical",
    "domainHasDeletedAt": false,
    "hasBoundedOrderByContract": true,
    "hasHardDeleteHelper": false,
    "mapperHasDeletedAt": false,
    "migrationOrSchemaHasDeletedAt": false,
    "orm": "prisma",
    "queryChecksOrderByField": true,
    "repositoryFiltersDeletedRows": false,
    "repositoryTestAdapter": "prisma",
    "repositoryTestUsesDeletedAt": false,
    "storageHasDeletedAt": false,
  },
]
`);
  });

  it('generates compile-safe soft deletion without a hard-delete helper by default', async () => {
    const summaries = [
      await generateFixture('typeorm-soft-delete-on', 'typeorm', true),
      await generateFixture('prisma-soft-delete-on', 'prisma', true),
    ];

    expect(summaries).toMatchInlineSnapshot(`
[
  {
    "deleteStrategy": "soft",
    "domainHasDeletedAt": true,
    "hasBoundedOrderByContract": true,
    "hasHardDeleteHelper": false,
    "mapperHasDeletedAt": true,
    "migrationOrSchemaHasDeletedAt": true,
    "orm": "typeorm",
    "queryChecksOrderByField": true,
    "repositoryFiltersDeletedRows": true,
    "repositoryTestAdapter": "typeorm",
    "repositoryTestUsesDeletedAt": true,
    "storageHasDeletedAt": true,
  },
  {
    "deleteStrategy": "soft",
    "domainHasDeletedAt": true,
    "hasBoundedOrderByContract": true,
    "hasHardDeleteHelper": false,
    "mapperHasDeletedAt": true,
    "migrationOrSchemaHasDeletedAt": true,
    "orm": "prisma",
    "queryChecksOrderByField": true,
    "repositoryFiltersDeletedRows": true,
    "repositoryTestAdapter": "prisma",
    "repositoryTestUsesDeletedAt": true,
    "storageHasDeletedAt": true,
  },
]
`);
  });

  it('restores only the separately named hardDelete helper when explicitly opted in', async () => {
    const summaries = [
      await generateFixture('typeorm-hard-delete-opt-in', 'typeorm', true, true),
      await generateFixture('prisma-hard-delete-opt-in', 'prisma', true, true),
    ];

    expect(
      summaries.map(({ orm, deleteStrategy, hasHardDeleteHelper }) => ({
        orm,
        deleteStrategy,
        hasHardDeleteHelper,
      })),
    ).toEqual([
      { orm: 'typeorm', deleteStrategy: 'soft', hasHardDeleteHelper: true },
      { orm: 'prisma', deleteStrategy: 'soft', hasHardDeleteHelper: true },
    ]);
  });

  it('applies configured ORM and soft-delete behavior to direct entity generation', async () => {
    for (const orm of ['typeorm', 'prisma'] as const) {
      const fixturePath = path.join(testDir, `${orm}-direct-entity`);
      await fs.ensureDir(fixturePath);
      await fs.writeJson(path.join(fixturePath, '.dddrc.json'), {
        orm,
        features: { softDelete: false },
      });

      resetConfigCache();
      await generateEntity('Invoice', {
        module: 'billing',
        path: fixturePath,
        fields: 'amount:decimal reference:string',
      });

      const modulePath = path.join(fixturePath, 'src/modules/billing');
      const generatedFiles = await Promise.all([
        fs.readFile(
          path.join(modulePath, 'application/domain/entities/invoice.entity.ts'),
          'utf-8',
        ),
        fs.readFile(path.join(modulePath, 'infrastructure/mappers/invoice.mapper.ts'), 'utf-8'),
        fs.readFile(
          path.join(modulePath, 'infrastructure/repositories/invoice.repository.ts'),
          'utf-8',
        ),
      ]);

      expect(generatedFiles.join('\n')).not.toMatch(/deletedAt|deleted_at/);
      expect(generatedFiles[2]).toContain(
        orm === 'prisma' ? 'private readonly prisma: PrismaService' : 'InjectRepository',
      );
      expect(
        await fs.pathExists(
          path.join(modulePath, 'infrastructure/orm-entities/invoice.orm-entity.ts'),
        ),
      ).toBe(orm === 'typeorm');
    }
  });

  it('names pagination contracts per aggregate in a shared module', async () => {
    const fixturePath = path.join(testDir, 'shared-module-pagination');
    await fs.ensureDir(fixturePath);
    await fs.writeJson(path.join(fixturePath, '.dddrc.json'), {
      orm: 'typeorm',
      features: { softDelete: false },
    });

    resetConfigCache();
    await generateAll('Invoice', {
      module: 'billing',
      path: fixturePath,
      fields: 'amount:decimal reference:string',
      orm: 'typeorm',
    });
    await generateAll('CreditMemo', {
      module: 'billing',
      path: fixturePath,
      fields: 'amount:decimal reference:string',
      orm: 'typeorm',
    });

    const repositoryPath = path.join(
      fixturePath,
      'src/modules/billing/infrastructure/repositories',
    );
    const invoiceRepository = await fs.readFile(
      path.join(repositoryPath, 'invoice.repository.ts'),
      'utf-8',
    );
    const creditMemoRepository = await fs.readFile(
      path.join(repositoryPath, 'credit-memo.repository.ts'),
      'utf-8',
    );

    expect(invoiceRepository).toContain('export interface InvoicePaginationOptions');
    expect(invoiceRepository).toContain('options: InvoicePaginationOptions');
    expect(creditMemoRepository).toContain('export interface CreditMemoPaginationOptions');
    expect(creditMemoRepository).toContain('options: CreditMemoPaginationOptions');
  });

  async function generateFixture(
    fixtureName: string,
    orm: FixtureOrm,
    softDelete: boolean,
    hardDelete = false,
  ): Promise<GeneratedSafetySummary> {
    const fixturePath = path.join(testDir, fixtureName);
    await fs.ensureDir(fixturePath);
    await fs.writeJson(path.join(fixturePath, '.dddrc.json'), {
      orm,
      features: {
        softDelete,
        hardDelete,
      },
    });

    resetConfigCache();
    await generateAll('Invoice', {
      module: 'billing',
      path: fixturePath,
      fields: 'amount:decimal reference:string',
      orm,
      withTests: true,
    });

    const diagnostics = await compileGeneratedRepositoryFixture(fixturePath, orm, softDelete);
    expect(diagnostics).toEqual([]);

    return summarizeFixture(fixturePath, orm);
  }
});

async function summarizeFixture(
  fixturePath: string,
  orm: FixtureOrm,
): Promise<GeneratedSafetySummary> {
  const modulePath = path.join(fixturePath, 'src/modules/billing');
  const repository = await fs.readFile(
    path.join(modulePath, 'infrastructure/repositories/invoice.repository.ts'),
    'utf-8',
  );
  const domainEntity = await fs.readFile(
    path.join(modulePath, 'application/domain/entities/invoice.entity.ts'),
    'utf-8',
  );
  const mapper = await fs.readFile(
    path.join(modulePath, 'infrastructure/mappers/invoice.mapper.ts'),
    'utf-8',
  );
  const query = await fs.readFile(
    path.join(modulePath, 'application/queries/get-all-invoices.query.ts'),
    'utf-8',
  );
  const repositoryTest = await fs.readFile(
    path.join(modulePath, 'infrastructure/repositories/invoice.repository.spec.ts'),
    'utf-8',
  );
  const storage = await fs.readFile(
    orm === 'typeorm'
      ? path.join(modulePath, 'infrastructure/orm-entities/invoice.orm-entity.ts')
      : path.join(fixturePath, 'prisma/snippets/invoice.prisma'),
    'utf-8',
  );
  const migrationOrSchema =
    orm === 'typeorm' ? await readOnlyFile(path.join(fixturePath, 'src/migrations')) : storage;
  const deleteMethod = extractMethod(repository, 'delete');

  return {
    orm,
    domainHasDeletedAt: /deletedAt/.test(domainEntity),
    storageHasDeletedAt: /deletedAt|deleted_at/.test(storage),
    migrationOrSchemaHasDeletedAt: /deletedAt|deleted_at/.test(migrationOrSchema),
    mapperHasDeletedAt: /deletedAt|deleted_at/.test(mapper),
    repositoryFiltersDeletedRows: /deletedAt:\s*null|deleted_at:\s*null/.test(repository),
    deleteStrategy: getDeleteStrategy(deleteMethod),
    hasHardDeleteHelper: /async hardDelete\(/.test(repository),
    hasBoundedOrderByContract:
      /export type InvoiceOrderField/.test(repository) &&
      /orderBy:\s*InvoiceOrderField;/.test(repository),
    queryChecksOrderByField: /InvoiceRepository\.isOrderByField\(sortBy\)/.test(query),
    repositoryTestAdapter: /@nestjs\/typeorm/.test(repositoryTest)
      ? 'typeorm'
      : /@prisma\/prisma\.service/.test(repositoryTest)
        ? 'prisma'
        : 'unknown',
    repositoryTestUsesDeletedAt: /deletedAt|deleted_at/.test(repositoryTest),
  };
}

function extractMethod(source: string, methodName: string): string {
  const start = source.indexOf(`  async ${methodName}(`);
  if (start < 0) {
    return '';
  }

  const nextMethod = source.indexOf('\n  async ', start + 1);
  return source.slice(start, nextMethod < 0 ? source.length : nextMethod);
}

function getDeleteStrategy(methodBody: string): 'soft' | 'physical' | 'unknown' {
  if (/deletedAt|deleted_at|softDelete/.test(methodBody)) {
    return 'soft';
  }
  if (/\.delete\(/.test(methodBody)) {
    return 'physical';
  }
  return 'unknown';
}

async function readOnlyFile(directoryPath: string): Promise<string> {
  const fileNames = await fs.readdir(directoryPath);
  expect(fileNames).toHaveLength(1);
  return fs.readFile(path.join(directoryPath, fileNames[0]!), 'utf-8');
}
