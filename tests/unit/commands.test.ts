import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { generateEvent } from '../../src/commands/generate-event';
import { generateController } from '../../src/commands/generate-controller';
import { generateDomainService } from '../../src/commands/generate-domain-service';
import { generateModule } from '../../src/commands/generate-module';
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

  describe('Query Generator', () => {
    it('should generate a query handler file', async () => {
      await generateModule('test-module', { path: testDir });
      await generateQuery('TestQuery', { module: 'test-module', path: testDir });

      const queryPath = path.join(
        testDir,
        'src/modules/test-module/application/queries/test-query.handler.ts',
      );
      const queryExists = await fs.pathExists(queryPath);

      expect(queryExists).toBe(true);

      const content = await fs.readFile(queryPath, 'utf-8');
      expect(content).toContain('TestQueryQuery');
      expect(content).toContain('TestQueryHandler');
      expect(content).toContain('IQueryHandler');
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
  });
});
