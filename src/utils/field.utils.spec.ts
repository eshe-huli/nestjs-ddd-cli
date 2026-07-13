import { parseFields } from './field.utils';

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
});
