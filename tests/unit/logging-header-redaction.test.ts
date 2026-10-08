import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as ts from 'typescript';
import { applyRecipe } from '../../src/commands/recipe';

describe('emitted internal service credential redaction', () => {
  it('emits the internal API header redaction with existing bearer/cookie protection', async () => {
    const target = await mkdtemp(path.join(tmpdir(), 'ddd-logging-redaction-'));
    const output = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await expect(applyRecipe('health', { path: target, dryRun: true })).rejects.toThrow(
        'Dry-run is currently supported only',
      );
      await expect(
        readFile(path.join(target, 'src/shared/logging/logger.config.ts'), 'utf8'),
      ).rejects.toMatchObject({ code: 'ENOENT' });
      await applyRecipe('health', { path: target });
      const source = await readFile(
        path.join(target, 'src/shared/logging/logger.config.ts'),
        'utf8',
      );
      expect(source).toContain('"req.headers[\'x-internal-api-key\']"');
      expect(source).toContain('"req.headers.authorization"');
      expect(source).toContain('"req.headers.cookie"');
      expect(source).toContain('"res.headers[\'set-cookie\']"');
      expect(source).toContain('censor: "[REDACTED]"');
    } finally {
      output.mockRestore();
      await rm(target, { recursive: true, force: true });
    }
  });

  it('executes emitted builtin request IDs and isolates concurrent async contexts', async () => {
    const target = await mkdtemp(path.join(tmpdir(), 'ddd-request-context-'));
    const output = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await applyRecipe('health', { path: target });
      const source = await readFile(
        path.join(target, 'src/shared/logging/request-context.ts'),
        'utf8',
      );
      expect(source).toContain('import { randomUUID } from "node:crypto"');
      expect(source).not.toMatch(/from ["']uuid["']/);
      await symlink(path.join(process.cwd(), 'node_modules'), path.join(target, 'node_modules'));
      const emitted = path.join(target, 'request-context.cjs');
      await writeFile(
        emitted,
        ts.transpileModule(source, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
          },
        }).outputText,
      );
      type Context = { requestId: string; userId?: string; path: string; method: string };
      const generated = require(emitted) as {
        RequestContextMiddleware: new () => {
          use(req: unknown, res: unknown, next: () => void): void;
        };
        getRequestId(): string | undefined;
        getRequestContext(): Context | undefined;
      };
      const middleware = new generated.RequestContextMiddleware();
      const invoke = (headers: Record<string, string>, user: unknown, pathname: string) =>
        new Promise<{ context: Context | undefined; responseId: unknown }>((resolve) => {
          let responseId: unknown;
          middleware.use(
            { headers, user, path: pathname, method: 'GET' },
            {
              setHeader: (_name: string, value: unknown) => {
                responseId = value;
              },
            },
            () => {
              setTimeout(() => resolve({ context: generated.getRequestContext(), responseId }), 1);
            },
          );
        });
      const [fresh, supplied] = await Promise.all([
        invoke({}, { id: 123 }, '/first'),
        invoke({ 'x-request-id': 'existing-request' }, { id: 'canonical-user' }, '/second'),
      ]);
      expect(fresh?.context?.requestId).toMatch(/^[0-9a-f-]{36}$/);
      expect(fresh?.context?.userId).toBeUndefined();
      expect(fresh?.context?.path).toBe('/first');
      expect(fresh?.responseId).toBe(fresh?.context?.requestId);
      expect(supplied?.context).toMatchObject({
        requestId: 'existing-request',
        userId: 'canonical-user',
        path: '/second',
        method: 'GET',
      });
      expect(supplied?.responseId).toBe('existing-request');
      expect(generated.getRequestId()).toBeUndefined();
    } finally {
      output.mockRestore();
      await rm(target, { recursive: true, force: true });
    }
  });
});
