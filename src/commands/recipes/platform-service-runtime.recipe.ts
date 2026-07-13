import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, fileExists, writeFile } from '../../utils/file.utils';
import { applyPlatformContextRecipe } from './platform-context.recipe';

export async function applyPlatformServiceRuntimeRecipe(basePath: string): Promise<void> {
  const runtimePath = path.join(basePath, 'src/shared/platform-service-runtime');
  const docsPath = path.join(basePath, 'docs/platform');

  await applyPlatformContextRecipe(basePath);
  await ensureDir(runtimePath);
  await ensureDir(docsPath);

  await writeFile(path.join(runtimePath, 'platform-service.types.ts'), typesContent);
  await writeFile(path.join(runtimePath, 'platform-service.manifest.ts'), manifestContent);
  await writeFile(path.join(runtimePath, 'platform-manifest.guard.ts'), manifestGuardContent);
  await writeFile(
    path.join(runtimePath, 'platform-service-manifest.controller.ts'),
    manifestControllerContent,
  );
  await writeFile(
    path.join(runtimePath, 'platform-service-registration.client.ts'),
    registrationClientContent,
  );
  await writeFile(path.join(runtimePath, 'platform-service.module.ts'), moduleContent);
  await writeFile(path.join(runtimePath, 'index.ts'), indexContent);
  await writeFile(path.join(docsPath, 'platform-service-runtime.md'), docsContent);

  const envExamplePath = path.join(basePath, '.env.example');
  const fallbackExamplePath = path.join(basePath, '.env.platform-service-runtime.example');
  const targetExamplePath = (await fileExists(envExamplePath))
    ? fallbackExamplePath
    : envExamplePath;
  await writeFile(targetExamplePath, envExampleContent);

  console.log(chalk.green('  ✓ Platform service manifest and capability contract'));
  console.log(chalk.green('  ✓ Authenticated Service Access catalog registration'));
  console.log(chalk.green('  ✓ Private manifest endpoint and runtime heartbeat metadata'));
  console.log(
    chalk.yellow(
      '  Provision a per-service Service Access key and set PLATFORM_REGISTRATION_REQUIRED=true in shared environments.',
    ),
  );
}

const typesContent = `export type PlatformRuntimeKind = "nestjs" | "go-sidecar" | "laravel" | "rust" | "external";

export const PLATFORM_SERVICE_MANIFEST = Symbol("PLATFORM_SERVICE_MANIFEST");

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
  serviceSlug: string;
  displayName: string;
  description?: string;
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

export type PlatformRegistrationStatus = "registered" | "skipped" | "failed";

export interface PlatformRegistrationResult {
  status: PlatformRegistrationStatus;
  serviceId?: string;
  reason?: string;
  correlationId: string;
}
`;

const manifestContent = `import { PlatformServiceManifest } from "./platform-service.types";

export const platformServiceManifest: PlatformServiceManifest = {
  serviceName: process.env.APP_NAME ?? "replace-me-service",
  serviceSlug: process.env.APP_SERVICE_SLUG ?? "replace-me-service",
  displayName: process.env.APP_DISPLAY_NAME ?? "Replace Me Service",
  description: process.env.APP_DESCRIPTION,
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

const manifestGuardContent = `import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeEqual } from "crypto";

@Injectable()
export class PlatformManifestGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const expected = process.env.PLATFORM_MANIFEST_READ_TOKEN;
    const presented = request.headers.authorization;
    const token = typeof presented === "string" && presented.startsWith("Bearer ")
      ? presented.slice(7)
      : undefined;

    if (!expected || !token || !this.matches(token, expected)) {
      throw new UnauthorizedException("Platform manifest authentication required");
    }
    return true;
  }

  private matches(presented: string, expected: string): boolean {
    const left = Buffer.from(presented);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
`;

const manifestControllerContent = `import { Controller, Get, UseGuards } from "@nestjs/common";
import { platformServiceManifest } from "./platform-service.manifest";
import { PlatformManifestGuard } from "./platform-manifest.guard";

@Controller("internal/platform")
@UseGuards(PlatformManifestGuard)
export class PlatformServiceManifestController {
  @Get("manifest")
  manifest() {
    return platformServiceManifest;
  }
}
`;

const registrationClientContent = `import { randomUUID } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PlatformContextService } from "../platform-context";
import {
  PLATFORM_SERVICE_MANIFEST,
  PlatformRegistrationResult,
  PlatformServiceManifest,
} from "./platform-service.types";

type RegistrationPhase = "registration" | "heartbeat";

@Injectable()
export class PlatformServiceRegistrationClient {
  constructor(
    @Inject(PLATFORM_SERVICE_MANIFEST)
    private readonly manifest: PlatformServiceManifest,
    private readonly context: PlatformContextService,
  ) {}

  register(): Promise<PlatformRegistrationResult> {
    return this.sync("registration");
  }

  heartbeat(): Promise<PlatformRegistrationResult> {
    return this.sync("heartbeat");
  }

  private async sync(phase: RegistrationPhase): Promise<PlatformRegistrationResult> {
    const correlationId = this.context.current()?.correlationId || randomUUID();
    const required = this.booleanEnv("PLATFORM_REGISTRATION_REQUIRED", false);
    const baseUrl = this.clean(process.env.SERVICE_ACCESS_URL)?.replace(/\\/+$/, "");
    const apiKey = this.clean(process.env.SERVICE_ACCESS_INTERNAL_API_KEY);
    const revision = this.clean(process.env.APP_REVISION || process.env.CI_COMMIT_SHA);

    if (!baseUrl || !apiKey || !revision) {
      return this.unavailable(
        required,
        correlationId,
        "SERVICE_ACCESS_URL, SERVICE_ACCESS_INTERNAL_API_KEY, and APP_REVISION or CI_COMMIT_SHA are required",
      );
    }

    this.assertSlug(this.manifest.serviceSlug);
    const now = new Date();
    const idempotencyKey = this.idempotencyKey(phase, revision, now);
    const timeoutMs = this.integerEnv("SERVICE_ACCESS_TIMEOUT_MS", 3000);

    try {
      const response = await fetch(baseUrl + "/registered-services/upsert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-internal-api-key": apiKey,
          "Idempotency-Key": idempotencyKey,
          "X-Correlation-ID": correlationId,
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          slug: this.manifest.serviceSlug,
          display_name: this.manifest.displayName,
          owner_type: "platform",
          status: "active",
          description: this.manifest.description,
          metadata: {
            manifest: this.manifest,
            runtime: {
              phase,
              revision,
              image: this.clean(process.env.APP_IMAGE),
              environment: this.clean(process.env.NODE_ENV),
              health: this.manifest.health,
              heartbeatAt: now.toISOString(),
            },
            correlationId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Service Access registration failed with HTTP " + response.status);
      }

      const body = (await response.json()) as { id?: unknown };
      return {
        status: "registered",
        serviceId: typeof body.id === "string" ? body.id : undefined,
        correlationId,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Service Access registration failed";
      if (required) {
        throw new Error(reason);
      }
      return { status: "failed", reason, correlationId };
    }
  }

  private unavailable(
    required: boolean,
    correlationId: string,
    reason: string,
  ): PlatformRegistrationResult {
    if (required) {
      throw new Error(reason);
    }
    return { status: "skipped", reason, correlationId };
  }

  private idempotencyKey(phase: RegistrationPhase, revision: string, now: Date): string {
    const suffix = phase === "heartbeat" ? ":" + now.toISOString().slice(0, 16) : "";
    return "platform-runtime:" + this.manifest.serviceSlug + ":" + revision + suffix;
  }

  private assertSlug(value: string): void {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/.test(value)) {
      throw new Error("Platform service slug must be lowercase kebab-case");
    }
  }

  private booleanEnv(name: string, fallback: boolean): boolean {
    const value = this.clean(process.env[name]);
    return value ? value.toLowerCase() === "true" : fallback;
  }

  private integerEnv(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private clean(value: string | undefined): string | undefined {
    const cleaned = value?.trim();
    return cleaned || undefined;
  }
}
`;

const moduleContent = `import { Global, Module } from "@nestjs/common";
import { PlatformContextModule } from "../platform-context";
import { platformServiceManifest } from "./platform-service.manifest";
import { PlatformManifestGuard } from "./platform-manifest.guard";
import { PlatformServiceManifestController } from "./platform-service-manifest.controller";
import { PlatformServiceRegistrationClient } from "./platform-service-registration.client";
import { PLATFORM_SERVICE_MANIFEST } from "./platform-service.types";

@Global()
@Module({
  imports: [PlatformContextModule],
  controllers: [PlatformServiceManifestController],
  providers: [
    PlatformManifestGuard,
    PlatformServiceRegistrationClient,
    {
      provide: PLATFORM_SERVICE_MANIFEST,
      useValue: platformServiceManifest,
    },
  ],
  exports: [PLATFORM_SERVICE_MANIFEST, PlatformServiceRegistrationClient],
})
export class PlatformServiceRuntimeModule {}
`;

const indexContent = `export * from "./platform-service.types";
export * from "./platform-service.manifest";
export * from "./platform-manifest.guard";
export * from "./platform-service-manifest.controller";
export * from "./platform-service-registration.client";
export * from "./platform-service.module";
`;

const envExampleContent = `APP_SERVICE_SLUG=replace-me-service
APP_DISPLAY_NAME=Replace Me Service
APP_REVISION=local
APP_IMAGE=
SERVICE_ACCESS_URL=
SERVICE_ACCESS_INTERNAL_API_KEY=
SERVICE_ACCESS_TIMEOUT_MS=3000
PLATFORM_REGISTRATION_REQUIRED=false
PLATFORM_MANIFEST_READ_TOKEN=
`;

const docsContent = `# Platform Service Runtime

The service manifest declares metadata and capabilities. Service Access remains
the catalog and grant authority; this recipe does not create a second registry.

Call \`PlatformServiceRegistrationClient.register()\` during application
bootstrap and \`heartbeat()\` from a bounded scheduled job. Both operations
upsert the service through Service Access and carry runtime revision, image,
health, correlation, and idempotency metadata. A skipped or failed result is not
a successful registration.

Set \`PLATFORM_REGISTRATION_REQUIRED=true\` in shared staging and production
after the per-service key is provisioned. Keep the manifest endpoint private and
protect it with a dedicated read token. Never expose internal endpoints through
the public gateway.
`;
