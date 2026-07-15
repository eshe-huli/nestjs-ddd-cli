import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { generateAll } from '../../src/commands/generate-all';
import { getDryRunFiles } from '../../src/utils/file.utils';
import { resetConfigCache } from '../../src/utils/config.utils';

describe('Scaffold Generator', () => {
  const testDir = path.join(__dirname, '../.test-scaffold-output');

  beforeEach(async () => {
    resetConfigCache();
    await fs.remove(testDir);
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('does not write files during dry-run and reports planned changes', async () => {
    await generateAll('CapitalParty', {
      module: 'capital-markets',
      path: testDir,
      fields: 'legalName:string status:enum:active,inactive',
      dryRun: true,
    });

    expect(await fs.pathExists(path.join(testDir, 'src'))).toBe(false);

    const plannedFiles = getDryRunFiles().map((change) => path.relative(testDir, change.filePath));
    expect(plannedFiles).toContain('src/modules/capital-markets/capital-markets.module.ts');
    expect(plannedFiles).toContain(
      'src/modules/capital-markets/application/domain/entities/capital-party.entity.ts',
    );
    expect(plannedFiles).toContain(
      'src/modules/capital-markets/application/queries/get-all-capital-parties.query.ts',
    );
    expect(plannedFiles.some((filePath) => filePath.includes('capital-partys'))).toBe(false);
  });

  it('generates unescaped TypeScript and application-domain entity imports', async () => {
    await generateAll('CapitalParty', {
      module: 'capital-markets',
      path: testDir,
      fields: 'status:enum:active,inactive metadata:json',
    });

    const entityPath = path.join(
      testDir,
      'src/modules/capital-markets/application/domain/entities/capital-party.entity.ts',
    );
    const repositoryPath = path.join(
      testDir,
      'src/modules/capital-markets/infrastructure/repositories/capital-party.repository.ts',
    );
    const queryPath = path.join(
      testDir,
      'src/modules/capital-markets/application/queries/get-all-capital-parties.query.ts',
    );

    const entityContent = await fs.readFile(entityPath, 'utf-8');
    const repositoryContent = await fs.readFile(repositoryPath, 'utf-8');
    const createCommandContent = await fs.readFile(
      path.join(
        testDir,
        'src/modules/capital-markets/application/commands/create-capital-party.command.ts',
      ),
      'utf-8',
    );
    const updateCommandContent = await fs.readFile(
      path.join(
        testDir,
        'src/modules/capital-markets/application/commands/update-capital-party.command.ts',
      ),
      'utf-8',
    );
    const deleteCommandContent = await fs.readFile(
      path.join(
        testDir,
        'src/modules/capital-markets/application/commands/delete-capital-party.command.ts',
      ),
      'utf-8',
    );

    expect(await fs.pathExists(queryPath)).toBe(true);
    expect(entityContent).toContain("status: 'active' | 'inactive';");
    expect(entityContent).toContain('metadata: Record<string, any>;');
    expect(entityContent).not.toMatch(/&#x27;|&lt;|&gt;|&quot;/);
    expect(repositoryContent).toContain(
      '@modules/capital-markets/application/domain/entities/capital-party.entity',
    );
    for (const commandContent of [
      createCommandContent,
      updateCommandContent,
      deleteCommandContent,
    ]) {
      expect(commandContent).toContain('/application/domain/usecases/');
      expect(commandContent).not.toContain('/application/usecases/');
    }
  });

  it('preserves camelCase contracts and imports every emitted validator', async () => {
    await generateAll('Certification', {
      module: 'certifications',
      path: testDir,
      fields: 'tenantId:uuid phoneNumber:string metadata:json amount:decimal tags:string[]',
    });

    const entityContent = await fs.readFile(
      path.join(
        testDir,
        'src/modules/certifications/application/domain/entities/certification.entity.ts',
      ),
      'utf-8',
    );
    const dtoContent = await fs.readFile(
      path.join(
        testDir,
        'src/modules/certifications/application/dto/requests/create-certification.dto.ts',
      ),
      'utf-8',
    );

    expect(entityContent).toContain('tenantId: string;');
    expect(entityContent).not.toContain('tenantid');
    expect(dtoContent).toContain('tenantId: string;');
    expect(dtoContent).toMatch(/\bMatches\b/);
    expect(dtoContent).toMatch(/\bMaxLength\b/);
    expect(dtoContent).toMatch(/\bIsObject\b/);
    expect(dtoContent).toMatch(/\bMin\b/);
    expect(dtoContent).toMatch(/\bMax\b/);
    expect(dtoContent).toMatch(/\bArrayMaxSize\b/);
  });

  it('keeps money exact and server-owned fields out of request assignment paths', async () => {
    await generateAll('LedgerLine', {
      module: 'ledger',
      path: testDir,
      fields: 'amount:money memo:string:optional tenantId:uuid:serverOwned',
    });

    const modulePath = path.join(testDir, 'src/modules/ledger');
    const [entity, ormEntity, createDto, responseDto, createCommand, createUseCase, updateUseCase] =
      await Promise.all([
        fs.readFile(
          path.join(modulePath, 'application/domain/entities/ledger-line.entity.ts'),
          'utf-8',
        ),
        fs.readFile(
          path.join(modulePath, 'infrastructure/orm-entities/ledger-line.orm-entity.ts'),
          'utf-8',
        ),
        fs.readFile(
          path.join(modulePath, 'application/dto/requests/create-ledger-line.dto.ts'),
          'utf-8',
        ),
        fs.readFile(
          path.join(modulePath, 'application/dto/responses/ledger-line.response.dto.ts'),
          'utf-8',
        ),
        fs.readFile(
          path.join(modulePath, 'application/commands/create-ledger-line.command.ts'),
          'utf-8',
        ),
        fs.readFile(
          path.join(modulePath, 'application/domain/usecases/create-ledger-line.use-case.ts'),
          'utf-8',
        ),
        fs.readFile(
          path.join(modulePath, 'application/domain/usecases/update-ledger-line.use-case.ts'),
          'utf-8',
        ),
      ]);

    expect(entity).toContain('amount: string;');
    expect(entity).toContain('tenantId: string;');
    expect(ormEntity).toMatch(/@Column\(\{ type: "decimal" \}\)\s+amount: string;/);
    expect(createDto).toContain('@IsDecimal({ decimal_digits: \'0,18\', force_decimal: false })');
    expect(createDto).toContain('type: String, format: "decimal", example: "1250.00"');
    expect(createDto).not.toContain('tenantId');
    expect(responseDto).toContain('amount: string;');
    expect(responseDto).toContain('tenantId: string;');
    expect(createCommand).toContain('CreateLedgerLineServerOwnedFields');
    expect(createUseCase).toContain('tenantId: serverOwnedFields.tenantId');
    expect(createUseCase).toContain('amount: dto.amount');
    expect(createUseCase).not.toContain('...dto');
    expect(updateUseCase).not.toContain('dto.tenantId');
    expect(updateUseCase).not.toContain('...dto');

    const migrationFiles = await fs.readdir(path.join(testDir, 'src/migrations'));
    const migration = await fs.readFile(
      path.join(
        testDir,
        'src/migrations',
        migrationFiles.find((fileName) => fileName.includes('create_ledger_lines_table'))!,
      ),
      'utf-8',
    );
    expect(migration).toMatch(/name: "amount",\s+type: "decimal"/);
  });

  it('generates tests with resolvable sibling imports', async () => {
    await generateAll('PermissionAssignment', {
      module: 'permissions',
      path: testDir,
      fields: 'subjectId:string active:boolean',
      withTests: true,
    });

    const controllerTest = await fs.readFile(
      path.join(
        testDir,
        'src/modules/permissions/application/controllers/permission-assignment.controller.spec.ts',
      ),
      'utf-8',
    );
    const repositoryTest = await fs.readFile(
      path.join(
        testDir,
        'src/modules/permissions/infrastructure/repositories/permission-assignment.repository.spec.ts',
      ),
      'utf-8',
    );
    const useCaseTest = await fs.readFile(
      path.join(
        testDir,
        'src/modules/permissions/application/domain/usecases/permission-assignment.use-case.spec.ts',
      ),
      'utf-8',
    );

    expect(controllerTest).toContain('from "./permission-assignment.controller"');
    expect(repositoryTest).toContain('from "./permission-assignment.repository"');
    expect(useCaseTest).toContain('from "./create-permission-assignment.use-case"');
  });

  it('writes scaffold migrations to the default src/migrations directory', async () => {
    await generateAll('LedgerEntry', {
      module: 'ledger',
      path: testDir,
      fields: 'amount:decimal',
    });

    const migrationFiles = await fs.readdir(path.join(testDir, 'src/migrations'));
    expect(
      migrationFiles.some((fileName) => fileName.endsWith('-create_ledger_entries_table.ts')),
    ).toBe(true);
  });

  it('uses paths.migrations from .dddrc.json for scaffold migrations', async () => {
    const workspacePath = path.join(testDir, 'workspace');
    const appPath = path.join(workspacePath, 'apps/api');
    const migrationsPath = path.join(workspacePath, 'packages/infra/src/migrations');
    await fs.ensureDir(path.join(workspacePath, '.git'));
    await fs.ensureDir(appPath);
    await fs.writeJson(path.join(appPath, '.dddrc.json'), {
      paths: {
        migrations: '../../packages/infra/src/migrations',
      },
    });

    await generateAll('SettlementBatch', {
      module: 'settlements',
      path: appPath,
      fields: 'reference:string',
      dryRun: true,
    });

    expect(
      getDryRunFiles().some(
        (change) =>
          path.dirname(change.filePath) === migrationsPath &&
          path.basename(change.filePath).endsWith('-create_settlement_batches_table.ts'),
      ),
    ).toBe(true);
    expect(await fs.pathExists(path.join(appPath, 'src/migrations'))).toBe(false);
  });

  it('merges barrel indexes across scaffold runs without dropping existing registrations', async () => {
    await generateAll('ExecutionIntent', {
      module: 'capital-markets',
      path: testDir,
      fields: 'intentReference:string',
    });
    await generateAll('CapitalParty', {
      module: 'capital-markets',
      path: testDir,
      fields: 'legalName:string',
    });
    await generateAll('CapitalParty', {
      module: 'capital-markets',
      path: testDir,
      fields: 'legalName:string',
    });

    const commandsIndex = await fs.readFile(
      path.join(testDir, 'src/modules/capital-markets/application/commands/index.ts'),
      'utf-8',
    );
    const controllersIndex = await fs.readFile(
      path.join(testDir, 'src/modules/capital-markets/application/controllers/index.ts'),
      'utf-8',
    );
    const ormIndex = await fs.readFile(
      path.join(testDir, 'src/modules/capital-markets/infrastructure/orm-entities/index.ts'),
      'utf-8',
    );

    expect(commandsIndex).toContain('CreateExecutionIntentHandler');
    expect(commandsIndex).toContain('CreateCapitalPartyHandler');
    expect(commandsIndex.match(/CreateCapitalPartyHandler/g)).toHaveLength(2);
    expect(controllersIndex).toContain('ExecutionIntentController');
    expect(controllersIndex).toContain('CapitalPartyController');
    expect(ormIndex).toContain('ExecutionIntentOrmEntity');
    expect(ormIndex).toContain('CapitalPartyOrmEntity');
  });
});
