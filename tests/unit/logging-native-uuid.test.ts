import { afterEach, expect, it } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'node:path';
import * as os from 'node:os';
import { applyRecipe } from '../../src/commands/recipe';

let output: string | undefined;
afterEach(async () => {
  if (output) await fs.remove(output);
});

it('generates request IDs without an undeclared uuid dependency', async () => {
  output = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-logging-uuid-'));
  await applyRecipe('health', { path: output, installDeps: false });
  const generated = await fs.readFile(
    path.join(output, 'src/shared/logging/request-context.ts'), 'utf8',
  );
  expect(generated).toContain('import { randomUUID } from "node:crypto"');
  expect(generated).toContain('|| randomUUID()');
  expect(generated).not.toContain('from "uuid"');
});
