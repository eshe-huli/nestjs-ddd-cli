import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { generateEvent } from '../../src/commands/generate-event';
import { generateDomainService } from '../../src/commands/generate-domain-service';
import { generateModule } from '../../src/commands/generate-module';
import { generateQuery } from '../../src/commands/generate-query';
import { generateService } from '../../src/commands/generate-service';
import { generateUseCase } from '../../src/commands/generate-usecase';

describe('Command Generators', () => {
  const testDir = path.join(__dirname, '../.test-output');
  beforeEach(async () => {
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
});
