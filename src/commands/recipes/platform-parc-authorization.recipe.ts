import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, fileExists, writeFile } from '../../utils/file.utils';
import { applyPlatformContextRecipe } from './platform-context.recipe';

export async function applyPlatformParcAuthorizationRecipe(basePath: string): Promise<void> {
  await applyPlatformContextRecipe(basePath);

  const authorizationPath = path.join(
    basePath,
    'src/shared/authorization/platform-parc-authorization',
  );
  const docsPath = path.join(basePath, 'docs/platform');

  await ensureDir(authorizationPath);
  await ensureDir(docsPath);

  await writeFile(path.join(authorizationPath, 'parc-authorization.types.ts'), typesContent);
  await writeFile(
    path.join(authorizationPath, 'require-parc-authorization.decorator.ts'),
    decoratorContent,
  );
  await writeFile(path.join(authorizationPath, 'parc-authorization.client.ts'), clientContent);
  await writeFile(
    path.join(authorizationPath, 'platform-parc-authorization.guard.ts'),
    guardContent,
  );
  await writeFile(
    path.join(authorizationPath, 'platform-parc-authorization.module.ts'),
    moduleContent,
  );
  await writeFile(path.join(authorizationPath, 'index.ts'), indexContent);
  await writeFile(path.join(docsPath, 'platform-parc-authorization.md'), docsContent);

  const envExamplePath = path.join(basePath, '.env.example');
  const fallbackExamplePath = path.join(basePath, '.env.platform-parc-authorization.example');
  const targetExamplePath = (await fileExists(envExamplePath))
    ? fallbackExamplePath
    : envExamplePath;
  await writeFile(targetExamplePath, envExampleContent);

  console.log(chalk.green('  ✓ Platform request context contract'));
  console.log(chalk.green('  ✓ PARC capability decorator and orchestration guard'));
  console.log(chalk.green('  ✓ Fail-closed PARC decision client and audit receipt'));
  console.log(
    chalk.yellow(
      '  PARC authorizes the requested capability; owner services still enforce and transact their business invariants.',
    ),
  );
}

const typesContent = `import { PlatformRequestContext } from "../../platform-context";

export interface ParcAuthorizationTarget {
  service: string;
  capability: string;
  action?: string;
  businessId?: string;
  applicationId?: string;
}

export interface ParcDecisionCheckRequest {
  subjectId: string;
  businessId: string;
  clientAppId: string;
  service: string;
  permission: string;
  action?: string;
}

export interface ParcDecisionResponse {
  allowed: boolean;
  decisionReference: string;
  decisionId?: string;
}

export interface ParcAccessDecisionReceipt extends ParcDecisionResponse {
  authority: "parc";
  allowed: true;
  decidedAt: string;
}

export interface RequestWithParcAuthorization {
  platformContext?: PlatformRequestContext;
  parcAccessDecisionReceipt?: ParcAccessDecisionReceipt;
}
`;

const decoratorContent = `import { SetMetadata } from "@nestjs/common";
import { ParcAuthorizationTarget } from "./parc-authorization.types";

export const PARC_AUTHORIZATION_TARGET = "platform:parc-authorization-target";

export const RequireParcAuthorization = (target: ParcAuthorizationTarget) =>
  SetMetadata(PARC_AUTHORIZATION_TARGET, Object.freeze({ ...target }));
`;

const clientContent = `import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  ParcAccessDecisionReceipt,
  ParcAuthorizationTarget,
  ParcDecisionCheckRequest,
  ParcDecisionResponse,
  RequestWithParcAuthorization,
} from "./parc-authorization.types";

@Injectable()
export class ParcAuthorizationClient {
  async check(
    request: RequestWithParcAuthorization,
    target: ParcAuthorizationTarget,
  ): Promise<ParcAccessDecisionReceipt> {
    const actor = request.platformContext?.actor;
    const authorizationRequest: ParcDecisionCheckRequest = {
      subjectId: this.requiredString(actor?.subjectId),
      businessId: this.requiredString(target.businessId ?? actor?.businessId),
      clientAppId: this.requiredString(target.applicationId ?? actor?.applicationId),
      service: this.requiredString(target.service),
      permission: this.requiredString(target.capability),
      action: this.optionalString(target.action),
    };
    const baseUrl = this.requiredConfig("PARC_URL").replace(/\\/+$/, "");
    const internalApiKey = this.requiredConfig("PARC_INTERNAL_API_KEY");
    const timeoutMs = this.timeoutMs();

    try {
      const response = await fetch(baseUrl + "/v1/decisions/check", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-internal-api-key": internalApiKey,
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify(authorizationRequest),
      });

      if (!response.ok) {
        throw new Error("PARC decision request failed");
      }

      const decision = this.parseDecision(await response.json());
      if (!decision.allowed) {
        throw new Error("PARC denied the requested capability");
      }

      return {
        authority: "parc",
        allowed: true,
        decisionReference: decision.decisionReference,
        ...(decision.decisionId ? { decisionId: decision.decisionId } : {}),
        decidedAt: new Date().toISOString(),
      };
    } catch {
      throw this.denied();
    }
  }

  private parseDecision(payload: unknown): ParcDecisionResponse {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw this.denied();
    }

    const record = payload as Record<string, unknown>;
    if (typeof record.allowed !== "boolean") {
      throw this.denied();
    }

    const decisionReference = this.requiredString(record.decisionReference);
    let decisionId: string | undefined;
    if (record.decisionId !== undefined) {
      decisionId = this.requiredString(record.decisionId);
    }

    return {
      allowed: record.allowed,
      decisionReference,
      ...(decisionId ? { decisionId } : {}),
    };
  }

  private requiredConfig(name: "PARC_URL" | "PARC_INTERNAL_API_KEY"): string {
    return this.requiredString(process.env[name]);
  }

  private timeoutMs(): number {
    const configured = this.optionalString(process.env.PARC_TIMEOUT_MS);
    if (!configured) {
      return 3000;
    }

    const timeoutMs = Number(configured);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw this.denied();
    }
    return timeoutMs;
  }

  private requiredString(value: unknown): string {
    if (typeof value !== "string" || !value.trim()) {
      throw this.denied();
    }
    return value.trim();
  }

  private optionalString(value: unknown): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    return this.requiredString(value);
  }

  private denied(): ForbiddenException {
    return new ForbiddenException("PARC authorization denied");
  }
}
`;

const guardContent = `import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ParcAuthorizationClient } from "./parc-authorization.client";
import { PARC_AUTHORIZATION_TARGET } from "./require-parc-authorization.decorator";
import {
  ParcAuthorizationTarget,
  RequestWithParcAuthorization,
} from "./parc-authorization.types";

@Injectable()
export class PlatformParcAuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly client: ParcAuthorizationClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithParcAuthorization>();
    const target = this.reflector.getAllAndOverride<ParcAuthorizationTarget>(
      PARC_AUTHORIZATION_TARGET,
      [context.getHandler(), context.getClass()],
    );

    if (!target) {
      throw new ForbiddenException("PARC authorization target is required");
    }

    const receipt = await this.client.check(request, target);
    request.parcAccessDecisionReceipt = receipt;
    return true;
  }
}
`;

const moduleContent = `import { Module } from "@nestjs/common";
import { PlatformContextModule } from "../../platform-context";
import { ParcAuthorizationClient } from "./parc-authorization.client";
import { PlatformParcAuthorizationGuard } from "./platform-parc-authorization.guard";

@Module({
  imports: [PlatformContextModule],
  providers: [ParcAuthorizationClient, PlatformParcAuthorizationGuard],
  exports: [ParcAuthorizationClient, PlatformParcAuthorizationGuard],
})
export class PlatformParcAuthorizationModule {}
`;

const indexContent = `export * from "./parc-authorization.types";
export * from "./require-parc-authorization.decorator";
export * from "./parc-authorization.client";
export * from "./platform-parc-authorization.guard";
export * from "./platform-parc-authorization.module";
`;

const envExampleContent = `PARC_URL=
PARC_INTERNAL_API_KEY=
PARC_TIMEOUT_MS=3000
`;

const docsContent = `# Platform PARC Authorization

Apply this guard only after trusted authentication and platform-context
construction. The guard reads the decorator target, delegates the decision to
PARC, and attaches the successful receipt at
\`request.parcAccessDecisionReceipt\`. It does not read identity from headers or
query parameters and it does not contain owner business rules.

## Usage

Import \`PlatformParcAuthorizationModule\`, then decorate a controller or handler:

\`\`\`typescript
@RequireParcAuthorization({
  service: "owner-service",
  capability: "records.write",
  action: "create",
})
@UseGuards(PlatformParcAuthorizationGuard)
\`\`\`

The trusted actor subject comes from \`request.platformContext.actor.subjectId\`.
The target may narrow business and application scope; otherwise the actor's
trusted platform context supplies them. Missing context, required scope, PARC
configuration, transport success, or a valid allow receipt denies access.

## Ownership And Audit

\`PARC_INTERNAL_API_KEY\` authenticates this service to PARC transport. It is not
the user's authorization and must never be treated as an allow decision. PARC
decides the requested service capability and optional action; it does not own
business truth.

Owner invariants still apply after PARC allows access. The owner service must
record \`decisionReference\` in the same owner transaction as the protected
mutation and its outbox/audit record. The optional \`decisionId\` is retained
only for compatibility; \`decisionReference\` is the required audit reference.
`;
