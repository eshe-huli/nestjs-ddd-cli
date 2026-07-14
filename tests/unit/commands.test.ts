import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { generateEvent } from '../../src/commands/generate-event';
import { generateController } from '../../src/commands/generate-controller';
import { generateDto } from '../../src/commands/generate-dto';
import { generateDomainService } from '../../src/commands/generate-domain-service';
import { generateModule } from '../../src/commands/generate-module';
import { createMigration, resolveMigrationOutputPath } from '../../src/commands/migration';
import { generateQuery } from '../../src/commands/generate-query';
import { generateService } from '../../src/commands/generate-service';
import { generateUseCase } from '../../src/commands/generate-usecase';
import { getDryRunFiles, resetDryRunFiles } from '../../src/utils/file.utils';

describe('Command Generators', () => {
  const testDir = path.join(__dirname, '../.test-output');
  beforeEach(async () => {
    resetDryRunFiles();
    await fs.ensureDir(testDir);
    await fs.emptyDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('Service Generator', () => {
    it('should generate a domain service file', async () => {
      await generateModule('test-module', { path: testDir });
      await generateService('TestService', { module: 'test-module', path: testDir });

      const servicePath = path.join(
        testDir,
        'src/modules/test-module/application/domain/services/test-service.service.ts',
      );
      const serviceExists = await fs.pathExists(servicePath);

      expect(serviceExists).toBe(true);

      const content = await fs.readFile(servicePath, 'utf-8');
      expect(content).toContain('TestServiceService');
      expect(content).toContain('@Injectable()');

      const serviceIndex = await fs.readFile(
        path.join(testDir, 'src/modules/test-module/application/domain/services/index.ts'),
        'utf-8',
      );
      expect(serviceIndex).toContain(
        "import { TestServiceService } from './test-service.service';",
      );
      expect(serviceIndex).toContain('export const Services = [\n  TestServiceService,\n];');
    });

    it('keeps advanced domain services in the same configured DDD layer', async () => {
      await generateModule('certifications', { path: testDir });
      await generateDomainService('RetryPolicy', testDir, { module: 'certifications' });

      expect(
        await fs.pathExists(
          path.join(
            testDir,
            'src/modules/certifications/application/domain/services/retry-policy.service.ts',
          ),
        ),
      ).toBe(true);
    });
  });

  describe('Controller Generator', () => {
    it('generates a registered application controller shell', async () => {
      await generateModule('fne-certifications', { path: testDir });
      await generateController('FneCertification', {
        module: 'fne-certifications',
        path: testDir,
      });

      const controllerPath = path.join(
        testDir,
        'src/modules/fne-certifications/application/controllers/fne-certification.controller.ts',
      );
      const controllerIndex = await fs.readFile(
        path.join(testDir, 'src/modules/fne-certifications/application/controllers/index.ts'),
        'utf-8',
      );

      expect(await fs.pathExists(controllerPath)).toBe(true);
      expect(await fs.readFile(controllerPath, 'utf-8')).toContain(
        '@Controller("fne-certifications")',
      );
      expect(controllerIndex).toContain('FneCertificationController');
    });
  });

  describe('Use Case Generator', () => {
    it('generates a dependency-free application use-case shell in the configured DDD layer', async () => {
      await generateModule('fne-connections', { path: testDir });
      await generateUseCase('ConfigureFneConnection', {
        module: 'fne-connections',
        path: testDir,
      });

      const useCasePath = path.join(
        testDir,
        'src/modules/fne-connections/application/domain/usecases/configure-fne-connection.use-case.ts',
      );
      const content = await fs.readFile(useCasePath, 'utf-8');

      expect(content).toContain('ConfigureFneConnectionUseCase');
      expect(content).not.toContain('Repository');
      expect(content).not.toContain('Mapper');
      expect(
        await fs.pathExists(path.join(testDir, 'src/modules/fne-connections/application/usecases')),
      ).toBe(false);
    });
  });

  describe('Event Generator', () => {
    it('should generate a domain event file', async () => {
      await generateModule('test-module', { path: testDir });
      await generateEvent('TestEvent', { module: 'test-module', path: testDir });

      const eventPath = path.join(
        testDir,
        'src/modules/test-module/application/domain/events/test-event.event.ts',
      );
      const eventExists = await fs.pathExists(eventPath);

      expect(eventExists).toBe(true);

      const content = await fs.readFile(eventPath, 'utf-8');
      expect(content).toContain('TestEventEvent');
      expect(content).toContain('IEvent');
    });
  });

  describe('DTO Generator', () => {
    it('generates a create request DTO and registers it in the requests barrel', async () => {
      await generateModule('inventory', { path: testDir });
      await generateDto('Product', { module: 'inventory', path: testDir, kind: 'create' });

      const dtoPath = path.join(
        testDir,
        'src/modules/inventory/application/dto/requests/create-product.dto.ts',
      );
      const requestsIndex = await fs.readFile(
        path.join(testDir, 'src/modules/inventory/application/dto/requests/index.ts'),
        'utf-8',
      );

      expect(await fs.pathExists(dtoPath)).toBe(true);
      expect(await fs.readFile(dtoPath, 'utf-8')).toContain('CreateProductDto');
      expect(requestsIndex).toContain("export * from './create-product.dto';");
    });

    it('generates a response DTO and registers it in the responses barrel', async () => {
      await generateModule('inventory', { path: testDir });
      await generateDto('Product', { module: 'inventory', path: testDir, kind: 'response' });

      const dtoPath = path.join(
        testDir,
        'src/modules/inventory/application/dto/responses/product.response.dto.ts',
      );
      const responsesIndex = await fs.readFile(
        path.join(testDir, 'src/modules/inventory/application/dto/responses/index.ts'),
        'utf-8',
      );

      expect(await fs.pathExists(dtoPath)).toBe(true);
      expect(await fs.readFile(dtoPath, 'utf-8')).toContain('ProductResponseDto');
      expect(responsesIndex).toContain("export * from './product.response.dto';");
    });

    it('keeps generated filter imports aligned with the pagination DTO filename', async () => {
      await generateModule('inventory', { path: testDir });
      await generateDto('Product', {
        module: 'inventory',
        path: testDir,
        kind: 'pagination',
      });
      await generateDto('Product', {
        module: 'inventory',
        path: testDir,
        kind: 'filter',
      });

      const filterPath = path.join(
        testDir,
        'src/modules/inventory/application/dto/requests/product-filter.dto.ts',
      );
      expect(await fs.readFile(filterPath, 'utf-8')).toContain('from "./pagination-query.dto"');
    });

    it('normalizes conventional filter-query names without duplicating the query suffix', async () => {
      await generateModule('inventory', { path: testDir });
      await generateDto('ProductFilterQuery', {
        module: 'inventory',
        path: testDir,
        kind: 'filter-query',
      });

      const queryPath = path.join(
        testDir,
        'src/modules/inventory/application/dto/requests/product-query.dto.ts',
      );
      const content = await fs.readFile(queryPath, 'utf-8');

      expect(await fs.pathExists(queryPath)).toBe(true);
      expect(content).toContain('export class ProductQueryDto extends ProductFilterDto');
      expect(content).not.toContain('QueryQuery');
    });

    it('previews DTO generation without writing files on dry-run', async () => {
      await generateModule('inventory', { path: testDir, dryRun: true });
      await generateDto('Product', {
        module: 'inventory',
        path: testDir,
        kind: 'update',
        dryRun: true,
      });

      expect(
        await fs.pathExists(
          path.join(
            testDir,
            'src/modules/inventory/application/dto/requests/update-product.dto.ts',
          ),
        ),
      ).toBe(false);

      const plannedFiles = getDryRunFiles().map((change) =>
        path.relative(testDir, change.filePath),
      );
      expect(plannedFiles).toContain(
        'src/modules/inventory/application/dto/requests/update-product.dto.ts',
      );
    });

    it('rejects unknown DTO kinds with allowed kind guidance', async () => {
      await generateModule('inventory', { path: testDir });

      await expect(
        generateDto('Product', { module: 'inventory', path: testDir, kind: 'invalid-kind' }),
      ).rejects.toThrow(/Unknown DTO kind/i);
      await expect(
        generateDto('Product', { module: 'inventory', path: testDir, kind: 'invalid-kind' }),
      ).rejects.toThrow(
        /create, update, response, filter, filter-query, pagination, paginated-response/,
      );
    });
  });

  describe('Query Generator', () => {
    it('should generate a query handler file', async () => {
      await generateModule('test-module', { path: testDir });
      await generateQuery('TestQuery', { module: 'test-module', path: testDir });

      const queryPath = path.join(
        testDir,
        'src/modules/test-module/application/queries/test.handler.ts',
      );
      const queryExists = await fs.pathExists(queryPath);

      expect(queryExists).toBe(true);

      const content = await fs.readFile(queryPath, 'utf-8');
      expect(content).toContain('TestQuery');
      expect(content).not.toContain('TestQueryQuery');
      expect(content).toContain('TestHandler');
      expect(content).toContain('IQueryHandler');

      const queryIndex = await fs.readFile(
        path.join(testDir, 'src/modules/test-module/application/queries/index.ts'),
        'utf-8',
      );
      expect(queryIndex).toContain("import { TestHandler } from './test.handler';");
      expect(queryIndex).toContain('export const Queries = [\n  TestHandler,\n];');
    });
  });

  describe('Dry-run generation', () => {
    it('reports focused generators without writing module files', async () => {
      const options = { module: 'certifications', path: testDir, dryRun: true };

      await generateModule('certifications', { path: testDir, dryRun: true });
      await generateController('Certification', options);
      await generateService('CertificationGateway', options);
      await generateUseCase('RequestCertification', options);
      await generateEvent('CertificationRequested', options);
      await generateQuery('GetCertification', options);

      expect(await fs.pathExists(path.join(testDir, 'src'))).toBe(false);
      const plannedFiles = getDryRunFiles().map((change) =>
        path.relative(testDir, change.filePath),
      );
      expect(plannedFiles).toContain(
        'src/modules/certifications/application/controllers/certification.controller.ts',
      );
      expect(plannedFiles).toContain(
        'src/modules/certifications/application/domain/services/certification-gateway.service.ts',
      );
      expect(plannedFiles).toContain(
        'src/modules/certifications/application/domain/usecases/request-certification.use-case.ts',
      );
      expect(plannedFiles).toContain(
        'src/modules/certifications/application/domain/events/certification-requested.event.ts',
      );
      expect(plannedFiles).toContain(
        'src/modules/certifications/application/queries/get-certification.handler.ts',
      );
    });

    it('previews a migration in a custom directory without writing it', async () => {
      const migrationsPath = path.join(testDir, 'src/migrations');

      await createMigration(testDir, {
        name: 'AccountingBaseline',
        path: migrationsPath,
        dryRun: true,
      });

      expect(await fs.pathExists(migrationsPath)).toBe(false);
      expect(
        getDryRunFiles().some(
          (change) =>
            path.dirname(change.filePath) === migrationsPath &&
            path.basename(change.filePath).endsWith('-AccountingBaseline.ts'),
        ),
      ).toBe(true);
    });

    it('allows a shared migration directory inside a monorepo workspace', async () => {
      const workspacePath = path.join(testDir, 'workspace');
      const appPath = path.join(workspacePath, 'apps/accounting-api');
      const migrationsPath = path.join(workspacePath, 'packages/infra/src/migrations');
      await fs.ensureDir(path.join(workspacePath, '.git'));
      await fs.ensureDir(appPath);

      await createMigration(appPath, {
        name: 'CustomerSettlementFields',
        path: '../../packages/infra/src/migrations',
        dryRun: true,
      });

      expect(
        getDryRunFiles().some(
          (change) =>
            path.dirname(change.filePath) === migrationsPath &&
            path.basename(change.filePath).endsWith('-CustomerSettlementFields.ts'),
        ),
      ).toBe(true);
    });

    it('rejects a migration directory outside the workspace', async () => {
      const workspacePath = path.join(testDir, 'workspace');
      const appPath = path.join(workspacePath, 'apps/accounting-api');
      await fs.ensureDir(path.join(workspacePath, '.git'));
      await fs.ensureDir(appPath);

      expect(() =>
        resolveMigrationOutputPath(appPath, '../../../outside', 'src/database/migrations'),
      ).toThrow('Migration path escapes the project workspace');
    });
  });
});
