import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { generateAll } from '../../src/commands/generate-all';
import { getDryRunFiles } from '../../src/utils/file.utils';

describe('Scaffold Generator', () => {
  const testDir = path.join(__dirname, '../.test-scaffold-output');

  beforeEach(async () => {
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

    expect(await fs.pathExists(queryPath)).toBe(true);
    expect(entityContent).toContain("status: 'active' | 'inactive';");
    expect(entityContent).toContain('metadata: Record<string, any>;');
    expect(entityContent).not.toMatch(/&#x27;|&lt;|&gt;|&quot;/);
    expect(repositoryContent).toContain(
      '@modules/capital-markets/application/domain/entities/capital-party.entity',
    );
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
