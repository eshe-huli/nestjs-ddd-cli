import { generateFieldsTemplateData, parseFields } from './field.utils';

describe('parseFields', () => {
  it('does not regenerate fields already owned by the base entity', () => {
    const result = parseFields(
      'name:string isActive:boolean created_at:datetime updatedAt:datetime',
    );

    expect(result.fields.map((field) => field.name)).toEqual(['name']);
  });

  it('keeps business fields while normalizing their generated names', () => {
    const result = parseFields('functionalCurrency:string effectiveFrom:date');

    expect(result.fields.map((field) => field.camelCase)).toEqual([
      'functionalCurrency',
      'effectiveFrom',
    ]);
  });

  it('models money exactly and marks server-owned fields as internal inputs', () => {
    const result = parseFields(
      'amount:money tenantId:uuid:serverOwned organizationId:uuid:internal',
    );

    expect(result.hasMoney).toBe(true);
    expect(result.hasServerOwned).toBe(true);
    expect(result.fields[0]).toMatchObject({
      name: 'amount',
      tsType: 'string',
      dbType: 'decimal',
      prismaType: 'Decimal',
      isMoney: true,
      isServerOwned: false,
    });
    expect(result.fields.slice(1).map((field) => field.isServerOwned)).toEqual([true, true]);
    expect(result.fields[0]?.validators).toContain(
      "@IsDecimal({ decimal_digits: '0,18', force_decimal: false })",
    );
  });

  it('does not emit whitespace-only lines for non-unique migration columns', () => {
    const { fields } = parseFields('name:string code:string:unique');
    const migrationColumns = generateFieldsTemplateData(fields).migrationColumns;

    expect(migrationColumns).not.toMatch(/^\s+$/m);
    expect(migrationColumns).toContain('isUnique: true');
  });
});
