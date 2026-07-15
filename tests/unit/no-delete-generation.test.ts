import { afterEach, describe, expect, it } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { generateAll } from '../../src/commands/generate-all';
import { resetConfigCache } from '../../src/utils/config.utils';

describe('No-delete aggregate generation', () => {
  const testDir = path.join(__dirname, '../.test-no-delete-output');

  afterEach(async () => {
    resetConfigCache();
    await fs.remove(testDir);
  });

  it.each([
    ['CLI option', false],
    ['configuration', undefined],
  ] as const)('omits the full deletion surface through %s', async (_source, deleteOption) => {
    await fs.ensureDir(testDir);
    if (deleteOption === undefined) {
      await fs.writeJson(path.join(testDir, '.dddrc.json'), {
        features: { delete: false, hardDelete: true },
      });
      resetConfigCache();
    }

    await generateAll('LedgerAccount', {
      module: 'ledger',
      path: testDir,
      fields: 'code:string balance:money',
      delete: deleteOption,
      withTests: true,
    });

    const modulePath = path.join(testDir, 'src/modules/ledger');
    const [controller, repository, commandIndex, useCaseIndex, controllerTest, useCaseTest] =
      await Promise.all([
        fs.readFile(
          path.join(modulePath, 'application/controllers/ledger-account.controller.ts'),
          'utf-8',
        ),
        fs.readFile(
          path.join(modulePath, 'infrastructure/repositories/ledger-account.repository.ts'),
          'utf-8',
        ),
        fs.readFile(path.join(modulePath, 'application/commands/index.ts'), 'utf-8'),
        fs.readFile(path.join(modulePath, 'application/domain/usecases/index.ts'), 'utf-8'),
        fs.readFile(
          path.join(modulePath, 'application/controllers/ledger-account.controller.spec.ts'),
          'utf-8',
        ),
        fs.readFile(
          path.join(modulePath, 'application/domain/usecases/ledger-account.use-case.spec.ts'),
          'utf-8',
        ),
      ]);

    expect(
      await fs.pathExists(
        path.join(modulePath, 'application/commands/delete-ledger-account.command.ts'),
      ),
    ).toBe(false);
    expect(
      await fs.pathExists(
        path.join(modulePath, 'application/domain/usecases/delete-ledger-account.use-case.ts'),
      ),
    ).toBe(false);
    expect(controller).not.toMatch(/@Delete|DeleteLedgerAccountCommand/);
    expect(repository).not.toMatch(/async (?:hardDelete|delete)\(/);
    expect(commandIndex).not.toContain('DeleteLedgerAccount');
    expect(useCaseIndex).not.toContain('DeleteLedgerAccount');
    expect(controllerTest).not.toContain('DeleteLedgerAccountCommand');
    expect(useCaseTest).not.toContain('DeleteLedgerAccountUseCase');
  });
});
