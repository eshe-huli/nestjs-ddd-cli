import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  fileExists,
  writeFile,
  getModulePath,
  prepareTemplateData,
  generateFromTemplate,
} from '@/utils/file.utils';

jest.mock('fs-extra');

describe('File Utils', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      
      const result = await fileExists('/path/to/file.ts');
      
      expect(result).toBe(true);
      expect(mockFs.pathExists).toHaveBeenCalledWith('/path/to/file.ts');
    });

    it('should return false when file does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      const result = await fileExists('/path/to/nonexistent.ts');
      
      expect(result).toBe(false);
      expect(mockFs.pathExists).toHaveBeenCalledWith('/path/to/nonexistent.ts');
    });

    it('should handle errors gracefully', async () => {
      mockFs.pathExists.mockRejectedValue(new Error('Permission denied'));
      
      const result = await fileExists('/path/to/file.ts');
      
      expect(result).toBe(false);
    });
  });

  describe('writeFile', () => {
    it('should create directory and write file', async () => {
      mockFs.ensureDir.mockResolvedValue(undefined as any);
      mockFs.writeFile.mockResolvedValue(undefined);
      
      await writeFile('/path/to/file.ts', 'content');
      
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/path/to');
      expect(mockFs.writeFile).toHaveBeenCalledWith('/path/to/file.ts', 'content');
    });

    it('should handle write errors', async () => {
      mockFs.ensureDir.mockResolvedValue(undefined as any);
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));
      
      await expect(writeFile('/path/to/file.ts', 'content'))
        .rejects.toThrow('Write failed');
    });
  });

  describe('getModulePath', () => {
    it('should return correct module path', () => {
      const result = getModulePath('/base/path', 'user-management');
      
      expect(result).toBe('/base/path/modules/user-management');
    });

    it('should handle module names with different cases', () => {
      const result = getModulePath('/base/path', 'UserManagement');
      
      expect(result).toBe('/base/path/modules/user-management');
    });

    it('should handle absolute base paths', () => {
      const result = getModulePath('/usr/src/app', 'products');
      
      expect(result).toBe('/usr/src/app/modules/products');
    });

    it('should handle relative base paths', () => {
      const result = getModulePath('./src', 'orders');
      
      expect(result).toBe('./src/modules/orders');
    });
  });

  describe('prepareTemplateData', () => {
    it('should prepare template data with all naming conventions', () => {
      const result = prepareTemplateData('UserProfile', 'user-management');
      
      expect(result).toEqual({
        entityName: 'UserProfile',
        entityNameLower: 'userProfile',
        entityNameKebab: 'user-profile',
        entityNameSnake: 'user_profile',
        entityNamePlural: 'UserProfiles',
        entityNamePluralLower: 'userProfiles',
        moduleName: 'user-management',
        moduleNamePascal: 'UserManagement',
        moduleNameCamel: 'userManagement',
      });
    });

    it('should handle single word entities', () => {
      const result = prepareTemplateData('User', 'auth');
      
      expect(result).toEqual({
        entityName: 'User',
        entityNameLower: 'user',
        entityNameKebab: 'user',
        entityNameSnake: 'user',
        entityNamePlural: 'Users',
        entityNamePluralLower: 'users',
        moduleName: 'auth',
        moduleNamePascal: 'Auth',
        moduleNameCamel: 'auth',
      });
    });

    it('should handle irregular plurals', () => {
      const result = prepareTemplateData('Category', 'catalog');
      
      expect(result.entityNamePlural).toBe('Categories');
      expect(result.entityNamePluralLower).toBe('categories');
    });
  });

  describe('generateFromTemplate', () => {
    it('should read template, compile, and write output', async () => {
      const mockTemplate = '{{entityName}} in {{moduleName}}';
      const mockCompiled = jest.fn().mockReturnValue('User in auth');
      
      mockFs.readFile.mockResolvedValue(mockTemplate);
      mockFs.ensureDir.mockResolvedValue(undefined as any);
      mockFs.writeFile.mockResolvedValue(undefined);
      
      // Mock Handlebars
      jest.mock('handlebars', () => ({
        compile: jest.fn(() => mockCompiled),
      }));
      
      const data = { entityName: 'User', moduleName: 'auth' };
      await generateFromTemplate('/templates/entity.hbs', '/output/user.ts', data);
      
      expect(mockFs.readFile).toHaveBeenCalledWith('/templates/entity.hbs', 'utf-8');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/output');
      expect(mockFs.writeFile).toHaveBeenCalledWith('/output/user.ts', expect.any(String));
    });

    it('should handle template compilation errors', async () => {
      mockFs.readFile.mockResolvedValue('{{invalid}}');
      mockFs.ensureDir.mockResolvedValue(undefined as any);
      
      const data = { entityName: 'User' };
      
      // This will fail due to missing template variable
      await expect(generateFromTemplate('/templates/bad.hbs', '/output/bad.ts', data))
        .rejects.toThrow();
    });

    it('should handle file read errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Template not found'));
      
      await expect(generateFromTemplate('/templates/missing.hbs', '/output/file.ts', {}))
        .rejects.toThrow('Template not found');
    });
  });
});