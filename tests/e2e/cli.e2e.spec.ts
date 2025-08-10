import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';

const execAsync = promisify(exec);

describe('CLI E2E Tests', () => {
  const testDir = path.join(__dirname, '../.test-output');
  const cliPath = path.join(__dirname, '../../src/index.ts');
  
  beforeEach(async () => {
    await fs.ensureDir(testDir);
    await fs.emptyDir(testDir);
    process.chdir(testDir);
  });
  
  afterEach(async () => {
    process.chdir(__dirname);
    await fs.remove(testDir);
  });
  
  describe('ddd generate module', () => {
    it('should generate a module structure', async () => {
      const { stdout, stderr } = await execAsync(
        `npx ts-node ${cliPath} generate module user-management`
      );
      
      expect(stderr).toBe('');
      expect(stdout).toContain('Module generated successfully');
      
      // Check if module structure was created
      const modulePath = path.join(testDir, 'modules/user-management');
      expect(await fs.pathExists(modulePath)).toBe(true);
      expect(await fs.pathExists(path.join(modulePath, 'application'))).toBe(true);
      expect(await fs.pathExists(path.join(modulePath, 'infrastructure'))).toBe(true);
      expect(await fs.pathExists(path.join(modulePath, 'user-management.module.ts'))).toBe(true);
    });
    
    it('should reject invalid module names', async () => {
      try {
        await execAsync(`npx ts-node ${cliPath} generate module 123-invalid`);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.stderr).toContain('must start with a letter');
      }
    });
  });
  
  describe('ddd generate entity', () => {
    beforeEach(async () => {
      // Create a module first
      await execAsync(`npx ts-node ${cliPath} generate module test-module`);
    });
    
    it('should generate an entity within a module', async () => {
      const { stdout, stderr } = await execAsync(
        `npx ts-node ${cliPath} generate entity User -m test-module`
      );
      
      expect(stderr).toBe('');
      expect(stdout).toContain('Entity generated successfully');
      
      // Check if entity files were created
      const entityPath = path.join(testDir, 'modules/test-module/application/domain/entities/user.entity.ts');
      expect(await fs.pathExists(entityPath)).toBe(true);
    });
    
    it('should generate ORM entity by default', async () => {
      const { stdout } = await execAsync(
        `npx ts-node ${cliPath} generate entity Product -m test-module`
      );
      
      expect(stdout).toContain('Entity generated successfully');
      
      const ormEntityPath = path.join(testDir, 'modules/test-module/infrastructure/orm-entities/product.orm-entity.ts');
      expect(await fs.pathExists(ormEntityPath)).toBe(true);
    });
    
    it('should skip ORM entity when --skip-orm flag is used', async () => {
      const { stdout } = await execAsync(
        `npx ts-node ${cliPath} generate entity Order -m test-module --skip-orm`
      );
      
      expect(stdout).toContain('Entity generated successfully');
      
      const ormEntityPath = path.join(testDir, 'modules/test-module/infrastructure/orm-entities/order.orm-entity.ts');
      expect(await fs.pathExists(ormEntityPath)).toBe(false);
    });
  });
  
  describe('ddd generate usecase', () => {
    beforeEach(async () => {
      await execAsync(`npx ts-node ${cliPath} generate module test-module`);
    });
    
    it('should generate a use case', async () => {
      const { stdout, stderr } = await execAsync(
        `npx ts-node ${cliPath} generate usecase CreateUser -m test-module`
      );
      
      expect(stderr).toBe('');
      expect(stdout).toContain('Use case generated successfully');
      
      // Check if use case file was created
      const useCasePath = path.join(testDir, 'modules/test-module/application/domain/usecases/create-user.usecase.ts');
      expect(await fs.pathExists(useCasePath)).toBe(true);
    });
    
    it('should generate command handler with --with-events flag', async () => {
      const { stdout } = await execAsync(
        `npx ts-node ${cliPath} generate usecase UpdateProduct -m test-module --with-events`
      );
      
      expect(stdout).toContain('Use case generated successfully');
      
      const commandPath = path.join(testDir, 'modules/test-module/application/commands/update-product.command.ts');
      expect(await fs.pathExists(commandPath)).toBe(true);
    });
  });
  
  describe('ddd scaffold', () => {
    it('should generate complete scaffolding for an entity', async () => {
      const { stdout, stderr } = await execAsync(
        `npx ts-node ${cliPath} scaffold Product -m inventory`
      );
      
      expect(stderr).toBe('');
      expect(stdout).toContain('Complete scaffolding generated successfully');
      
      // Check if all expected files were created
      const modulePath = path.join(testDir, 'modules/inventory');
      
      const expectedFiles = [
        'inventory.module.ts',
        'application/domain/entities/product.entity.ts',
        'application/domain/usecases/create-product.usecase.ts',
        'application/domain/usecases/update-product.usecase.ts',
        'application/domain/usecases/delete-product.usecase.ts',
        'application/controllers/product.controller.ts',
        'application/dto/requests/create-product.dto.ts',
        'infrastructure/orm-entities/product.orm-entity.ts',
        'infrastructure/repositories/product.repository.ts',
        'infrastructure/mappers/product.mapper.ts',
      ];
      
      for (const file of expectedFiles) {
        const filePath = path.join(modulePath, file);
        expect(await fs.pathExists(filePath)).toBe(true);
      }
    });
  });
  
  describe('ddd generate all', () => {
    it('should generate all files for an entity in existing module', async () => {
      // Create module first
      await execAsync(`npx ts-node ${cliPath} generate module policies`);
      
      const { stdout, stderr } = await execAsync(
        `npx ts-node ${cliPath} generate all Coverage -m policies`
      );
      
      expect(stderr).toBe('');
      expect(stdout).toContain('Complete scaffolding generated successfully');
      
      // Check if entity and related files were created
      const modulePath = path.join(testDir, 'modules/policies');
      
      const expectedFiles = [
        'application/domain/entities/coverage.entity.ts',
        'application/controllers/coverage.controller.ts',
        'infrastructure/repositories/coverage.repository.ts',
      ];
      
      for (const file of expectedFiles) {
        const filePath = path.join(modulePath, file);
        expect(await fs.pathExists(filePath)).toBe(true);
      }
    });
  });
  
  describe('CLI help', () => {
    it('should display help information', async () => {
      const { stdout } = await execAsync(`npx ts-node ${cliPath} --help`);
      
      expect(stdout).toContain('CLI for generating NestJS DDD boilerplate code');
      expect(stdout).toContain('generate');
      expect(stdout).toContain('scaffold');
    });
    
    it('should display version information', async () => {
      const { stdout } = await execAsync(`npx ts-node ${cliPath} --version`);
      
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });
  
  describe('Dry run mode', () => {
    it('should not create files in dry-run mode', async () => {
      const { stdout } = await execAsync(
        `npx ts-node ${cliPath} generate module test-dry-run --dry-run`
      );
      
      expect(stdout).toContain('dry-run mode');
      
      const modulePath = path.join(testDir, 'modules/test-dry-run');
      expect(await fs.pathExists(modulePath)).toBe(false);
    });
  });
});