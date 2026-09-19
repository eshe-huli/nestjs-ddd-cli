import * as fs from 'fs-extra';
import * as os from 'node:os';
import * as path from 'node:path';
import { generateMigrationDeployment } from './generate-migration-deployment';

describe('generateMigrationDeployment', () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-migration-deployment-'));
    await fs.writeJson(path.join(projectPath, 'package.json'), { name: 'identity-api' });
  });

  afterEach(async () => {
    await fs.remove(projectPath);
  });

  it('generates an immutable-image PreSync job and TypeORM runner', async () => {
    const digest = 'a'.repeat(64);

    await generateMigrationDeployment({
      path: projectPath,
      image: `registry.example/identity-api@sha256:${digest}`,
      databaseSecret: 'identity-api-secrets',
      configMap: 'identity-api-config',
      imagePullSecret: 'registry-pull',
    });

    const runner = await fs.readFile(path.join(projectPath, 'src/migration-runner.ts'), 'utf8');
    const job = await fs.readFile(path.join(projectPath, 'k8s/migration-job.yaml'), 'utf8');

    expect(runner).toContain("migrations: [path.join(__dirname, 'migrations', '*.{js,ts}')]");
    expect(runner).toContain("runMigrations({ transaction: 'all' })");
    expect(job).toContain('argocd.argoproj.io/hook: PreSync');
    expect(job).toContain(`image: registry.example/identity-api@sha256:${digest}`);
    expect(job).toContain('key: DATABASE_URL');
    expect(job).toContain('name: identity-api-config');
    expect(job).toContain('name: registry-pull');
    expect(job).toContain('dist/migration-runner.js');
    expect(job).not.toContain('ALTER TABLE');
    expect(job).not.toContain('CREATE TABLE');
  });

  it('rejects a mutable image tag', async () => {
    await expect(
      generateMigrationDeployment({
        path: projectPath,
        image: 'registry.example/identity-api:staging',
      }),
    ).rejects.toThrow('must be pinned by sha256 digest');
  });

  it('does not overwrite an existing migration gate', async () => {
    const digest = 'b'.repeat(64);
    const options = {
      path: projectPath,
      image: `registry.example/identity-api@sha256:${digest}`,
    };

    await generateMigrationDeployment(options);

    await expect(generateMigrationDeployment(options)).rejects.toThrow('Refusing to overwrite');
  });

  it('keeps dry-run non-mutating', async () => {
    await generateMigrationDeployment({
      path: projectPath,
      image: `registry.example/identity-api@sha256:${'c'.repeat(64)}`,
      dryRun: true,
    });

    await expect(fs.pathExists(path.join(projectPath, 'src/migration-runner.ts'))).resolves.toBe(
      false,
    );
    await expect(fs.pathExists(path.join(projectPath, 'k8s/migration-job.yaml'))).resolves.toBe(
      false,
    );
    await expect(fs.pathExists(path.join(projectPath, 'src'))).resolves.toBe(false);
    await expect(fs.pathExists(path.join(projectPath, 'k8s'))).resolves.toBe(false);
  });
});
