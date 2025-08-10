import { describe, it, expect } from '@jest/globals';
import {
  toPascalCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
} from '@/utils/naming.utils';

describe('Naming Utils', () => {
  describe('toPascalCase', () => {
    it('should convert kebab-case to PascalCase', () => {
      expect(toPascalCase('user-management')).toBe('UserManagement');
      expect(toPascalCase('product-catalog')).toBe('ProductCatalog');
    });

    it('should convert snake_case to PascalCase', () => {
      expect(toPascalCase('user_management')).toBe('UserManagement');
      expect(toPascalCase('product_catalog')).toBe('ProductCatalog');
    });

    it('should convert camelCase to PascalCase', () => {
      expect(toPascalCase('userManagement')).toBe('UserManagement');
      expect(toPascalCase('productCatalog')).toBe('ProductCatalog');
    });

    it('should handle single words', () => {
      expect(toPascalCase('user')).toBe('User');
      expect(toPascalCase('product')).toBe('Product');
    });

    it('should handle already PascalCase', () => {
      expect(toPascalCase('UserManagement')).toBe('UserManagement');
    });

    it('should handle mixed separators', () => {
      expect(toPascalCase('user-management_system')).toBe('UserManagementSystem');
    });

    it('should handle empty string', () => {
      expect(toPascalCase('')).toBe('');
    });
  });

  describe('toCamelCase', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(toCamelCase('user-management')).toBe('userManagement');
      expect(toCamelCase('product-catalog')).toBe('productCatalog');
    });

    it('should convert snake_case to camelCase', () => {
      expect(toCamelCase('user_management')).toBe('userManagement');
      expect(toCamelCase('product_catalog')).toBe('productCatalog');
    });

    it('should convert PascalCase to camelCase', () => {
      expect(toCamelCase('UserManagement')).toBe('userManagement');
      expect(toCamelCase('ProductCatalog')).toBe('productCatalog');
    });

    it('should handle single words', () => {
      expect(toCamelCase('user')).toBe('user');
      expect(toCamelCase('product')).toBe('product');
    });

    it('should handle already camelCase', () => {
      expect(toCamelCase('userManagement')).toBe('userManagement');
    });

    it('should handle empty string', () => {
      expect(toCamelCase('')).toBe('');
    });
  });

  describe('toKebabCase', () => {
    it('should convert PascalCase to kebab-case', () => {
      expect(toKebabCase('UserManagement')).toBe('user-management');
      expect(toKebabCase('ProductCatalog')).toBe('product-catalog');
    });

    it('should convert camelCase to kebab-case', () => {
      expect(toKebabCase('userManagement')).toBe('user-management');
      expect(toKebabCase('productCatalog')).toBe('product-catalog');
    });

    it('should convert snake_case to kebab-case', () => {
      expect(toKebabCase('user_management')).toBe('user-management');
      expect(toKebabCase('product_catalog')).toBe('product-catalog');
    });

    it('should handle single words', () => {
      expect(toKebabCase('user')).toBe('user');
      expect(toKebabCase('product')).toBe('product');
    });

    it('should handle already kebab-case', () => {
      expect(toKebabCase('user-management')).toBe('user-management');
    });

    it('should handle consecutive capitals', () => {
      expect(toKebabCase('XMLHttpRequest')).toBe('xml-http-request');
      expect(toKebabCase('HTTPSConnection')).toBe('https-connection');
    });

    it('should handle empty string', () => {
      expect(toKebabCase('')).toBe('');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert PascalCase to snake_case', () => {
      expect(toSnakeCase('UserManagement')).toBe('user_management');
      expect(toSnakeCase('ProductCatalog')).toBe('product_catalog');
    });

    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('userManagement')).toBe('user_management');
      expect(toSnakeCase('productCatalog')).toBe('product_catalog');
    });

    it('should convert kebab-case to snake_case', () => {
      expect(toSnakeCase('user-management')).toBe('user_management');
      expect(toSnakeCase('product-catalog')).toBe('product_catalog');
    });

    it('should handle single words', () => {
      expect(toSnakeCase('user')).toBe('user');
      expect(toSnakeCase('product')).toBe('product');
    });

    it('should handle already snake_case', () => {
      expect(toSnakeCase('user_management')).toBe('user_management');
    });

    it('should handle empty string', () => {
      expect(toSnakeCase('')).toBe('');
    });
  });
});