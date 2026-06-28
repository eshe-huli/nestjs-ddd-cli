import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../../utils/file.utils';

export async function applyPlatformServiceRuntimeRecipe(basePath: string): Promise<void> {
  const sharedPath = path.join(basePath, 'src/shared');
  const runtimePath = path.join(sharedPath, 'platform-service-runtime');

  await ensureDir(runtimePath);

  await writeFile(path.join(runtimePath, 'platform-service.types.ts'), typesContent);
  await writeFile(path.join(runtimePath, 'platform-service.manifest.ts'), manifestContent);
  await writeFile(path.join(runtimePath, 'platform-service.module.ts'), moduleContent);
  await writeFile(path.join(runtimePath, 'index.ts'), indexContent);

  console.log(chalk.green('  ✓ Platform service manifest and capability contract'));
  console.log(chalk.green('  ✓ Explicit action/event/dependency declarations'));
  console.log(
    chalk.yellow('  Register this manifest with Service Access Platform during bootstrap.'),
  );
}

const typesContent = `export type PlatformRuntimeKind = "nestjs" | "go-sidecar" | "laravel" | "rust" | "external";

export type PlatformServiceCriticality = "system" | "money" | "identity" | "compliance" | "ops" | "product";

export interface PlatformServiceEndpoint {
  name: string;
  urlEnv: string;
  healthPath?: string;
  docsPath?: string;
  internalOnly?: boolean;
}

export interface PlatformServiceAction {
  name: string;
  description: string;
  owner: string;
  requestContract?: string;
  responseContract?: string;
  idempotencyRequired?: boolean;
  authRequired?: boolean;
  timeoutMs?: number;
}

export interface PlatformServiceEvent {
  name: string;
  description: string;
  schema?: string;
  mandatoryForSubscribers?: boolean;
  durable?: boolean;
}

export interface PlatformServiceDependency {
  service: string;
  reason: string;
  required: boolean;
  accessGrant?: string;
  timeoutMs?: number;
}

export interface PlatformServiceManifest {
  serviceName: string;
  companyName?: string;
  productGroup: string;
  runtime: PlatformRuntimeKind;
  criticality: PlatformServiceCriticality;
  ownerTeam?: string;
  capabilities: string[];
  endpoints: PlatformServiceEndpoint[];
  actions: PlatformServiceAction[];
  eventsProduced: PlatformServiceEvent[];
  eventsConsumed: PlatformServiceEvent[];
  dependencies: PlatformServiceDependency[];
  requiredEnv: string[];
  optionalEnv?: string[];
  health: {
    livePath: string;
    readyPath: string;
    metricsPath?: string;
  };
}
`;

const manifestContent = `import { PlatformServiceManifest } from "./platform-service.types";

export const platformServiceManifest: PlatformServiceManifest = {
  serviceName: process.env.APP_NAME ?? "replace-me-service",
  productGroup: "platform-core",
  runtime: "nestjs",
  criticality: "product",
  capabilities: [],
  endpoints: [
    {
      name: "api",
      urlEnv: "PUBLIC_API_URL",
      healthPath: "/api/v1/health",
      docsPath: "/api/v1/docs",
    },
  ],
  actions: [],
  eventsProduced: [],
  eventsConsumed: [],
  dependencies: [],
  requiredEnv: ["NODE_ENV", "DATABASE_URL", "INTERNAL_API_KEY"],
  optionalEnv: ["SERVICE_ACCESS_URL", "LOG_LEVEL", "CORS_ORIGINS"],
  health: {
    livePath: "/api/v1/health/live",
    readyPath: "/api/v1/health/ready",
    metricsPath: "/metrics",
  },
};
`;

const moduleContent = `import { Global, Module } from "@nestjs/common";
import { platformServiceManifest } from "./platform-service.manifest";

export const PLATFORM_SERVICE_MANIFEST = Symbol("PLATFORM_SERVICE_MANIFEST");

@Global()
@Module({
  providers: [
    {
      provide: PLATFORM_SERVICE_MANIFEST,
      useValue: platformServiceManifest,
    },
  ],
  exports: [PLATFORM_SERVICE_MANIFEST],
})
export class PlatformServiceRuntimeModule {}
`;

const indexContent = `export * from "./platform-service.types";
export * from "./platform-service.manifest";
export * from "./platform-service.module";
`;
