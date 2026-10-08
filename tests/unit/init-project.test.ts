import { describe, expect, it } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs-extra';
import { execFileSync } from 'node:child_process';
import { resolveProjectDirectory } from '../../src/commands/init-project';

describe('Project initialization paths', () => {
  it('treats --path as a parent and matches the Nest-normalized project directory', () => {
    expect(resolveProjectDirectory('JoonaPayFneService', '/tmp/ddd-projects')).toBe(
      path.resolve('/tmp/ddd-projects/joona-pay-fne-service'),
    );
  });

  it('rejects an unsupported package manager before initializing a project', async () => {
    const target = await fs.mkdtemp(path.join(__dirname, '.init-invalid-'));
    try {
      expect(() =>
        execFileSync(
          'bun',
          [
            path.resolve(__dirname, '../../dist/index.js'),
            'init',
            'sample',
            '--path',
            target,
            '--package-manager',
            'unsupported',
            '--skip-update',
            '--skip-install',
          ],
          { stdio: 'pipe' },
        ),
      ).toThrow();
      expect(await fs.readdir(target)).toEqual([]);
    } finally {
      await fs.remove(target);
    }
  });

  const smoke = process.env['DDD_BUN_INIT_SMOKE'] === '1' ? describe : describe.skip;
  smoke('real Bun initialization', () => {
    it('initializes real Nest+DDD output under Bun with no dependency/global install', async () => {
      const target = await fs.mkdtemp(path.join(__dirname, '.init-bun-'));
      try {
        execFileSync(
          'bun',
          [
            path.resolve(__dirname, '../../dist/index.js'),
            'init',
            'InitBunSmoke',
            '--path',
            target,
            '--package-manager',
            'bun',
            '--skip-update',
            '--skip-install',
          ],
          { stdio: 'pipe', timeout: 30000 },
        );
        const project = path.join(target, 'init-bun-smoke');
        expect(await fs.pathExists(path.join(project, '.dddrc.json'))).toBe(true);
        expect(await fs.pathExists(path.join(project, 'src/main.ts'))).toBe(true);
        expect(await fs.pathExists(path.join(project, 'node_modules'))).toBe(false);
        expect(await fs.pathExists(path.join(project, 'package-lock.json'))).toBe(false);
        expect(await fs.pathExists(path.join(project, '.git'))).toBe(false);
        const config = await fs.readJson(path.join(project, 'tsconfig.json'));
        expect(config.compilerOptions.paths['@modules/*']).toEqual(['./src/modules/*']);
      } finally {
        await fs.remove(target);
      }
    }, 40000);
  });
});
