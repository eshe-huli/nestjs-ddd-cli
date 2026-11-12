import { spawnSync } from 'node:child_process';
import path from 'node:path';

describe('actual semantic-release analyzer policy', () => {
  it('honors breaking runtime changes while preserving ordinary release semantics', () => {
    const result = spawnSync(
      'bun',
      [path.join(process.cwd(), 'tests/fixtures/release-policy.mjs')],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 10000,
      },
    );
    expect({ exit: result.status, error: result.error?.message, stderr: result.stderr }).toEqual({
      exit: 0,
      error: undefined,
      stderr: '',
    });
    const proof = JSON.parse(result.stdout.trim()) as {
      cases: number;
      preset: string;
      parentActualMerge: string;
      currentActualMerge: string;
      prospectiveNextVersion: string;
      generatedNotesDeclareRuntimeMigration: boolean;
    };
    expect(proof.cases).toBe(39);
    expect(proof.preset).toBe('9.1.0');
    expect(proof.parentActualMerge).toBe('minor');
    expect(proof.currentActualMerge).toBe('major');
    expect(proof.prospectiveNextVersion).toBe('4.0.0');
    expect(proof.generatedNotesDeclareRuntimeMigration).toBe(true);
  });
});
