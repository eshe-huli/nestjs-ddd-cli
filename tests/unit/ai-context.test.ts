import { describe, expect, it } from '@jest/globals';
import * as path from 'path';
import { compileTemplate, prepareTemplateData, readTemplate } from '../../src/utils/file.utils';

describe('Generated AI context', () => {
  it('documents the same camelCase DTO and application-domain paths that generators emit', async () => {
    const template = await readTemplate(
      path.join(__dirname, '../../src/templates/ai-context/conventions.md.hbs'),
    );
    const output = compileTemplate(template, prepareTemplateData('Invoice', 'invoices'));

    expect(output).toContain('Request DTOs use camelCase properties');
    expect(output).toContain('@modules/users/application/domain/entities/user.entity');
    expect(output).not.toContain('first_name');
    expect(output).not.toContain('@modules/users/domain/entities/user.entity');
  });
});
