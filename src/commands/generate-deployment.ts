import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile, fileExists } from '../utils/file.utils';

export interface DeploymentOptions {
  path?: string;
  docker?: boolean;
  compose?: boolean;
  ci?: 'github' | 'gitlab' | 'none';
  kubernetes?: boolean;
}

export async function generateDeployment(options: DeploymentOptions) {
  console.log(chalk.blue('\n🚀 Generating deployment configurations...\n'));

  const basePath = options.path || process.cwd();

  // Generate Dockerfile
  if (options.docker !== false) {
    await generateDockerfile(basePath);
  }

  // Generate docker-compose
  if (options.compose !== false) {
    await generateDockerCompose(basePath);
  }

  // Generate CI/CD pipeline
  if (options.ci && options.ci !== 'none') {
    await generateCIPipeline(basePath, options.ci);
  }

  // Generate Kubernetes manifests
  if (options.kubernetes) {
    await generateKubernetesManifests(basePath);
  }

  // Generate .dockerignore
  await generateDockerIgnore(basePath);

  // Generate .env.example
  await generateEnvExample(basePath);

  console.log(chalk.green('\n✅ Deployment configurations generated successfully!'));
  console.log(chalk.yellow('\n📋 Next steps:'));
  console.log('   1. Review and customize the generated files');
  console.log('   2. Update environment variables in .env');
  console.log(`   3. Build: ${chalk.cyan('docker build -t my-app .')}`);
  console.log(`   4. Run: ${chalk.cyan('docker-compose up -d')}`);
}

async function generateDockerfile(basePath: string) {
  const dockerfilePath = path.join(basePath, 'Dockerfile');

  if (await fileExists(dockerfilePath)) {
    console.log(chalk.yellow('  Dockerfile already exists. Skipping...'));
    return;
  }

  const content = `# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY prisma ./prisma 2>/dev/null || true

# Generate Prisma client if prisma folder exists
RUN if [ -d "prisma" ]; then npx prisma generate; fi

# Build the application
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nestjs -u 1001

# Copy built assets from builder
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

# Copy Prisma files if they exist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma 2>/dev/null || true

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/main"]
`;

  await writeFile(dockerfilePath, content);
  console.log(chalk.green('  ✓ Dockerfile'));
}

async function generateDockerCompose(basePath: string) {
  const composePath = path.join(basePath, 'docker-compose.yml');

  if (await fileExists(composePath)) {
    console.log(chalk.yellow('  docker-compose.yml already exists. Skipping...'));
    return;
  }

  const content = `version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nestjs-app
    restart: unless-stopped
    ports:
      - "\${PORT:-3000}:3000"
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
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

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

  await writeFile(composePath, content);
  console.log(chalk.green('  ✓ docker-compose.yml'));
}

async function generateCIPipeline(basePath: string, ciType: 'github' | 'gitlab') {
  if (ciType === 'github') {
    await generateGitHubActions(basePath);
  } else if (ciType === 'gitlab') {
    await generateGitLabCI(basePath);
  }
}

async function generateGitHubActions(basePath: string) {
  const workflowsPath = path.join(basePath, '.github/workflows');
  await ensureDir(workflowsPath);

  // CI Pipeline
  const ciContent = `name: CI

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

  await writeFile(path.join(workflowsPath, 'ci.yml'), ciContent);
  console.log(chalk.green('  ✓ .github/workflows/ci.yml'));

  // CD Pipeline
  const cdContent = `name: CD

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

  await writeFile(path.join(workflowsPath, 'cd.yml'), cdContent);
  console.log(chalk.green('  ✓ .github/workflows/cd.yml'));
}

async function generateGitLabCI(basePath: string) {
  const gitlabCIPath = path.join(basePath, '.gitlab-ci.yml');

  if (await fileExists(gitlabCIPath)) {
    console.log(chalk.yellow('  .gitlab-ci.yml already exists. Skipping...'));
    return;
  }

  const content = `stages:
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

  await writeFile(gitlabCIPath, content);
  console.log(chalk.green('  ✓ .gitlab-ci.yml'));
}

async function generateKubernetesManifests(basePath: string) {
  const k8sPath = path.join(basePath, 'k8s');
  await ensureDir(k8sPath);

  // Deployment
  const deploymentContent = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nestjs-app
  labels:
    app: nestjs-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nestjs-app
  template:
    metadata:
      labels:
        app: nestjs-app
    spec:
      containers:
        - name: nestjs-app
          image: your-registry/nestjs-app:latest
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: nestjs-app-config
            - secretRef:
                name: nestjs-app-secrets
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
`;
  await writeFile(path.join(k8sPath, 'deployment.yaml'), deploymentContent);

  // Service
  const serviceContent = `apiVersion: v1
kind: Service
metadata:
  name: nestjs-app
spec:
  selector:
    app: nestjs-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP
`;
  await writeFile(path.join(k8sPath, 'service.yaml'), serviceContent);

  // ConfigMap
  const configMapContent = `apiVersion: v1
kind: ConfigMap
metadata:
  name: nestjs-app-config
data:
  NODE_ENV: "production"
  PORT: "3000"
`;
  await writeFile(path.join(k8sPath, 'configmap.yaml'), configMapContent);

  // Ingress
  const ingressContent = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nestjs-app
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - api.example.com
      secretName: nestjs-app-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nestjs-app
                port:
                  number: 80
`;
  await writeFile(path.join(k8sPath, 'ingress.yaml'), ingressContent);

  // HPA
  const hpaContent = `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nestjs-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nestjs-app
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
  await writeFile(path.join(k8sPath, 'hpa.yaml'), hpaContent);

  console.log(chalk.green('  ✓ k8s/deployment.yaml'));
  console.log(chalk.green('  ✓ k8s/service.yaml'));
  console.log(chalk.green('  ✓ k8s/configmap.yaml'));
  console.log(chalk.green('  ✓ k8s/ingress.yaml'));
  console.log(chalk.green('  ✓ k8s/hpa.yaml'));
}

async function generateDockerIgnore(basePath: string) {
  const dockerignorePath = path.join(basePath, '.dockerignore');

  if (await fileExists(dockerignorePath)) {
    console.log(chalk.yellow('  .dockerignore already exists. Skipping...'));
    return;
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

  await writeFile(dockerignorePath, content);
  console.log(chalk.green('  ✓ .dockerignore'));
}

async function generateEnvExample(basePath: string) {
  const envExamplePath = path.join(basePath, '.env.example');

  if (await fileExists(envExamplePath)) {
    console.log(chalk.yellow('  .env.example already exists. Skipping...'));
    return;
  }

  const content = `# Application
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

  await writeFile(envExamplePath, content);
  console.log(chalk.green('  ✓ .env.example'));
}
