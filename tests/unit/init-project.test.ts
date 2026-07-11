import { describe, expect, it } from '@jest/globals';
import * as path from 'path';
import { resolveProjectDirectory } from '../../src/commands/init-project';

describe('Project initialization paths', () => {
  it('treats --path as a parent and matches the Nest-normalized project directory', () => {
    expect(resolveProjectDirectory('JoonaPayFneService', '/tmp/ddd-projects')).toBe(
      path.resolve('/tmp/ddd-projects/joona-pay-fne-service'),
    );
  });
});
