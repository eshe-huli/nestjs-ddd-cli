import * as path from 'path';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import { parse } from 'yaml';
import { ensureDir, writeFile, fileExists } from '../utils/file.utils';

export interface DeploymentOptions {
  path?: string;
  docker?: boolean;
  compose?: boolean;
  ci?: 'github' | 'gitlab' | 'none';
  kubernetes?: boolean;
  visibility?: 'public' | 'private';
  state?: 'active' | 'held';
  serviceName?: string;
  port?: string | number;
  packageManager?: 'npm' | 'bun';
  probePath?: string;
  probeMode?: 'live-only' | 'live-and-ready';
  probe?: boolean;
  nodeImage?: string;
  application?: 'nest' | 'next-standalone';
}

interface DeploymentProfile {
  visibility: 'public' | 'private';
  state: 'active' | 'held';
  serviceName: string;
  port: number;
  packageManager: 'npm' | 'bun';
  probePath: string | undefined;
  probeMode: 'live-only' | 'live-and-ready';
  nodeImage: string;
  hasPrisma: boolean;
  hasNestConfig: boolean;
  application: 'nest' | 'next-standalone';
}

interface DeploymentFile {
  destination: string;
  content: string;
}

const BUN_IMAGE =
  'oven/bun:1.4.0-alpine@sha256:07235578f79ef8c6f97d94aee7938e76f5cdba5f21ae5dbfdd3d3d38058437eb';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function lstatOrAbsent(target: string): Promise<fs.Stats | undefined> {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function readOwnedFile(basePath: string, name: string): Promise<string> {
  const target = path.join(basePath, name);
  const stat = await lstatOrAbsent(target);
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size > 10 * 1024 * 1024) {
    throw new Error(`A regular project-owned ${name} is required`);
  }
  return fs.readFile(target, 'utf8');
}

async function resolveProfile(
  basePath: string,
  options: DeploymentOptions,
): Promise<DeploymentProfile> {
  const visibility = options.visibility ?? 'public';
  const state = options.state ?? 'active';
  const packageManager = options.packageManager ?? 'npm';
  const serviceName = options.serviceName ?? 'nestjs-app';
  const portText = String(options.port ?? 3000);
  const nodeImage = options.nodeImage ?? 'node:20-alpine';
  const probeMode = options.probeMode ?? 'live-and-ready';
  const application = options.application ?? 'nest';
  if (!['nest', 'next-standalone'].includes(application)) throw new Error('Invalid application');
  if (
    application === 'next-standalone' &&
    (packageManager !== 'bun' ||
      visibility !== 'private' ||
      state !== 'held' ||
      options.probe !== false)
  )
    throw new Error('Next standalone requires an explicit private held Bun profile without probes');
  if (!['live-only', 'live-and-ready'].includes(probeMode)) throw new Error('Invalid probe mode');
  if (!['public', 'private'].includes(visibility)) throw new Error('Invalid visibility');
  if (!['active', 'held'].includes(state)) throw new Error('Invalid state');
  if (!['npm', 'bun'].includes(packageManager)) throw new Error('Invalid package manager');
  if (options.ci !== undefined && !['github', 'gitlab', 'none'].includes(options.ci))
    throw new Error('Invalid CI type');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(serviceName))
    throw new Error('Invalid service name');
  if (!/^[1-9][0-9]{0,4}$/.test(portText) || Number(portText) > 65535)
    throw new Error('Invalid port');
  if (!/^node:(20|22|24)-alpine(?:@sha256:[a-f0-9]{64})?$/.test(nodeImage))
    throw new Error('Invalid supported Node Alpine image');
  if (options.probe === false && options.probePath !== undefined)
    throw new Error('--no-probe conflicts with --probe-path');
  const probePath = options.probe === false ? undefined : (options.probePath ?? '/health');
  if (
    probePath !== undefined &&
    (!/^\/[A-Za-z0-9/_-]{0,199}$/.test(probePath) || probePath.includes('//'))
  )
    throw new Error('Invalid probe path');
  if (state === 'held' && options.compose !== false)
    throw new Error('Held deployment requires --no-compose');
  if (visibility === 'private' && options.compose !== false)
    throw new Error('Private deployment requires --no-compose');

  if (packageManager === 'bun') {
    const manifest: unknown = JSON.parse(await readOwnedFile(basePath, 'package.json'));
    const lock: unknown = parse(await readOwnedFile(basePath, 'bun.lock'), { maxAliasCount: 0 });
    if (
      !record(manifest) ||
      !record(lock) ||
      ![1, 2].includes(Number(lock['lockfileVersion'])) ||
      !record(lock['workspaces']) ||
      !record(lock['workspaces'][''])
    )
      throw new Error('Invalid Bun manifest/lock provenance');
    const workspace = lock['workspaces'][''];
    if (typeof manifest['name'] !== 'string' || workspace['name'] !== manifest['name'])
      throw new Error('Bun lock workspace name mismatch');
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      const declared = manifest[field] ?? {};
      const locked = workspace[field] ?? {};
      if (
        !record(declared) ||
        !record(locked) ||
        Object.keys(declared).length !== Object.keys(locked).length ||
        Object.entries(declared).some(
          ([name, version]) => typeof version !== 'string' || locked[name] !== version,
        )
      )
        throw new Error(`Bun lock ${field} mismatch`);
    }
    if (!record(lock['packages'])) throw new Error('Bun lock has no package resolutions');
    if (Object.keys(lock['workspaces']).length !== 1)
      throw new Error('Bun deployment requires a single-package lock');
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      const dependencies = workspace[field] ?? {};
      if (!record(dependencies)) throw new Error('Invalid Bun dependency declarations');
      for (const name of Object.keys(dependencies)) {
        const resolution = lock['packages'][name];
        if (!Array.isArray(resolution) || typeof resolution[0] !== 'string')
          throw new Error(`Bun lock has no resolution for ${name}`);
      }
    }
  }
  if (visibility === 'private' && packageManager === 'npm') {
    const manifest: unknown = JSON.parse(await readOwnedFile(basePath, 'package.json'));
    const lock: unknown = JSON.parse(await readOwnedFile(basePath, 'package-lock.json'));
    if (
      !record(manifest) ||
      !record(lock) ||
      ![2, 3].includes(Number(lock['lockfileVersion'])) ||
      !record(lock['packages']) ||
      !record(lock['packages'][''])
    )
      throw new Error('Invalid npm manifest/lock provenance');
    const workspace = lock['packages'][''];
    if (workspace['name'] !== manifest['name']) throw new Error('npm lock package name mismatch');
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      const declared = manifest[field] ?? {};
      const locked = workspace[field] ?? {};
      if (
        !record(declared) ||
        !record(locked) ||
        Object.keys(declared).length !== Object.keys(locked).length ||
        Object.entries(declared).some(
          ([name, version]) => typeof version !== 'string' || locked[name] !== version,
        )
      )
        throw new Error(`npm lock ${field} mismatch`);
    }
  }
  const schema = await lstatOrAbsent(path.join(basePath, 'prisma/schema.prisma'));
  const prismaDirectory = await lstatOrAbsent(path.join(basePath, 'prisma'));
  const hasPrisma =
    !!schema?.isFile() &&
    !schema.isSymbolicLink() &&
    !!prismaDirectory?.isDirectory() &&
    !prismaDirectory.isSymbolicLink();
  const nestConfig = await lstatOrAbsent(path.join(basePath, 'nest-cli.json'));
  const hasNestConfig = !!nestConfig?.isFile() && !nestConfig.isSymbolicLink();
  if (application === 'next-standalone') {
    const manifest: unknown = JSON.parse(await readOwnedFile(basePath, 'package.json'));
    if (
      !record(manifest) ||
      !record(manifest['dependencies']) ||
      typeof manifest['dependencies']['next'] !== 'string' ||
      !record(manifest['scripts']) ||
      typeof manifest['scripts']['test'] !== 'string' ||
      !/^bun test(?:\s|$)/.test(manifest['scripts']['test']) ||
      manifest['scripts']['build'] !== 'next build' ||
      hasPrisma ||
      hasNestConfig
    )
      throw new Error(
        'Next standalone requires Next build and native Bun test scripts without Nest/Prisma',
      );
    const ignore = await lstatOrAbsent(path.join(basePath, '.dockerignore'));
    if (ignore) {
      const content = await readOwnedFile(basePath, '.dockerignore');
      const lines = content.split(/\r?\n/).map((line) => line.trim());
      if (
        !['node_modules', '.next', '.env', '.env.*'].every((pattern) => lines.includes(pattern)) ||
        lines.some((line) => line.startsWith('!') && line !== '!.env.example')
      )
        throw new Error(
          'Existing Next Docker ignore must exclude node_modules, .next and environment files without other exceptions',
        );
    }
  }
  return {
    visibility,
    state,
    serviceName,
    port: Number(portText),
    packageManager,
    probePath,
    probeMode,
    nodeImage,
    hasPrisma,
    hasNestConfig,
    application,
  };
}

async function assertPrivateTarget(basePath: string, destination: string): Promise<void> {
  const target = path.join(basePath, destination);
  let cursor = target;
  while (true) {
    const stat = await lstatOrAbsent(cursor);
    if (stat?.isSymbolicLink()) throw new Error(`Refusing symlink deployment target: ${cursor}`);
    if (stat && cursor !== target && !stat.isDirectory())
      throw new Error(`Deployment parent is not a directory: ${cursor}`);
    if (cursor === basePath) break;
    cursor = path.dirname(cursor);
  }
  if (await lstatOrAbsent(target))
    throw new Error(`Refusing to overwrite private deployment file: ${destination}`);
}

export async function generateDeployment(options: DeploymentOptions) {
  const basePath = path.resolve(options.path || process.cwd());
  const profile = await resolveProfile(basePath, options);
  console.log(chalk.blue('\n🚀 Generating deployment configurations...\n'));
  const files: DeploymentFile[] = [];
  if (options.docker !== false) files.push(...(await generateDockerfile(basePath, profile)));
  if (options.compose !== false) files.push(...(await generateDockerCompose(basePath, profile)));
  if (options.ci && options.ci !== 'none')
    files.push(...(await generateCIPipeline(basePath, options.ci, profile)));
  if (options.kubernetes) files.push(...(await generateKubernetesManifests(basePath, profile)));
  files.push(
    ...(await generateDockerIgnore(basePath, profile)),
    ...(await generateEnvExample(basePath, profile)),
  );
  if (
    profile.state === 'held' &&
    options.kubernetes &&
    (await lstatOrAbsent(path.join(basePath, 'k8s/hpa.yaml')))
  ) {
    throw new Error('Refusing existing HPA in held deployment');
  }
  if (profile.visibility === 'private') {
    // Preflight every selected target before the first write, including dangling links.
    for (const file of files) await assertPrivateTarget(basePath, file.destination);
    if (options.kubernetes) {
      for (const destination of ['k8s/ingress.yaml', 'k8s/hpa.yaml']) {
        if (!files.some((file) => file.destination === destination))
          await assertPrivateTarget(basePath, destination);
      }
    }
  }
  for (const file of files) {
    const target = path.join(basePath, file.destination);
    if (profile.visibility === 'private') {
      await assertPrivateTarget(basePath, file.destination);
      await ensureDir(path.dirname(target));
      // Preserve a concurrently created file instead of truncating it.
      await fs.writeFile(target, file.content, { encoding: 'utf8', flag: 'wx' });
    } else {
      await writeFile(target, file.content);
    }
    console.log(chalk.green(`  ✓ ${file.destination}`));
  }
  console.log(chalk.green('\n✅ Deployment configurations generated successfully!'));
  console.log(
    profile.state === 'held'
      ? chalk.yellow(
          'Held source only: replicas 0; review image, private network and readiness before activation.',
        )
      : chalk.yellow('Review generated files and environment before deployment.'),
  );
}

async function generateDockerfile(
  basePath: string,
  profile: DeploymentProfile,
): Promise<DeploymentFile[]> {
  const dockerfilePath = path.join(basePath, 'Dockerfile');

  if (profile.visibility === 'public' && (await fileExists(dockerfilePath))) {
    console.log(chalk.yellow('  Dockerfile already exists. Skipping...'));
    return [];
  }

  if (profile.application === 'next-standalone') {
    const content = `FROM ${BUN_IMAGE} AS bun-runtime

FROM ${profile.nodeImage} AS builder
COPY --from=bun-runtime /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --linker=hoisted
COPY . .
RUN bun run --bun build

FROM ${profile.nodeImage} AS production
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=${profile.port}
EXPOSE ${profile.port}
USER nextjs
HEALTHCHECK NONE
CMD ["node", "server.js"]
`;
    return [{ destination: 'Dockerfile', content }];
  }

  const prismaCopy = profile.hasPrisma ? 'COPY prisma ./prisma\n' : '';
  const prismaGenerate = profile.hasPrisma
    ? `RUN ${profile.packageManager === 'bun' ? 'bun ./node_modules/prisma/build/index.js' : 'npx prisma'} generate\n`
    : '';
  const prismaProductionCopy = profile.hasPrisma
    ? 'COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma\n'
    : '';
  const healthcheck =
    profile.probePath === undefined
      ? 'HEALTHCHECK NONE\n'
      : `HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\\n  CMD wget --no-verbose --tries=1 --spider http://localhost:${profile.port}${profile.probePath} || exit 1\n`;
  const bunStages =
    profile.packageManager === 'bun'
      ? `FROM ${BUN_IMAGE} AS bun-runtime

# Production dependencies are installed inside the container with portable paths.
FROM ${profile.nodeImage} AS production-dependencies
COPY --from=bun-runtime /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --linker=hoisted

`
      : '';
  const install =
    profile.packageManager === 'bun'
      ? `COPY --from=bun-runtime /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --linker=hoisted`
      : 'COPY package*.json ./\nRUN npm ci';
  const content = `${bunStages}# Stage 1: Build
FROM ${profile.nodeImage} AS builder
WORKDIR /app
${install}
COPY tsconfig*.json ./
${profile.hasNestConfig ? 'COPY nest-cli.json ./\n' : ''}COPY src ./src
${prismaCopy}${prismaGenerate}RUN ${profile.packageManager === 'bun' ? 'bun run --bun' : 'npm run'} build
${profile.packageManager === 'npm' ? 'RUN npm prune --production\n' : ''}
# Stage 2: Production (Node runtime remains unchanged)
FROM ${profile.nodeImage} AS production
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && \\\n    adduser -S nestjs -u 1001
COPY --from=${profile.packageManager === 'bun' ? 'production-dependencies' : 'builder'} --chown=nestjs:nodejs /app/node_modules ./node_modules
${profile.hasPrisma && profile.packageManager === 'bun' ? 'COPY --from=builder --chown=nestjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma\n' : ''}COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
${prismaProductionCopy}ENV NODE_ENV=production
ENV PORT=${profile.port}
EXPOSE ${profile.port}
USER nestjs
${healthcheck}CMD ["node", "dist/main"]
`;

  return [{ destination: 'Dockerfile', content }];
}

async function generateDockerCompose(
  basePath: string,
  profile: DeploymentProfile,
): Promise<DeploymentFile[]> {
  const composePath = path.join(basePath, 'docker-compose.yml');

  if (await fileExists(composePath)) {
    console.log(chalk.yellow('  docker-compose.yml already exists. Skipping...'));
    return [];
  }

  const content = `version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${profile.serviceName}
    restart: unless-stopped
    ports:
      - "\${PORT:-${profile.port}}:${profile.port}"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=\${DATABASE_URL}
      - JWT_SECRET=\${JWT_SECRET}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    networks:
      - app-network
${
  profile.probePath === undefined
    ? '    healthcheck:\n      disable: true'
    : `    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:${profile.port}${profile.probePath}"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s`
}

  postgres:
    image: postgres:15-alpine
    container_name: postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=\${DB_USER:-postgres}
      - POSTGRES_PASSWORD=\${DB_PASSWORD:-postgres}
      - POSTGRES_DB=\${DB_NAME:-nestjs_db}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "\${DB_PORT:-5432}:5432"
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "\${REDIS_PORT:-6379}:6379"
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Optional: pgAdmin for database management
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: pgadmin
    restart: unless-stopped
    environment:
      - PGADMIN_DEFAULT_EMAIL=\${PGADMIN_EMAIL:-admin@admin.com}
      - PGADMIN_DEFAULT_PASSWORD=\${PGADMIN_PASSWORD:-admin}
    ports:
      - "\${PGADMIN_PORT:-5050}:80"
    depends_on:
      - postgres
    networks:
      - app-network
    profiles:
      - tools

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
`;

  return [{ destination: 'docker-compose.yml', content }];
}

async function generateCIPipeline(
  basePath: string,
  ciType: 'github' | 'gitlab',
  profile: DeploymentProfile,
): Promise<DeploymentFile[]> {
  if (ciType === 'github') {
    return generateGitHubActions(basePath, profile);
  } else {
    return generateGitLabCI(basePath, profile);
  }
}

async function generateGitHubActions(
  _basePath: string,
  profile: DeploymentProfile,
): Promise<DeploymentFile[]> {
  // CI Pipeline
  let ciContent = `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run typecheck

      - name: Run tests
        run: npm test -- --coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: false

  build:
    needs: test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
`;

  if (profile.visibility === 'private') {
    ciContent = `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

permissions:
  contents: read

jobs:
  source:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${
  profile.packageManager === 'bun'
    ? `      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.4.0"
`
    : `      - uses: actions/setup-node@v4
        with:
          node-version: "${profile.nodeImage.slice(5, 7)}"
          cache: npm
`
}      - name: Install locked dependencies
        run: ${profile.packageManager === 'bun' ? 'bun install --frozen-lockfile --linker=hoisted' : 'npm ci'}
      - name: Lint
        run: ${profile.packageManager === 'bun' ? 'bun run --bun' : 'npm run'} lint
      - name: Typecheck
        run: ${profile.packageManager === 'bun' ? 'bun run --bun' : 'npm run'} typecheck
      - name: Test source
        run: ${sourceTestCommand(profile)}
      - name: Build
        run: ${profile.packageManager === 'bun' ? 'bun run --bun' : 'npm run'} build
# Native database/restore/provider proof is separate from this source gate.
`;
  } else if (profile.packageManager === 'bun') {
    ciContent = ciContent
      .replace(
        /      - name: Setup Node.js[\s\S]*?cache: "npm"/g,
        `      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.4.0"`,
      )
      .replace(/npm ci/g, 'bun install --frozen-lockfile --linker=hoisted')
      .replace(/npm run/g, 'bun run --bun')
      .replace(
        'npm test -- --coverage',
        `bun run --bun test --coverage --testEnvironmentOptions='{"globalsCleanup":"off"}'`,
      );
  }

  ciContent = ciContent.replace(
    /node-version: "20"/g,
    `node-version: "${profile.nodeImage.slice(5, 7)}"`,
  );

  // CD Pipeline
  let cdContent = `name: CD

on:
  push:
    branches: [main]
    tags:
      - "v*"

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
`;

  if (profile.state === 'held') {
    cdContent = `name: Held image build

on:
  workflow_dispatch:
    inputs:
      publish:
        description: Publish reviewed image (does not activate a workload)
        type: boolean
        default: false
        required: true

jobs:
  image:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - name: Registry login for explicit publish only
        if: inputs.publish == true
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - name: Normalize repository image name
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/\${{ github.repository }}
          flavor: latest=false
          tags: type=raw,value=sha-\${{ github.sha }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: \${{ inputs.publish == true }}
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
# No deploy, migrations, cluster credentials or automatic publish.
`;
  }

  return [
    { destination: '.github/workflows/ci.yml', content: ciContent },
    { destination: '.github/workflows/cd.yml', content: cdContent },
  ];
}

async function generateGitLabCI(
  basePath: string,
  profile: DeploymentProfile,
): Promise<DeploymentFile[]> {
  const gitlabCIPath = path.join(basePath, '.gitlab-ci.yml');

  if (profile.visibility === 'public' && (await fileExists(gitlabCIPath))) {
    console.log(chalk.yellow('  .gitlab-ci.yml already exists. Skipping...'));
    return [];
  }

  let content = `stages:
  - test
  - build
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: ""

.node_template: &node_template
  image: node:20-alpine
  cache:
    key: \${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/

test:
  <<: *node_template
  stage: test
  services:
    - postgres:15-alpine
    - redis:7-alpine
  variables:
    POSTGRES_DB: test_db
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/test_db
    REDIS_URL: redis://redis:6379
    JWT_SECRET: test-secret
  script:
    - npm ci
    - npm run lint
    - npm run typecheck
    - npm test -- --coverage
  coverage: /All files[^|]*\\|[^|]*\\s+([\\d\\.]+)/
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  <<: *node_template
  stage: build
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week
  only:
    - main
    - develop

docker:
  stage: build
  image: docker:24-dind
  services:
    - docker:24-dind
  before_script:
    - docker login -u \$CI_REGISTRY_USER -p \$CI_REGISTRY_PASSWORD \$CI_REGISTRY
  script:
    - docker build -t \$CI_REGISTRY_IMAGE:\$CI_COMMIT_SHA .
    - docker push \$CI_REGISTRY_IMAGE:\$CI_COMMIT_SHA
    - |
      if [ "\$CI_COMMIT_BRANCH" == "main" ]; then
        docker tag \$CI_REGISTRY_IMAGE:\$CI_COMMIT_SHA \$CI_REGISTRY_IMAGE:latest
        docker push \$CI_REGISTRY_IMAGE:latest
      fi
  only:
    - main
    - tags
`;

  if (profile.visibility === 'private') {
    content = `stages: [test, build]

source:
  image: ${profile.packageManager === 'bun' ? BUN_IMAGE : profile.nodeImage}
  stage: test
  script:
    - ${profile.packageManager === 'bun' ? 'bun install --frozen-lockfile --linker=hoisted' : 'npm ci'}
    - ${profile.packageManager === 'bun' ? 'bun run --bun' : 'npm run'} lint
    - ${profile.packageManager === 'bun' ? 'bun run --bun' : 'npm run'} typecheck
    - ${sourceTestCommand(profile)}
    - ${profile.packageManager === 'bun' ? 'bun run --bun' : 'npm run'} build
`;
  } else if (profile.packageManager === 'bun') {
    content = content
      .replace('image: node:20-alpine', `image: ${BUN_IMAGE}`)
      .replace(/npm ci/g, 'bun install --frozen-lockfile --linker=hoisted')
      .replace(/npm run/g, 'bun run --bun')
      .replace(
        'npm test -- --coverage',
        `bun run --bun test --coverage --testEnvironmentOptions='{"globalsCleanup":"off"}'`,
      );
  }
  content = content.replace('image: node:20-alpine', `image: ${profile.nodeImage}`);
  if (profile.state === 'held') {
    const heldDocker = `variables:
  PUBLISH_IMAGE: "false"

docker:
  stage: build
  image: docker:24-dind
  services: [docker:24-dind]
  when: manual
  script:
    - docker build -t \$CI_REGISTRY_IMAGE:\$CI_COMMIT_SHA .
    - |
      if [ "\$PUBLISH_IMAGE" = "true" ]; then
        printf '%s' "\$CI_REGISTRY_PASSWORD" | docker login --username "\$CI_REGISTRY_USER" --password-stdin "\$CI_REGISTRY"
        docker push "\$CI_REGISTRY_IMAGE:\$CI_COMMIT_SHA"
      fi
# Manual image build only; no workload activation or migrations.
`;
    const dockerStart = content.indexOf('\ndocker:');
    content = (dockerStart >= 0 ? content.slice(0, dockerStart) : content) + '\n' + heldDocker;
  }

  return [{ destination: '.gitlab-ci.yml', content }];
}

async function generateKubernetesManifests(
  _basePath: string,
  profile: DeploymentProfile,
): Promise<DeploymentFile[]> {
  // Deployment
  const deploymentContent = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${profile.serviceName}
  labels:
    app: ${profile.serviceName}
spec:
  replicas: ${profile.state === 'held' ? 0 : 3}
  selector:
    matchLabels:
      app: ${profile.serviceName}
  template:
    metadata:
      labels:
        app: ${profile.serviceName}
    spec:
      containers:
        - name: ${profile.serviceName}
          image: your-registry/${profile.serviceName}:latest
          ports:
            - containerPort: ${profile.port}
          envFrom:
            - configMapRef:
                name: ${profile.serviceName}-config
            - secretRef:
                name: ${profile.serviceName}-secrets
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
${
  profile.probePath === undefined
    ? ''
    : `          livenessProbe:
            httpGet:
              path: ${profile.probePath}
              port: ${profile.port}
            initialDelaySeconds: 30
            periodSeconds: 10
${
  profile.probeMode === 'live-only'
    ? ''
    : `          readinessProbe:
            httpGet:
              path: ${profile.probePath}
              port: ${profile.port}
            initialDelaySeconds: 5
            periodSeconds: 5`
}`
}
`;

  // Service
  const serviceContent = `apiVersion: v1
kind: Service
metadata:
  name: ${profile.serviceName}
spec:
  selector:
    app: ${profile.serviceName}
  ports:
    - protocol: TCP
      port: 80
      targetPort: ${profile.port}
  type: ClusterIP
`;

  // ConfigMap
  const configMapContent = `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${profile.serviceName}-config
data:
  NODE_ENV: "production"
  PORT: "${profile.port}"
`;

  // Ingress
  const ingressContent = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${profile.serviceName}
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - api.example.com
      secretName: ${profile.serviceName}-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${profile.serviceName}
                port:
                  number: 80
`;

  // HPA
  const hpaContent = `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${profile.serviceName}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${profile.serviceName}
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
`;

  return [
    { destination: 'k8s/deployment.yaml', content: deploymentContent.trimEnd() + '\n' },
    { destination: 'k8s/service.yaml', content: serviceContent },
    { destination: 'k8s/configmap.yaml', content: configMapContent },
    ...(profile.visibility === 'public'
      ? [{ destination: 'k8s/ingress.yaml', content: ingressContent }]
      : []),
    ...(profile.state === 'active' ? [{ destination: 'k8s/hpa.yaml', content: hpaContent }] : []),
  ];
}

function sourceTestCommand(profile: DeploymentProfile): string {
  if (profile.application === 'next-standalone') return 'bun run --bun test';
  return profile.packageManager === 'bun'
    ? `bun run --bun test --testEnvironmentOptions='{"globalsCleanup":"off"}'`
    : 'npm test';
}

async function generateDockerIgnore(
  basePath: string,
  profile: DeploymentProfile,
): Promise<DeploymentFile[]> {
  const dockerignorePath = path.join(basePath, '.dockerignore');

  if (await fileExists(dockerignorePath)) {
    console.log(chalk.yellow('  .dockerignore already exists. Skipping...'));
    return [];
  }

  const content = `# Dependencies
node_modules
npm-debug.log

# Build outputs
dist

# Environment files
.env
.env.*
!.env.example

# IDE
.idea
.vscode
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage
.nyc_output

# Docker
Dockerfile*
docker-compose*
.docker

# Git
.git
.gitignore

# Documentation
*.md
docs

# Misc
*.log
tmp
temp
`;

  return [
    {
      destination: '.dockerignore',
      content:
        content +
        (profile.application === 'next-standalone'
          ? '\n# Next standalone build\n.next\n.eshe\n.github\nk8s\n'
          : ''),
    },
  ];
}

async function generateEnvExample(
  basePath: string,
  profile: DeploymentProfile,
): Promise<DeploymentFile[]> {
  const envExamplePath = path.join(basePath, '.env.example');

  if (await fileExists(envExamplePath)) {
    console.log(chalk.yellow('  .env.example already exists. Skipping...'));
    return [];
  }

  const content =
    profile.visibility === 'private'
      ? `# Source scaffold only; configure private application policy separately.
NODE_ENV=production
PORT=${profile.port}
`
      : `# Application
NODE_ENV=development
PORT=3000
API_PREFIX=api
API_VERSION=v1

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nestjs_db
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=nestjs_db

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# File Upload
STORAGE_TYPE=local
UPLOAD_DIR=./uploads
UPLOAD_BASE_URL=http://localhost:3000/uploads
MAX_FILE_SIZE=10485760

# AWS (if using S3)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@example.com

# Logging
LOG_LEVEL=debug

# Docker (for docker-compose)
PGADMIN_EMAIL=admin@admin.com
PGADMIN_PASSWORD=admin
PGADMIN_PORT=5050
`;

  return [{ destination: '.env.example', content }];
}
