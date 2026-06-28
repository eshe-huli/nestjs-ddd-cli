import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../../utils/file.utils';

export async function applyBanklinkConnectorContractRecipe(basePath: string): Promise<void> {
  const sharedPath = path.join(basePath, 'src/shared');
  const banklinkPath = path.join(sharedPath, 'banklink-connector');
  const docsPath = path.join(basePath, 'docs');

  await ensureDir(banklinkPath);
  await ensureDir(docsPath);

  await writeFile(path.join(banklinkPath, 'banklink-connector.types.ts'), typesContent);
  await writeFile(path.join(banklinkPath, 'banklink-connector.errors.ts'), errorsContent);
  await writeFile(path.join(banklinkPath, 'index.ts'), indexContent);
  await writeFile(path.join(docsPath, 'BANKLINK_CONNECTOR_CONTRACT.md'), docsContent);

  console.log(chalk.green('  ✓ BankLink connector contract types'));
  console.log(chalk.green('  ✓ Go sidecar boundary documentation'));
  console.log(
    chalk.yellow(
      '  Keep BankLink business policy in NestJS; put VPN/bank transport pain in sidecars.',
    ),
  );
}

const typesContent = `export type BankConnectorRuntime = "nestjs" | "go-sidecar" | "external";

export type BankConnectorCapability =
  | "client_lookup"
  | "account_statement"
  | "rib_download"
  | "iban_validation"
  | "virtual_accounts"
  | "single_transfer"
  | "bulk_transfers"
  | "transfer_status"
  | "webhook_receiver";

export type BankConnectorHealthStatus = "healthy" | "degraded" | "down" | "unknown";

export interface BankConnectorDescriptor {
  code: string;
  displayName: string;
  country: string;
  runtime: BankConnectorRuntime;
  capabilities: BankConnectorCapability[];
  requiresVpn: boolean;
  requiresMutualTls: boolean;
  requiredEnv: string[];
  healthPath: string;
}

export interface BankConnectorHealth {
  connectorCode: string;
  status: BankConnectorHealthStatus;
  checkedAt: string;
  latencyMs?: number;
  message?: string;
}

export interface BankConnectorRequestContext {
  requestId: string;
  tenantId?: string;
  businessEntityId?: string;
  idempotencyKey: string;
  initiatedBy: string;
}

export interface BankConnectorResult<TPayload> {
  success: boolean;
  payload?: TPayload;
  providerReference?: string;
  retryable?: boolean;
  errorCode?: string;
  errorMessage?: string;
}
`;

const errorsContent = `export class BankConnectorConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BankConnectorConfigurationError";
  }
}

export class BankConnectorUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BankConnectorUnavailableError";
  }
}
`;

const indexContent = `export * from "./banklink-connector.types";
export * from "./banklink-connector.errors";
`;

const docsContent = `# BankLink Connector Contract

BankLink is the NestJS control plane. It owns consents, linked accounts, user
policy, business policy, audit, and service-facing APIs.

Bank connector sidecars own bank-specific transport pain: VPN, mTLS, IP
allowlisting, SOAP/SFTP/HTTP quirks, and provider health probing.

## Runtime Decision

- Use NestJS for the BankLink core service and any connector whose complexity is
  mostly business/domain logic.
- Use Go sidecars for VPN-bound or high-throughput bank adapters where a small
  static binary, low memory, simple containerization, and explicit network
  behavior are valuable.

## Required Sidecar Surface

Every sidecar must expose:

- \`GET /health/live\`
- \`GET /health/ready\`
- \`GET /capabilities\`
- \`POST /commands/:commandName\`

Commands must require an idempotency key and return a normalized
\`BankConnectorResult\`. BankLink persists the business request and audit before
calling the sidecar.

## Ownership Rule

Never put business approval, consent decisions, fee decisions, account ownership,
or tenant access rules in a sidecar. The sidecar only talks to the bank and
normalizes the response.
`;
