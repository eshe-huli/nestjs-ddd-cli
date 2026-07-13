import { afterEach, describe, expect, it, jest } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as ts from 'typescript';
import { applyRecipe } from '../../src/commands/recipe';
import { applyPlatformServiceAccessRequestContextRecipe } from '../../src/commands/recipes';

interface GeneratedParserModule {
  parseActiveRequestContextIntrospection(
    payload: unknown,
    expectedAudience: string,
    now?: Date,
  ): unknown;
}

interface GeneratedHeadersModule {
  extractOpaqueRequestContextLease(headers: Record<string, unknown>): string;
  platformRequestMetadataFromHeaders(headers: Record<string, unknown>): unknown;
}

interface GeneratedConfigModule {
  serviceAccessRequestContextModeFromEnv(): string;
  serviceAccessRequestContextConfigFromEnv(mode?: string): Record<string, unknown>;
}

interface GeneratedClientModule {
  ServiceAccessRequestContextClient: new () => {
    introspect(token: string, config: Record<string, unknown>): Promise<unknown>;
  };
}

interface GeneratedGuardModule {
  ServiceAccessRequestContextGuard: new (client: {
    introspect(token: string, config: Record<string, unknown>): Promise<unknown>;
  }) => {
    canActivate(context: unknown): Promise<boolean>;
  };
}

describe('platform Service Access request-context recipe', () => {
  const testDir = path.join(__dirname, '../.test-platform-service-access-request-context-output');
  const originalEnv = process.env;

  afterEach(async () => {
    jest.restoreAllMocks();
    process.env = originalEnv;
    await fs.remove(testDir);
  });

  it('generates the canonical fail-closed introspection transport and guard', async () => {
    await fs.ensureDir(testDir);
    await fs.writeFile(path.join(testDir, '.env.example'), 'EXISTING=true\n');

    expect(applyPlatformServiceAccessRequestContextRecipe).toBeDefined();
    await applyRecipe('platform-service-access-request-context', { path: testDir });

    const root = path.join(testDir, 'src/shared/auth/platform-service-access-request-context');
    const client = await fs.readFile(
      path.join(root, 'service-access-request-context.client.ts'),
      'utf-8',
    );
    const guard = await fs.readFile(
      path.join(root, 'service-access-request-context.guard.ts'),
      'utf-8',
    );
    const parser = await fs.readFile(
      path.join(root, 'request-context-introspection.parser.ts'),
      'utf-8',
    );
    const module = await fs.readFile(
      path.join(root, 'service-access-request-context.module.ts'),
      'utf-8',
    );
    const docs = await fs.readFile(
      path.join(testDir, 'docs/platform/platform-service-access-request-context.md'),
      'utf-8',
    );
    const env = await fs.readFile(
      path.join(testDir, '.env.platform-service-access-request-context.example'),
      'utf-8',
    );

    expect(
      await fs.pathExists(
        path.join(testDir, 'src/shared/platform-context/platform-context.types.ts'),
      ),
    ).toBe(true);
    expect(client).toContain(
      'config.serviceAccessUrl + "/api/v1/internal/request-context/introspect"',
    );
    expect(client).toContain('method: "POST"');
    expect(client).toContain('redirect: "error"');
    expect(client).toContain('"x-internal-api-key": config.internalApiKey');
    expect(client).toContain('"x-service-access-credential": config.serviceAccessCredential');
    expect(client).toContain('body: JSON.stringify({ token })');
    expect(client).toContain('if (!response.ok)');
    expect(client).toContain('parseActiveRequestContextIntrospection(');
    expect(client.toLowerCase()).not.toContain('authorization');

    expect(parser).toContain('if (record["active"] !== true)');
    expect(parser).toContain('audience !== requiredString(expectedAudience)');
    expect(parser).toContain('principal.machine.serviceName !== audience');
    expect(parser).toContain('const principal = parsePrincipal(record["principal"])');
    expect(parser).toContain('provenance: parseProvenance(record["provenance"])');
    expect(guard).toContain('extractOpaqueRequestContextLease(request.headers)');
    expect(guard).toContain('delete request.platformContext;');
    expect(guard).toContain('if (mode === "disabled")');
    expect(guard).toContain('if (mode === "shadow")');
    expect(guard).toContain('principal: introspection.principal');
    expect(guard).toContain('requestId: metadata.requestId');
    expect(guard).toContain('correlationId: metadata.correlationId');
    expect(guard).toContain('idempotencyKey: metadata.idempotencyKey');
    expect(guard).not.toContain('x-subject');
    expect(guard).not.toContain('x-business');
    expect(guard).not.toContain('headers.authorization');
    expect(module).toContain('imports: [PlatformContextModule]');

    expect(env).toContain('SERVICE_ACCESS_URL=');
    expect(env).toContain('SERVICE_ACCESS_ALLOW_INSECURE_HTTP=false');
    expect(env).toContain('SERVICE_ACCESS_INTERNAL_API_KEY=');
    expect(env).toContain('SERVICE_ACCESS_CREDENTIAL=');
    expect(env).toContain('SERVICE_ACCESS_EXPECTED_AUDIENCE=replace-me-service');
    expect(env).toContain('SERVICE_ACCESS_REQUEST_CONTEXT_MODE=enforce');
    expect(await fs.readFile(path.join(testDir, '.env.example'), 'utf-8')).toBe('EXISTING=true\n');
    expect(docs).toContain('run its guard before the\nroute-specific PARC guard');
    expect(docs).toContain("It never forwards the\nactor's bearer token.");
    expect(docs).toContain('shadow and disabled modes never turn actor, business,');
  });

  it('parses only active, unexpired, audience-bound canonical responses', async () => {
    await applyRecipe('platform-service-access-request-context', { path: testDir });
    const parserSource = await generatedFile('request-context-introspection.parser.ts');
    const parser = loadGeneratedModule<GeneratedParserModule>(parserSource);
    const fixtures = await fs.readJson(
      path.join(
        __dirname,
        '../fixtures/platform-service-access-request-context/introspection-responses.json',
      ),
    );

    expect(
      parser.parseActiveRequestContextIntrospection(
        fixtures.active,
        'owner-service',
        new Date('2030-01-01T00:00:00.000Z'),
      ),
    ).toMatchObject({
      active: true,
      audience: 'owner-service',
      principal: {
        actor: { authenticatedBy: 'zitadel' },
        machine: { serviceName: 'owner-service' },
      },
    });
    expect(() =>
      parser.parseActiveRequestContextIntrospection(
        fixtures.inactiveUnknownOrReplay,
        'owner-service',
      ),
    ).toThrow('Invalid Service Access request-context introspection response');
    expect(() =>
      parser.parseActiveRequestContextIntrospection(fixtures.active, 'another-service'),
    ).toThrow('Invalid Service Access request-context introspection response');
    expect(() =>
      parser.parseActiveRequestContextIntrospection(fixtures.malformedPrincipal, 'owner-service'),
    ).toThrow('Invalid Service Access request-context introspection response');
    expect(() =>
      parser.parseActiveRequestContextIntrospection(
        fixtures.mismatchedMachineAudience,
        'owner-service',
      ),
    ).toThrow('Invalid Service Access request-context introspection response');
    expect(() =>
      parser.parseActiveRequestContextIntrospection(
        fixtures.active,
        'owner-service',
        new Date('2100-01-01T00:00:00.000Z'),
      ),
    ).toThrow('Invalid Service Access request-context introspection response');
  });

  it('denies owner errors and inactive unknown or replayed leases', async () => {
    await applyRecipe('platform-service-access-request-context', { path: testDir });
    const parser = loadGeneratedModule<GeneratedParserModule>(
      await generatedFile('request-context-introspection.parser.ts'),
    );
    const clientModule = loadGeneratedModule<GeneratedClientModule>(
      await generatedFile('service-access-request-context.client.ts'),
      { './request-context-introspection.parser': parser },
    );
    const fixtures = await fs.readJson(
      path.join(
        __dirname,
        '../fixtures/platform-service-access-request-context/introspection-responses.json',
      ),
    );
    const client = new clientModule.ServiceAccessRequestContextClient();
    const config = {
      mode: 'enforce',
      serviceAccessUrl: 'https://service-access.internal',
      internalApiKey: 'internal-key',
      serviceAccessCredential: 'machine-credential',
      expectedAudience: 'owner-service',
      timeoutMs: 1000,
    };
    const fetchMock = jest.spyOn(global, 'fetch');

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await expect(client.introspect('opaque-lease', config)).rejects.toThrow(
      'Service Access request context denied',
    );

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const sentHeaders = init?.headers as Record<string, string>;
    expect(url).toBe('https://service-access.internal/api/v1/internal/request-context/introspect');
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('error');
    expect(init?.body).toBe(JSON.stringify({ token: 'opaque-lease' }));
    expect(sentHeaders['x-internal-api-key']).toBe('internal-key');
    expect(sentHeaders['x-service-access-credential']).toBe('machine-credential');
    expect(Object.keys(sentHeaders).map((name) => name.toLowerCase())).not.toContain(
      'authorization',
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => fixtures.inactiveUnknownOrReplay,
    } as Response);
    await expect(client.introspect('replayed-lease', config)).rejects.toThrow(
      'Service Access request context denied',
    );
  });

  it('treats the lease as opaque and copies only request metadata headers', async () => {
    await applyRecipe('platform-service-access-request-context', { path: testDir });
    const headersSource = await generatedFile('request-context-headers.ts');
    const headers = loadGeneratedModule<GeneratedHeadersModule>(headersSource);

    expect(
      headers.extractOpaqueRequestContextLease({
        'x-service-access-request-context': ' opaque-lease-value ',
        authorization: 'Bearer actor-token',
        'x-subject-id': 'caller-selected-subject',
      }),
    ).toBe('opaque-lease-value');
    expect(
      headers.platformRequestMetadataFromHeaders({
        'x-request-id': 'request-1',
        'x-correlation-id': 'correlation-1',
        'idempotency-key': 'idempotency-1',
        'x-subject-id': 'caller-selected-subject',
      }),
    ).toEqual({
      requestId: 'request-1',
      correlationId: 'correlation-1',
      idempotencyKey: 'idempotency-1',
    });
    expect(() => headers.extractOpaqueRequestContextLease({})).toThrow(
      'Invalid Service Access request-context headers',
    );
    expect(() =>
      headers.extractOpaqueRequestContextLease({
        'x-service-access-request-context': ['lease-one', 'lease-two'],
      }),
    ).toThrow('Invalid Service Access request-context headers');
  });

  it('requires the owner env contract outside explicit disabled mode', async () => {
    await applyRecipe('platform-service-access-request-context', { path: testDir });
    const configSource = await generatedFile('service-access-request-context.config.ts');
    const config = loadGeneratedModule<GeneratedConfigModule>(configSource);

    process.env = { ...originalEnv };
    delete process.env['SERVICE_ACCESS_REQUEST_CONTEXT_MODE'];
    delete process.env['SERVICE_ACCESS_URL'];
    expect(config.serviceAccessRequestContextModeFromEnv()).toBe('enforce');
    expect(() => config.serviceAccessRequestContextConfigFromEnv('enforce')).toThrow(
      'SERVICE_ACCESS_URL is required',
    );
    expect(config.serviceAccessRequestContextConfigFromEnv('disabled')).toEqual({
      mode: 'disabled',
    });

    process.env = {
      ...originalEnv,
      SERVICE_ACCESS_REQUEST_CONTEXT_MODE: 'shadow',
      SERVICE_ACCESS_URL: 'https://service-access.internal/',
      SERVICE_ACCESS_INTERNAL_API_KEY: 'internal-key',
      SERVICE_ACCESS_CREDENTIAL: 'machine-credential',
      SERVICE_ACCESS_EXPECTED_AUDIENCE: 'owner-service',
      SERVICE_ACCESS_TIMEOUT_MS: '1500',
    };
    expect(config.serviceAccessRequestContextConfigFromEnv('shadow')).toEqual({
      mode: 'shadow',
      serviceAccessUrl: 'https://service-access.internal',
      allowInsecureHttp: false,
      internalApiKey: 'internal-key',
      serviceAccessCredential: 'machine-credential',
      expectedAudience: 'owner-service',
      timeoutMs: 1500,
    });

    process.env = {
      ...process.env,
      SERVICE_ACCESS_URL: 'http://service-access-platform.platform-identity.svc.cluster.local/',
      SERVICE_ACCESS_ALLOW_INSECURE_HTTP: 'true',
    };
    expect(config.serviceAccessRequestContextConfigFromEnv('enforce')).toMatchObject({
      serviceAccessUrl: 'http://service-access-platform.platform-identity.svc.cluster.local',
      allowInsecureHttp: true,
    });

    process.env['SERVICE_ACCESS_URL'] = 'http://service-access.example.com';
    expect(() => config.serviceAccessRequestContextConfigFromEnv('enforce')).toThrow(
      'SERVICE_ACCESS_URL must use HTTPS',
    );
  });

  it('executes disabled, shadow, and enforce guard behavior fail closed', async () => {
    await applyRecipe('platform-service-access-request-context', { path: testDir });
    const config = loadGeneratedModule<GeneratedConfigModule>(
      await generatedFile('service-access-request-context.config.ts'),
    );
    const headers = loadGeneratedModule<GeneratedHeadersModule>(
      await generatedFile('request-context-headers.ts'),
    );
    class UnauthorizedException extends Error {}
    class Logger {
      warn(): void {}
    }
    const guardModule = loadGeneratedModule<GeneratedGuardModule>(
      await generatedFile('service-access-request-context.guard.ts'),
      {
        '@nestjs/common': {
          Injectable: () => (target: unknown) => target,
          Logger,
          UnauthorizedException,
        },
        '../../platform-context': {
          createPlatformRequestContext: (input: Record<string, unknown>) => input,
        },
        './service-access-request-context.config': config,
        './request-context-headers': headers,
        './service-access-request-context.client': {},
      },
    );
    const fixtures = await fs.readJson(
      path.join(
        __dirname,
        '../fixtures/platform-service-access-request-context/introspection-responses.json',
      ),
    );
    const introspect = jest.fn(async () => fixtures.active);
    const guard = new guardModule.ServiceAccessRequestContextGuard({ introspect });
    const request: Record<string, unknown> = {
      headers: { 'x-service-access-request-context': 'opaque-lease' },
      platformContext: { attackerSelected: true },
    };
    const executionContext = {
      switchToHttp: () => ({ getRequest: () => request }),
    };

    process.env = { ...originalEnv, SERVICE_ACCESS_REQUEST_CONTEXT_MODE: 'disabled' };
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(request['platformContext']).toBeUndefined();
    expect(introspect).not.toHaveBeenCalled();

    process.env = activeRequestContextEnv('enforce');
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(request['platformContext']).toMatchObject({ principal: fixtures.active.principal });

    introspect.mockRejectedValueOnce(new Error('unavailable'));
    await expect(guard.canActivate(executionContext)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request['platformContext']).toBeUndefined();

    process.env = activeRequestContextEnv('shadow');
    introspect.mockRejectedValueOnce(new Error('unavailable'));
    await expect(guard.canActivate(executionContext)).resolves.toBe(true);
    expect(request['platformContext']).toBeUndefined();
  });

  it('semantically type-checks the generated consumer', async () => {
    await applyRecipe('platform-service-access-request-context', { path: testDir });
    const rootNames = await collectTypeScriptFiles(path.join(testDir, 'src/shared'));
    const program = ts.createProgram(rootNames, {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      experimentalDecorators: true,
      esModuleInterop: true,
      skipLibCheck: true,
      types: ['node'],
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
      }),
    ).toBe('');
  });

  async function generatedFile(fileName: string): Promise<string> {
    return fs.readFile(
      path.join(testDir, 'src/shared/auth/platform-service-access-request-context', fileName),
      'utf-8',
    );
  }
});

function activeRequestContextEnv(mode: 'shadow' | 'enforce'): NodeJS.ProcessEnv {
  return {
    SERVICE_ACCESS_REQUEST_CONTEXT_MODE: mode,
    SERVICE_ACCESS_URL: 'https://service-access.internal',
    SERVICE_ACCESS_INTERNAL_API_KEY: 'internal-key',
    SERVICE_ACCESS_CREDENTIAL: 'machine-credential',
    SERVICE_ACCESS_EXPECTED_AUDIENCE: 'owner-service',
  };
}

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectTypeScriptFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
    }),
  );
  return files.flat();
}

function loadGeneratedModule<T>(source: string, dependencies: Record<string, unknown> = {}): T {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const generatedModule: { exports: unknown } = { exports: {} };
  const evaluate = new Function('exports', 'module', 'require', output);
  const generatedRequire = (moduleName: string): unknown =>
    dependencies[moduleName] ?? require(moduleName);
  evaluate(generatedModule.exports, generatedModule, generatedRequire);
  return generatedModule.exports as T;
}
