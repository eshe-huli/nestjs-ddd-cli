import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { checkDependency, resolveNestProjectPath } from '../../src/commands/doctor';

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

describe('Doctor monorepo target resolution', () => {
  it('discovers a single NestJS app under apps', async () => {
    const projectPath = path.join('tests', '.doctor-monorepo');
    const appPath = path.join(projectPath, 'apps', 'accounting-api');
    await fs.ensureDir(path.join(appPath, 'src'));
    await fs.writeFile(path.join(appPath, 'src', 'main.ts'), '');

    try {
      await expect(resolveNestProjectPath(projectPath)).resolves.toBe(path.resolve(appPath));
    } finally {
      await fs.remove(projectPath);
    }
  });

  it('honors an explicit app name when a monorepo has several apps', async () => {
    const projectPath = path.join('tests', '.doctor-many-apps');
    for (const app of ['accounting-api', 'identity-api']) {
      const appPath = path.join(projectPath, 'apps', app, 'src');
      await fs.ensureDir(appPath);
      await fs.writeFile(path.join(appPath, 'main.ts'), '');
    }

    try {
      await expect(resolveNestProjectPath(projectPath, 'accounting-api')).resolves.toBe(
        path.resolve(projectPath, 'apps', 'accounting-api'),
      );
    } finally {
      await fs.remove(projectPath);
    }
  });
});
