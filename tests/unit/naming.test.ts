import { describe, it, expect } from '@jest/globals';
import { toPascalCase, toCamelCase, toKebabCase, toSnakeCase } from '../../src/utils/naming.utils';

describe('Naming Utils', () => {
  describe('toPascalCase', () => {
    it('should preserve already PascalCase strings', () => {
      expect(toPascalCase('KycVerification')).toBe('KycVerification');
      expect(toPascalCase('SanctionsScreening')).toBe('SanctionsScreening');
      expect(toPascalCase('ComplianceEntity')).toBe('ComplianceEntity');
    });

    it('should convert kebab-case to PascalCase', () => {
      expect(toPascalCase('kyc-verification')).toBe('KycVerification');
      expect(toPascalCase('sanctions-screening')).toBe('SanctionsScreening');
      expect(toPascalCase('user-profile')).toBe('UserProfile');
    });

    it('should convert snake_case to PascalCase', () => {
      expect(toPascalCase('kyc_verification')).toBe('KycVerification');
      expect(toPascalCase('sanctions_screening')).toBe('SanctionsScreening');
      expect(toPascalCase('user_profile')).toBe('UserProfile');
    });

    it('should convert space-separated to PascalCase', () => {
      expect(toPascalCase('kyc verification')).toBe('KycVerification');
      expect(toPascalCase('sanctions screening')).toBe('SanctionsScreening');
      expect(toPascalCase('user profile')).toBe('UserProfile');
    });
  });

  describe('toCamelCase', () => {
    it('should convert PascalCase to camelCase', () => {
      expect(toCamelCase('KycVerification')).toBe('kycVerification');
      expect(toCamelCase('SanctionsScreening')).toBe('sanctionsScreening');
      expect(toCamelCase('ComplianceEntity')).toBe('complianceEntity');
    });

    it('should convert kebab-case to camelCase', () => {
      expect(toCamelCase('kyc-verification')).toBe('kycVerification');
      expect(toCamelCase('sanctions-screening')).toBe('sanctionsScreening');
      expect(toCamelCase('user-profile')).toBe('userProfile');
    });
  });

  describe('toKebabCase', () => {
    it('should convert PascalCase to kebab-case', () => {
      expect(toKebabCase('KycVerification')).toBe('kyc-verification');
      expect(toKebabCase('SanctionsScreening')).toBe('sanctions-screening');
      expect(toKebabCase('ComplianceEntity')).toBe('compliance-entity');
    });

    it('should convert camelCase to kebab-case', () => {
      expect(toKebabCase('kycVerification')).toBe('kyc-verification');
      expect(toKebabCase('sanctionsScreening')).toBe('sanctions-screening');
      expect(toKebabCase('complianceEntity')).toBe('compliance-entity');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert PascalCase to snake_case', () => {
      expect(toSnakeCase('KycVerification')).toBe('kyc_verification');
      expect(toSnakeCase('SanctionsScreening')).toBe('sanctions_screening');
      expect(toSnakeCase('ComplianceEntity')).toBe('compliance_entity');
    });

    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('kycVerification')).toBe('kyc_verification');
      expect(toSnakeCase('sanctionsScreening')).toBe('sanctions_screening');
      expect(toSnakeCase('complianceEntity')).toBe('compliance_entity');
    });
  });
});