import * as fs from 'fs-extra';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { DeploymentOptions, generateDeployment } from './generate-deployment';

const NODE_IMAGE = `node:24-alpine@sha256:${'a'.repeat(64)}`;
const held: DeploymentOptions = {
  visibility: 'private',
  state: 'held',
  compose: false,
  ci: 'github',
  kubernetes: true,
  packageManager: 'bun',
  serviceName: 'identity-accounts-api',
  port: '3007',
  probe: false,
  nodeImage: NODE_IMAGE,
};

async function makeBunProject(root: string): Promise<void> {
  await fs.writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    dependencies: { rxjs: '^7.8.1' },
  });
  await fs.writeFile(
    path.join(root, 'bun.lock'),
    '{"lockfileVersion": 2, "workspaces": {"": {"name": "fixture", "dependencies": {"rxjs": "^7.8.1",},},}, "packages": {"rxjs": ["rxjs@7.8.2", "", {}, "sha512-fixture"],},}',
  );
}

async function file(root: string, relative: string): Promise<string> {
  return fs.readFile(path.join(root, relative), 'utf8');
}

async function tree(root: string): Promise<string[]> {
  const result: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const name of await fs.readdir(directory)) {
      const target = path.join(directory, name);
      const stat = await fs.lstat(target);
      result.push(path.relative(root, target));
      if (stat.isDirectory()) await visit(target);
    }
  }
  await visit(root);
  return result.sort();
}

describe('deployment profile generator', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-held-deploy-'));
  });

  afterEach(async () => {
    await fs.remove(root);
  });

  it('retains public npm active defaults and emits valid optional-free Docker COPY instructions', async () => {
    await generateDeployment({ path: root, ci: 'github', kubernetes: true });
    const deployment = parse(await file(root, 'k8s/deployment.yaml'));
    const docker = await file(root, 'Dockerfile');
    const cd = parse(await file(root, '.github/workflows/cd.yml'));
    expect(deployment.spec.replicas).toBe(3);
    expect(deployment.metadata.name).toBe('nestjs-app');
    expect(deployment.spec.template.spec.containers[0].livenessProbe.httpGet).toEqual({
      path: '/health',
      port: 3000,
    });
    expect(await fs.pathExists(path.join(root, 'k8s/ingress.yaml'))).toBe(true);
    expect(await fs.pathExists(path.join(root, 'k8s/hpa.yaml'))).toBe(true);
    expect(await fs.pathExists(path.join(root, 'docker-compose.yml'))).toBe(true);
    expect(cd.on.push.branches).toEqual(['main']);
    expect(cd.jobs['build-and-push'].steps.at(-1).with.push).toBe(true);
    expect(docker).toContain('FROM node:20-alpine AS builder');
    expect(docker).toContain('RUN npm ci');
    expect(docker).toContain('RUN npm prune --production');
    expect(docker).not.toContain('COPY prisma');
    expect(docker).not.toContain('2>/dev/null');
    expect(docker).not.toContain('prisma generate');
    expect(parse(await file(root, 'docker-compose.yml')).services.app.ports).toEqual([
      '${PORT:-3000}:3000',
    ]);
  });

  it('emits only project-owned Prisma copies and generation', async () => {
    await fs.outputFile(path.join(root, 'prisma/schema.prisma'), 'generator client {}');
    await generateDeployment({ path: root, compose: false });
    const docker = await file(root, 'Dockerfile');
    expect(docker).toContain('COPY prisma ./prisma\n');
    expect(docker).toContain('RUN npx prisma generate\n');
    expect(docker).toContain('COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma\n');
    expect(docker).not.toContain('2>/dev/null');
  });

  it('does not copy an unowned Prisma directory through a symlink', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-prisma-owner-'));
    try {
      await fs.writeFile(path.join(outside, 'schema.prisma'), 'owned elsewhere');
      await fs.symlink(outside, path.join(root, 'prisma'));
      await generateDeployment({ path: root, compose: false });
      expect(await file(root, 'Dockerfile')).not.toContain('COPY prisma');
    } finally {
      await fs.remove(outside);
    }
  });

  it('renders a non-activated private Bun profile with portable dependency stages and no probes', async () => {
    await makeBunProject(root);
    await fs.writeFile(path.join(root, '.env.example'), 'ACCOUNTS_BRIDGE_ENABLED=false\n');
    await generateDeployment({ ...held, path: root });
    const deployment = parse(await file(root, 'k8s/deployment.yaml'));
    const service = parse(await file(root, 'k8s/service.yaml'));
    const config = parse(await file(root, 'k8s/configmap.yaml'));
    const cd = parse(await file(root, '.github/workflows/cd.yml'));
    const ci = parse(await file(root, '.github/workflows/ci.yml'));
    const docker = await file(root, 'Dockerfile');
    expect(deployment.spec.replicas).toBe(0);
    expect(deployment.metadata.name).toBe('identity-accounts-api');
    const container = deployment.spec.template.spec.containers[0];
    expect(container.ports).toEqual([{ containerPort: 3007 }]);
    expect(container).not.toHaveProperty('livenessProbe');
    expect(container).not.toHaveProperty('readinessProbe');
    expect(service.spec.type).toBe('ClusterIP');
    expect(service.spec.ports[0].targetPort).toBe(3007);
    expect(config.data.PORT).toBe('3007');
    for (const unwanted of ['k8s/ingress.yaml', 'k8s/hpa.yaml', 'docker-compose.yml']) {
      expect(await fs.pathExists(path.join(root, unwanted))).toBe(false);
    }
    expect(Object.keys(cd.on)).toEqual(['workflow_dispatch']);
    expect(cd.on.workflow_dispatch.inputs.publish.default).toBe(false);
    const image = cd.jobs.image.steps.find((step: { uses?: string }) =>
      step.uses?.startsWith('docker/build-push-action'),
    );
    expect(image.with.push).toBe('${{ inputs.publish == true }}');
    expect(image.with.tags).toBe('${{ steps.meta.outputs.tags }}');
    expect(
      cd.jobs.image.steps.find((step: { id?: string }) => step.id === 'meta').with.flavor,
    ).toBe('latest=false');
    expect(ci.jobs.source).not.toHaveProperty('services');
    expect(
      ci.jobs.source.steps.find((step: { name?: string }) => step.name === 'Test source').run,
    ).toContain('globalsCleanup');
    expect(docker).toContain(`FROM ${NODE_IMAGE} AS production`);
    expect(docker).toContain('bun install --frozen-lockfile --production --linker=hoisted');
    expect(docker).toContain('bun install --frozen-lockfile --linker=hoisted');
    expect(docker).toContain('/app/node_modules ./node_modules');
    expect(docker).toContain('HEALTHCHECK NONE');
    expect(docker).toContain('CMD ["node", "dist/main"]');
    expect(docker).not.toContain('npm');
    expect(await file(root, '.env.example')).toBe('ACCOUNTS_BRIDGE_ENABLED=false\n');
  });

  it.each([
    ['public', 'active', true, true, 3],
    ['private', 'active', false, true, 3],
    ['public', 'held', true, false, 0],
    ['private', 'held', false, false, 0],
  ] as const)(
    'keeps visibility/state independent: %s/%s',
    async (visibility, state, ingress, hpa, replicas) => {
      await makeBunProject(root);
      await generateDeployment({
        path: root,
        visibility,
        state,
        compose: false,
        kubernetes: true,
        packageManager: 'bun',
      });
      expect(parse(await file(root, 'k8s/deployment.yaml')).spec.replicas).toBe(replicas);
      expect(await fs.pathExists(path.join(root, 'k8s/ingress.yaml'))).toBe(ingress);
      expect(await fs.pathExists(path.join(root, 'k8s/hpa.yaml'))).toBe(hpa);
    },
  );

  it('renders the configured liveness path without claiming provider readiness', async () => {
    await makeBunProject(root);
    await generateDeployment({
      ...held,
      path: root,
      probe: true,
      probePath: '/health/live',
      probeMode: 'live-only',
    });
    const container = parse(await file(root, 'k8s/deployment.yaml')).spec.template.spec
      .containers[0];
    expect(container.livenessProbe.httpGet.path).toBe('/health/live');
    expect(container).not.toHaveProperty('readinessProbe');
    expect(await file(root, 'Dockerfile')).toContain('http://localhost:3007/health/live');
    expect(parse(await file(root, 'k8s/deployment.yaml')).spec.replicas).toBe(0);
  });

  it.each<{
    label: string;
    profile: DeploymentOptions;
    probes: string[];
    replicas: number;
  }>([
    {
      label: 'public active defaults',
      profile: { kubernetes: true },
      probes: ['livenessProbe', 'readinessProbe'],
      replicas: 3,
    },
    { label: 'held without probes', profile: held, probes: [], replicas: 0 },
    {
      label: 'held liveness only',
      profile: { ...held, probe: true, probeMode: 'live-only' },
      probes: ['livenessProbe'],
      replicas: 0,
    },
    {
      label: 'held liveness and readiness',
      profile: { ...held, probe: true },
      probes: ['livenessProbe', 'readinessProbe'],
      replicas: 0,
    },
  ])('emits one final Deployment newline with unchanged $label semantics', async (fixture) => {
    await makeBunProject(root);
    await generateDeployment({ ...fixture.profile, path: root });
    const source = await file(root, 'k8s/deployment.yaml');
    expect(source).toMatch(/\S\n$/);
    expect(source).not.toMatch(/[ \t]+\n/);
    const deployment = parse(source);
    const container = deployment.spec.template.spec.containers[0];
    expect(deployment.spec.replicas).toBe(fixture.replicas);
    expect(['livenessProbe', 'readinessProbe'].filter((key) => key in container)).toEqual(
      fixture.probes,
    );
  });

  it('holds GitLab publication behind a manual job and an explicit false-default variable', async () => {
    await makeBunProject(root);
    await generateDeployment({ ...held, path: root, ci: 'gitlab' });
    const ci = parse(await file(root, '.gitlab-ci.yml'));
    expect(ci.variables.PUBLISH_IMAGE).toBe('false');
    expect(ci.docker.when).toBe('manual');
    expect(ci.docker).not.toHaveProperty('before_script');
    expect(ci.source.script[0]).toContain('bun install --frozen-lockfile');
    expect(ci.docker.script[1]).toContain('if [ "$PUBLISH_IMAGE" = "true" ]');
  });

  it.each([
    { visibility: 'external' },
    { state: 'running' },
    { serviceName: 'Wrong/name' },
    { serviceName: 'a'.repeat(64) },
    { port: '0' },
    { port: '65536' },
    { port: '3000\nRUN false' },
    { port: '3e3' },
    { nodeImage: 'private.example/node:24' },
    { nodeImage: 'node:14-alpine' },
    { nodeImage: 'node:24-alpine\nRUN false' },
    { probePath: 'https://example.com/health' },
    { probePath: '/health?secret=x' },
    { probePath: '/health\nport: 22' },
    { probePath: '//external' },
    { probeMode: 'guess' },
    { probe: false, probePath: '/health' },
    { packageManager: 'pnpm' },
    { ci: 'guess' },
    { ci: '' },
    { state: 'held' },
    { visibility: 'private' },
  ])('rejects invalid options before creating files: %j', async (invalid) => {
    await expect(
      generateDeployment({ path: root, ...invalid } as DeploymentOptions),
    ).rejects.toThrow();
    expect(await tree(root)).toEqual([]);
  });

  it('validates new private npm lock provenance without changing default npm behavior', async () => {
    const options: DeploymentOptions = {
      path: root,
      visibility: 'private',
      compose: false,
      ci: 'github',
    };
    await expect(generateDeployment(options)).rejects.toThrow('package.json');
    await fs.writeJson(path.join(root, 'package.json'), {
      name: 'npm-fixture',
      dependencies: { rxjs: '^7' },
    });
    await fs.writeJson(path.join(root, 'package-lock.json'), {
      lockfileVersion: 3,
      packages: { '': { name: 'npm-fixture', dependencies: { rxjs: '^6' } } },
    });
    await expect(generateDeployment(options)).rejects.toThrow('npm lock dependencies mismatch');
    expect(await tree(root)).toEqual(['package-lock.json', 'package.json']);
    await fs.writeJson(path.join(root, 'package-lock.json'), {
      lockfileVersion: 3,
      packages: { '': { name: 'npm-fixture', dependencies: { rxjs: '^7' } } },
    });
    await generateDeployment(options);
    expect(await file(root, 'Dockerfile')).toContain('RUN npm ci');
  });

  it('rejects a declared dependency without a Bun lock resolution', async () => {
    await makeBunProject(root);
    await fs.writeJson(path.join(root, 'bun.lock'), {
      lockfileVersion: 2,
      workspaces: { '': { name: 'fixture', dependencies: { rxjs: '^7.8.1' } } },
      packages: {},
    });
    await expect(generateDeployment({ ...held, path: root })).rejects.toThrow('no resolution');
    expect(await tree(root)).toEqual(['bun.lock', 'package.json']);
  });

  it('refuses an existing public HPA when switching to held state', async () => {
    await fs.outputFile(path.join(root, 'k8s/hpa.yaml'), 'active owner HPA');
    const before = await tree(root);
    await expect(
      generateDeployment({ path: root, state: 'held', compose: false, kubernetes: true }),
    ).rejects.toThrow('Refusing existing HPA');
    expect(await tree(root)).toEqual(before);
  });

  it('refuses a missing, mismatched or symlinked Bun lock before writing', async () => {
    await expect(generateDeployment({ ...held, path: root })).rejects.toThrow('package.json');
    await makeBunProject(root);
    await fs.writeJson(path.join(root, 'package.json'), {
      name: 'fixture',
      dependencies: { rxjs: '^6' },
    });
    await expect(generateDeployment({ ...held, path: root })).rejects.toThrow(
      'dependencies mismatch',
    );
    const before = await tree(root);
    await fs.remove(path.join(root, 'bun.lock'));
    await fs.symlink('/unowned/missing', path.join(root, 'bun.lock'));
    await expect(generateDeployment({ ...held, path: root })).rejects.toThrow(
      'project-owned bun.lock',
    );
    expect(await tree(root)).toEqual(before);
  });

  it.each(['Dockerfile', '.github/workflows/cd.yml', 'k8s/hpa.yaml', 'k8s/ingress.yaml'])(
    'refuses existing private delivery file %s before partial writes',
    async (target) => {
      await makeBunProject(root);
      await fs.outputFile(path.join(root, target), 'owner content');
      const before = await tree(root);
      await expect(generateDeployment({ ...held, path: root })).rejects.toThrow(
        /Refusing (?:to overwrite|existing HPA)/,
      );
      expect(await tree(root)).toEqual(before);
      expect(await file(root, target)).toBe('owner content');
    },
  );

  it('refuses a linked target parent before creating a Dockerfile', async () => {
    await makeBunProject(root);
    await fs.symlink('/unowned/missing', path.join(root, '.github'));
    const before = await tree(root);
    await expect(generateDeployment({ ...held, path: root })).rejects.toThrow('symlink');
    expect(await tree(root)).toEqual(before);
  });

  it('parses actual CLI flags and rejects unsafe held Compose without outputs', async () => {
    await makeBunProject(root);
    const cli = path.resolve(__dirname, '../../dist/index.js');
    const result = spawnSync(
      process.execPath,
      [
        cli,
        'deploy',
        '--path',
        root,
        '--visibility',
        'private',
        '--state',
        'held',
        '--package-manager',
        'bun',
      ],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('requires --no-compose');
    expect(await tree(root)).toEqual(['bun.lock', 'package.json']);
    const accepted = spawnSync(
      process.execPath,
      [
        cli,
        'deploy',
        '--path',
        root,
        '--visibility',
        'private',
        '--state',
        'held',
        '--package-manager',
        'bun',
        '--no-compose',
        '--no-probe',
        '--service-name',
        'identity-delivery-api',
        '--port',
        '3008',
        '--node-image',
        NODE_IMAGE,
        '--kubernetes',
      ],
      { encoding: 'utf8' },
    );
    if (accepted.status !== 0)
      throw new Error(
        `Actual held CLI failed: ${JSON.stringify({ status: accepted.status, stderr: accepted.stderr, stdout: accepted.stdout, error: accepted.error?.message })}`,
      );
    // The existing CLI update probe warns when npm is absent from the Bun-only runner.
    // Allow exactly that unrelated notice; any generator error still fails this test.
    const legacyUpdateWarning =
      'Warning: Could not check for CLI updates: Failed to get latest version of nestjs-ddd-cli: Command failed: npm view nestjs-ddd-cli version\n/bin/sh: 1: npm: not found\n\n';
    expect(accepted.stderr.replace(legacyUpdateWarning, '')).toBe('');
    expect(accepted.status).toBe(0);
    expect(parse(await file(root, 'k8s/deployment.yaml')).metadata.name).toBe(
      'identity-delivery-api',
    );
  });
});
