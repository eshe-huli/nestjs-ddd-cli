import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { checkDependency, resolveNestProjectPath } from '../../src/commands/doctor';
import { runEnhancedDoctor } from '../../src/commands/doctor-enhanced';
import { resetConfigCache } from '../../src/utils/config.utils';

describe('Doctor dependency checks', () => {
  it('reads package.json relative to a relative project path', async () => {
    const projectPath = path.join('tests', '.doctor-project');
    await fs.ensureDir(projectPath);
    await fs.writeJson(path.join(projectPath, 'package.json'), {
      dependencies: { '@nestjs/core': '^11.0.0' },
    });

    try {
      await expect(checkDependency(projectPath, '@nestjs/core', 'NestJS Core')).resolves.toEqual({
        name: 'NestJS Core',
        status: 'pass',
        message: 'Installed (^11.0.0)',
      });
    } finally {
      await fs.remove(projectPath);
    }
  });
});

describe('Doctor monorepo target resolution', () => {
  it('discovers a single NestJS app under apps', async () => {
    const projectPath = path.join('tests', '.doctor-monorepo');
    const appPath = path.join(projectPath, 'apps', 'accounting-api');
    await fs.ensureDir(path.join(appPath, 'src'));
    await fs.writeFile(path.join(appPath, 'src', 'main.ts'), '');

    try {
      await expect(resolveNestProjectPath(projectPath)).resolves.toBe(path.resolve(appPath));
    } finally {
      await fs.remove(projectPath);
    }
  });

  it('honors an explicit app name when a monorepo has several apps', async () => {
    const projectPath = path.join('tests', '.doctor-many-apps');
    for (const app of ['accounting-api', 'identity-api']) {
      const appPath = path.join(projectPath, 'apps', app, 'src');
      await fs.ensureDir(appPath);
      await fs.writeFile(path.join(appPath, 'main.ts'), '');
    }

    try {
      await expect(resolveNestProjectPath(projectPath, 'accounting-api')).resolves.toBe(
        path.resolve(projectPath, 'apps', 'accounting-api'),
      );
    } finally {
      await fs.remove(projectPath);
    }
  });
});

describe('Enhanced doctor project layout resolution', () => {
  const testRoot = path.join(__dirname, '../.doctor-enhanced-output');

  beforeEach(async () => {
    resetConfigCache();
    await fs.emptyDir(testRoot);
  });

  afterEach(async () => {
    resetConfigCache();
    await fs.remove(testRoot);
  });

  it('uses the selected monorepo app and its configured source paths', async () => {
    const monorepoPath = path.join(testRoot, 'monorepo');
    const appPath = path.join(monorepoPath, 'apps', 'accounting-api');
    await createEnhancedDoctorFixture(appPath, {
      modulesPath: 'src/bounded-contexts',
      sharedPath: 'src/kernel',
      domainLayout: 'application/domain',
    });

    const report = await runEnhancedDoctor(monorepoPath, {
      app: 'apps/accounting-api',
    });

    expect(report.errors).toBe(0);
    expect(report.results).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'required-directory' }),
        expect.objectContaining({ rule: 'missing-domain-layer' }),
        expect.objectContaining({ rule: 'tsconfig-exists' }),
      ]),
    );
  });

  it.each([
    ['CLI-generated', 'application/domain'],
    ['classic', 'domain'],
  ] as const)('accepts the %s module layout', async (_name, domainLayout) => {
    const projectPath = path.join(testRoot, domainLayout.replace('/', '-'));
    await createEnhancedDoctorFixture(projectPath, { domainLayout });

    const report = await runEnhancedDoctor(projectPath);

    expect(report.results).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'missing-domain-layer' })]),
    );
  });

  it('still reports a module with no supported domain layer', async () => {
    const projectPath = path.join(testRoot, 'missing-domain');
    await createEnhancedDoctorFixture(projectPath, { domainLayout: null });

    const report = await runEnhancedDoctor(projectPath);

    expect(report.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: 'missing-domain-layer',
          message: 'Module "billing" missing domain layer',
        }),
      ]),
    );
  });

  it('applies domain diagnostics to the CLI-generated layout', async () => {
    const projectPath = path.join(testRoot, 'generated-domain-diagnostic');
    await createEnhancedDoctorFixture(projectPath, {
      domainLayout: 'application/domain',
    });
    await fs.writeFile(
      path.join(projectPath, 'src/modules/billing/application/domain/entities/invoice.entity.ts'),
      'import { Entity } from "typeorm";\nexport class InvoiceEntity {}\n',
    );

    const report = await runEnhancedDoctor(projectPath);

    expect(report.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'domain-purity' })]),
    );
  });
});

interface EnhancedDoctorFixtureOptions {
  modulesPath?: string;
  sharedPath?: string;
  domainLayout: 'application/domain' | 'domain' | null;
}

async function createEnhancedDoctorFixture(
  projectPath: string,
  options: EnhancedDoctorFixtureOptions,
): Promise<void> {
  const modulesPath = options.modulesPath ?? 'src/modules';
  const sharedPath = options.sharedPath ?? 'src/shared';
  const modulePath = path.resolve(projectPath, modulesPath, 'billing');

  await fs.ensureDir(path.join(modulePath, 'application'));
  await fs.ensureDir(path.join(modulePath, 'infrastructure'));
  await fs.ensureDir(path.resolve(projectPath, sharedPath));
  await fs.outputFile(path.join(projectPath, 'src/main.ts'), '');
  if (options.domainLayout) {
    await fs.ensureDir(path.join(modulePath, options.domainLayout, 'entities'));
  }

  await fs.writeJson(path.join(projectPath, 'tsconfig.json'), {
    compilerOptions: {
      strict: true,
      noImplicitAny: true,
      strictNullChecks: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
    },
  });
  await fs.writeJson(path.join(projectPath, '.dddrc.json'), {
    paths: {
      modules: modulesPath,
      shared: sharedPath,
    },
  });
}
