import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('Command Generators', () => {
  const testDir = path.join(__dirname, '../.test-output');
  const cliPath = path.join(__dirname, '../../dist/index.js');
  
  beforeEach(async () => {
    await fs.ensureDir(testDir);
    await fs.emptyDir(testDir);
  });
  
  afterEach(async () => {
    await fs.remove(testDir);
  });
  
  describe('Service Generator', () => {
    it('should generate a domain service file', async () => {
      // Create module first
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync(`cd ${testDir} && node ${cliPath} generate module test-module`);
      await execAsync(`cd ${testDir} && node ${cliPath} generate service TestService -m test-module`);
      
      const servicePath = path.join(testDir, 'src/modules/test-module/application/domain/services/test-service.service.ts');
      const serviceExists = await fs.pathExists(servicePath);
      
      expect(serviceExists).toBe(true);
      
      const content = await fs.readFile(servicePath, 'utf-8');
      expect(content).toContain('TestServiceService');
      expect(content).toContain('@Injectable()');
    });
  });
  
  describe('Event Generator', () => {
    it('should generate a domain event file', async () => {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync(`cd ${testDir} && node ${cliPath} generate module test-module`);
      await execAsync(`cd ${testDir} && node ${cliPath} generate event TestEvent -m test-module`);
      
      const eventPath = path.join(testDir, 'src/modules/test-module/application/domain/events/test-event.event.ts');
      const eventExists = await fs.pathExists(eventPath);
      
      expect(eventExists).toBe(true);
      
      const content = await fs.readFile(eventPath, 'utf-8');
      expect(content).toContain('TestEventEvent');
      expect(content).toContain('IEvent');
    });
  });
  
  describe('Query Generator', () => {
    it('should generate a query handler file', async () => {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync(`cd ${testDir} && node ${cliPath} generate module test-module`);
      await execAsync(`cd ${testDir} && node ${cliPath} generate query TestQuery -m test-module`);
      
      const queryPath = path.join(testDir, 'src/modules/test-module/application/queries/test-query.handler.ts');
      const queryExists = await fs.pathExists(queryPath);
      
      expect(queryExists).toBe(true);
      
      const content = await fs.readFile(queryPath, 'utf-8');
      expect(content).toContain('TestQueryQuery');
      expect(content).toContain('TestQueryHandler');
      expect(content).toContain('IQueryHandler');
    });
  });
});