import { describe, it, expect } from '@jest/globals';
import {
  ValidationSchemas,
  validateInput,
  ValidationError,
  validateNamingConvention,
  validateDependencies,
} from '@/core/validation/validators';

describe('Validators', () => {
  describe('ValidationSchemas.name', () => {
    it('should validate valid entity names', () => {
      const validNames = ['User', 'UserProfile', 'Product123', 'OrderItem'];
      
      validNames.forEach(name => {
        const result = ValidationSchemas.name.validate(name);
        expect(result.error).toBeUndefined();
        expect(result.value).toBe(name);
      });
    });

    it('should reject invalid entity names', () => {
      const invalidNames = ['user', '1User', 'User-Profile', 'User_Profile', '', 'U'];
      
      invalidNames.forEach(name => {
        const result = ValidationSchemas.name.validate(name);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject names that are too long', () => {
      const longName = 'A'.repeat(51);
      const result = ValidationSchemas.name.validate(longName);
      expect(result.error).toBeDefined();
    });
  });

  describe('ValidationSchemas.moduleName', () => {
    it('should validate valid module names', () => {
      const validNames = ['user', 'user-management', 'product123', 'order-items'];
      
      validNames.forEach(name => {
        const result = ValidationSchemas.moduleName.validate(name);
        expect(result.error).toBeUndefined();
        expect(result.value).toBe(name);
      });
    });

    it('should reject invalid module names', () => {
      const invalidNames = ['1user', '-user', 'user_management', '', 'u'];
      
      invalidNames.forEach(name => {
        const result = ValidationSchemas.moduleName.validate(name);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('ValidationSchemas.path', () => {
    it('should validate valid paths', () => {
      const validPaths = ['/usr/src/app', './src/modules', '../parent', 'relative/path'];
      
      validPaths.forEach(path => {
        const result = ValidationSchemas.path.validate(path);
        expect(result.error).toBeUndefined();
        expect(result.value).toBe(path);
      });
    });

    it('should reject paths with invalid characters', () => {
      const invalidPaths = ['path<with>invalid', 'path:with:colons', 'path|with|pipes'];
      
      invalidPaths.forEach(path => {
        const result = ValidationSchemas.path.validate(path);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('ValidationSchemas.commandOptions', () => {
    it('should validate valid command options', () => {
      const options = {
        module: 'user-management',
        path: '/src/modules',
        skipOrm: true,
        skipMapper: false,
        withEvents: true,
        dryRun: false,
        force: true,
        template: 'custom',
        interactive: false,
      };
      
      const result = ValidationSchemas.commandOptions.validate(options);
      expect(result.error).toBeUndefined();
      expect(result.value).toEqual(options);
    });

    it('should allow partial options', () => {
      const options = {
        module: 'user',
        skipOrm: true,
      };
      
      const result = ValidationSchemas.commandOptions.validate(options);
      expect(result.error).toBeUndefined();
      expect(result.value).toEqual(options);
    });

    it('should allow empty options', () => {
      const result = ValidationSchemas.commandOptions.validate({});
      expect(result.error).toBeUndefined();
      expect(result.value).toEqual({});
    });
  });

  describe('validateInput', () => {
    it('should return validated value when valid', () => {
      const value = 'UserProfile';
      const result = validateInput<string>(value, ValidationSchemas.name, 'entityName');
      
      expect(result).toBe('UserProfile');
    });

    it('should throw ValidationError when invalid', () => {
      const value = 'invalid-name';
      
      expect(() => {
        validateInput<string>(value, ValidationSchemas.name, 'entityName');
      }).toThrow(ValidationError);
    });

    it('should include field name and value in error', () => {
      const value = '123invalid';
      
      try {
        validateInput<string>(value, ValidationSchemas.name, 'entityName');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.field).toBe('entityName');
        expect(validationError.value).toBe('123invalid');
      }
    });
  });

  describe('validateNamingConvention', () => {
    describe('entity validation', () => {
      it('should accept valid entity names', () => {
        expect(() => validateNamingConvention('User', 'entity')).not.toThrow();
        expect(() => validateNamingConvention('UserProfile', 'entity')).not.toThrow();
        expect(() => validateNamingConvention('OrderItem123', 'entity')).not.toThrow();
      });

      it('should reject invalid entity names', () => {
        expect(() => validateNamingConvention('user', 'entity')).toThrow(ValidationError);
        expect(() => validateNamingConvention('user-profile', 'entity')).toThrow(ValidationError);
        expect(() => validateNamingConvention('user_profile', 'entity')).toThrow(ValidationError);
      });
    });

    describe('module validation', () => {
      it('should accept valid module names', () => {
        expect(() => validateNamingConvention('user', 'module')).not.toThrow();
        expect(() => validateNamingConvention('user-management', 'module')).not.toThrow();
        expect(() => validateNamingConvention('product123', 'module')).not.toThrow();
      });

      it('should reject invalid module names', () => {
        expect(() => validateNamingConvention('User', 'module')).toThrow(ValidationError);
        expect(() => validateNamingConvention('user_management', 'module')).toThrow(ValidationError);
        expect(() => validateNamingConvention('1user', 'module')).toThrow(ValidationError);
      });
    });

    describe('usecase validation', () => {
      it('should accept valid use case names', () => {
        expect(() => validateNamingConvention('CreateUser', 'usecase')).not.toThrow();
        expect(() => validateNamingConvention('UpdateProduct', 'usecase')).not.toThrow();
        expect(() => validateNamingConvention('DeleteOrder123', 'usecase')).not.toThrow();
      });

      it('should reject invalid use case names', () => {
        expect(() => validateNamingConvention('createUser', 'usecase')).toThrow(ValidationError);
        expect(() => validateNamingConvention('create-user', 'usecase')).toThrow(ValidationError);
        expect(() => validateNamingConvention('create_user', 'usecase')).toThrow(ValidationError);
      });
    });
  });

  describe('validateDependencies', () => {
    it('should pass when all dependencies are available', async () => {
      // Testing with built-in modules that should always be available
      await expect(validateDependencies(['fs', 'path', 'os'])).resolves.not.toThrow();
    });

    it('should throw when dependencies are missing', async () => {
      await expect(validateDependencies(['non-existent-module-xyz']))
        .rejects.toThrow(ValidationError);
    });

    it('should list all missing dependencies in error', async () => {
      try {
        await validateDependencies(['missing-dep-1', 'missing-dep-2']);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.message).toContain('missing-dep-1');
        expect(validationError.message).toContain('missing-dep-2');
        expect(validationError.field).toBe('dependencies');
      }
    });
  });
});