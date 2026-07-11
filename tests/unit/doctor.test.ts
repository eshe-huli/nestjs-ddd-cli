import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { checkDependency } from '../../src/commands/doctor';

describe('Doctor dependency checks', () => {
  it('reads package.json relative to a relative project path', async () => {
    const projectPath = path.join('tests', '.doctor-project');
    await fs.ensureDir(projectPath);
    await fs.writeJson(path.join(projectPath, 'package.json'), {
      dependencies: { '@nestjs/core': '^11.0.0' },
    });

    try {
      await expect(checkDependency(projectPath, '@nestjs/core', 'NestJS Core')).resolves.toEqual({
        name: 'NestJS Core',
        status: 'pass',
        message: 'Installed (^11.0.0)',
      });
    } finally {
      await fs.remove(projectPath);
    }
  });
});
