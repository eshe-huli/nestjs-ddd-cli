import { afterEach, describe, expect, it } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { generateAll } from '../../src/commands/generate-all';
import { resetConfigCache } from '../../src/utils/config.utils';

type Orm = 'typeorm' | 'prisma';

describe('Hard-delete repository generation', () => {
  const testDir = path.join(__dirname, '../.test-hard-delete-output');
  const orms: readonly Orm[] = ['typeorm', 'prisma'];

  afterEach(async () => {
    resetConfigCache();
    await fs.remove(testDir);
  });

  it('omits hardDelete for legacy and default configurations', async () => {
    for (const orm of orms) {
      const repository = await generateRepository(`${orm}-default`, orm, {});
      expect(repository).not.toContain('async hardDelete(');
    }
  });

  it('generates hardDelete only after an explicit opt-in', async () => {
    for (const orm of orms) {
      const repository = await generateRepository(`${orm}-opt-in`, orm, {
        hardDelete: true,
      });
      expect(repository).toContain('async hardDelete(id: string): Promise<void>');
    }
  });

  it('does not duplicate physical deletion when softDelete is disabled', async () => {
    for (const orm of orms) {
      const repository = await generateRepository(`${orm}-ordinary-delete`, orm, {
        softDelete: false,
        hardDelete: true,
      });
      const deleteMethod = extractMethod(repository, 'delete');

      expect(deleteMethod).toContain('.delete(');
      expect(repository).not.toContain('async hardDelete(');
    }
  });

  async function generateRepository(
    fixtureName: string,
    orm: Orm,
    features: Record<string, boolean>,
  ): Promise<string> {
    const fixturePath = path.join(testDir, fixtureName);
    await fs.ensureDir(fixturePath);
    await fs.writeJson(path.join(fixturePath, '.dddrc.json'), {
      orm,
      features,
    });

    resetConfigCache();
    await generateAll('Invoice', {
      module: 'billing',
      path: fixturePath,
      fields: 'amount:decimal',
      orm,
    });

    return fs.readFile(
      path.join(
        fixturePath,
        'src/modules/billing/infrastructure/repositories/invoice.repository.ts',
      ),
      'utf-8',
    );
  }
});

function extractMethod(source: string, methodName: string): string {
  const start = source.indexOf(`  async ${methodName}(`);
  const nextMethod = source.indexOf('\n  async ', start + 1);
  return source.slice(start, nextMethod < 0 ? source.length : nextMethod);
}
