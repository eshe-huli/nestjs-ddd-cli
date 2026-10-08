import { describe, expect, it } from '@jest/globals';
import {
  compareVersions,
  getNestProjectExecution,
  isNewerVersion,
} from '../../src/utils/dependency.utils';

describe('Dependency Utils', () => {
  describe('semantic version comparison', () => {
    it('does not treat an older registry version as an update', () => {
      expect(isNewerVersion('3.2.1', '3.2.2')).toBe(false);
      expect(compareVersions('3.2.1', '3.2.2')).toBeLessThan(0);
    });

    it('compares numeric version parts instead of lexicographic strings', () => {
      expect(isNewerVersion('3.2.10', '3.2.2')).toBe(true);
      expect(compareVersions('3.2.10', '3.2.2')).toBeGreaterThan(0);
    });

    it('treats a stable release as newer than the matching prerelease', () => {
      expect(isNewerVersion('3.2.2', '3.2.2-beta.1')).toBe(true);
      expect(isNewerVersion('3.2.2-beta.1', '3.2.2')).toBe(false);
    });
  });

  it('runs Nest from the requested parent with a relative target directory', () => {
    const execution = getNestProjectExecution('JoonaPayCliSmoke', {
      directory: '/tmp/ddd-projects/joona-pay-cli-smoke',
      skipInstall: true,
    });

    expect(execution.cwd).toBe('/tmp/ddd-projects');
    expect(execution.args).toContain('joona-pay-cli-smoke');
    expect(execution.args).not.toContain('/tmp/ddd-projects/joona-pay-cli-smoke');
    expect(execution.args).toContain('--skip-install');
  });

  it('uses an explicit Bun package manager without changing the existing default', () => {
    expect(
      getNestProjectExecution('sample', { packageManager: 'bun', skipInstall: true }).args,
    ).toEqual(['new', 'sample', '--skip-git', '--package-manager', 'bun', '--skip-install']);
    expect(getNestProjectExecution('sample').args).toEqual([
      'new',
      'sample',
      '--skip-git',
      '--package-manager',
      'npm',
    ]);
  });

  it('forwards an explicit existing collection without changing the default selection', () => {
    expect(
      getNestProjectExecution('sample', { collection: '/tmp/approved/schematics' }).args,
    ).toContain('/tmp/approved/schematics');
    expect(getNestProjectExecution('sample').args).not.toContain('--collection');
  });
});
