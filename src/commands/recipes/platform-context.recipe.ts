import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../../utils/file.utils';

export async function applyPlatformContextRecipe(basePath: string): Promise<void> {
  const contextPath = path.join(basePath, 'src/shared/platform-context');
  const docsPath = path.join(basePath, 'docs/platform');

  await ensureDir(contextPath);
  await ensureDir(docsPath);

  await writeFile(path.join(contextPath, 'platform-context.types.ts'), typesContent);
  await writeFile(path.join(contextPath, 'platform-context.factory.ts'), factoryContent);
  await writeFile(path.join(contextPath, 'platform-context.service.ts'), serviceContent);
  await writeFile(path.join(contextPath, 'platform-context.module.ts'), moduleContent);
  await writeFile(path.join(contextPath, 'index.ts'), indexContent);
  await writeFile(path.join(docsPath, 'platform-context.md'), docsContent);

  console.log(chalk.green('  ✓ Canonical actor and machine context contract'));
  console.log(chalk.green('  ✓ Correlation, causation, and idempotency metadata'));
  console.log(chalk.green('  ✓ Async request-context propagation'));
  console.log(
    chalk.yellow(
      '  Build this context only from a verified broker or service principal; never trust caller identity headers.',
    ),
  );
}

const typesContent = `export interface PlatformActorContext {
  subjectId: string;
  businessId?: string;
  applicationId?: string;
  sessionId?: string;
  tokenId?: string;
  authenticatedBy: string;
}

export interface PlatformMachineContext {
  serviceName: string;
  clientId?: string;
  serviceInstanceId?: string;
  grantId?: string;
  credentialId?: string;
}

export interface VerifiedPlatformPrincipal {
  actor?: PlatformActorContext;
  machine?: PlatformMachineContext;
}

export interface PlatformRequestContext extends VerifiedPlatformPrincipal {
  requestId: string;
  correlationId: string;
  causationId?: string;
  idempotencyKey?: string;
  receivedAt: string;
}

export interface PlatformActionContext {
  service: string;
  capability: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  businessId?: string;
  applicationId?: string;
}

export interface PlatformAuthorizationInput {
  request: PlatformRequestContext;
  target: PlatformActionContext;
}

export interface PlatformAccessDecision {
  authority: "service-access" | "parc" | "owner-service";
  allowed: boolean;
  decisionReference: string;
  decisionId?: string;
  decidedAt: string;
  policyVersion?: string;
  reasonCode?: string;
}
`;

const factoryContent = `import { randomUUID } from "crypto";
import {
  PlatformRequestContext,
  VerifiedPlatformPrincipal,
} from "./platform-context.types";

export interface CreatePlatformRequestContextInput {
  principal: VerifiedPlatformPrincipal;
  requestId?: string;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  receivedAt?: Date;
}

export function createPlatformRequestContext(
  input: CreatePlatformRequestContextInput,
): PlatformRequestContext {
  assertVerifiedPrincipal(input.principal);

  return {
    ...input.principal,
    requestId: input.requestId || randomUUID(),
    correlationId: input.correlationId || randomUUID(),
    causationId: cleanOptional(input.causationId),
    idempotencyKey: cleanOptional(input.idempotencyKey),
    receivedAt: (input.receivedAt || new Date()).toISOString(),
  };
}

export function assertVerifiedPrincipal(principal: VerifiedPlatformPrincipal): void {
  const actorSubject = cleanOptional(principal.actor?.subjectId);
  const machineName = cleanOptional(principal.machine?.serviceName);

  if (!actorSubject && !machineName) {
    throw new Error("A verified actor or machine principal is required");
  }

  if (principal.actor && !cleanOptional(principal.actor.authenticatedBy)) {
    throw new Error("Actor authentication provenance is required");
  }
}

function cleanOptional(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}
`;

const serviceContent = `import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";
import { PlatformRequestContext } from "./platform-context.types";

@Injectable()
export class PlatformContextService {
  private readonly storage = new AsyncLocalStorage<PlatformRequestContext>();

  run<T>(context: PlatformRequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  current(): PlatformRequestContext | undefined {
    return this.storage.getStore();
  }

  required(): PlatformRequestContext {
    const context = this.current();
    if (!context) {
      throw new Error("Platform request context is not available");
    }
    return context;
  }
}
`;

const moduleContent = `import { Global, Module } from "@nestjs/common";
import { PlatformContextService } from "./platform-context.service";

@Global()
@Module({
  providers: [PlatformContextService],
  exports: [PlatformContextService],
})
export class PlatformContextModule {}
`;

const indexContent = `export * from "./platform-context.types";
export * from "./platform-context.factory";
export * from "./platform-context.service";
export * from "./platform-context.module";
`;

const docsContent = `# Platform Request Context

This contract carries trusted actor, business, application, and machine identity
between authentication, Service Access, PARC, owner services, and Relay.

## Authority

- ZITADEL authenticates and issues the token.
- Identity Manager resolves the canonical subject.
- Business Entity resolves canonical business and membership context.
- Service Access decides service and capability grants.
- PARC decides action and resource permissions.
- The owner service enforces its domain invariants and owns the mutation.

## Trust Boundary

Construct \`VerifiedPlatformPrincipal\` only after signature, issuer, audience,
expiry, and subject validation. Do not populate actor, business, application, or
machine identity from caller-selected query parameters or custom identity
headers. Edge adapters may forward a signed internal context, but the receiving
service must verify that signature and its intended audience before use.

Both Service Access and PARC must allow privileged platform mutations. Their
decision references and policy versions belong in the owner audit record. Correlation,
causation, and idempotency metadata must continue into transactional outbox
events and Relay delivery receipts.
`;
