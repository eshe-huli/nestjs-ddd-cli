import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, fileExists, writeFile } from '../../utils/file.utils';
import { applyPlatformContextRecipe } from './platform-context.recipe';

export async function applyOidcDashboardRecipe(basePath: string): Promise<void> {
  await applyPlatformContextRecipe(basePath);

  const authPath = path.join(basePath, 'src/shared/auth/oidc-dashboard');
  const docsPath = path.join(basePath, 'docs/auth');

  await ensureDir(authPath);
  await ensureDir(docsPath);

  await writeFile(path.join(authPath, 'oidc-dashboard.config.ts'), configContent);
  await writeFile(path.join(authPath, 'oidc-principal.ts'), principalContent);
  await writeFile(path.join(authPath, 'oidc-access-mapping.ts'), mappingContent);
  await writeFile(path.join(authPath, 'oidc-token-verifier.service.ts'), verifierContent);
  await writeFile(path.join(authPath, 'canonical-platform-principal.resolver.ts'), resolverContent);
  await writeFile(path.join(authPath, 'oidc-dashboard.guard.ts'), guardContent);
  await writeFile(path.join(authPath, 'index.ts'), indexContent);
  await writeFile(path.join(docsPath, 'oidc-dashboard.md'), docsContent);

  const envExamplePath = path.join(basePath, '.env.example');
  const fallbackExamplePath = path.join(basePath, '.env.oidc-dashboard.example');
  const targetExamplePath = (await fileExists(envExamplePath))
    ? fallbackExamplePath
    : envExamplePath;

  await writeFile(targetExamplePath, envExampleContent);

  console.log(chalk.green('  ✓ Platform request context contract'));
  console.log(chalk.green('  ✓ OIDC dashboard config contract'));
  console.log(chalk.green('  ✓ Canonical platform principal resolver hook'));
  console.log(chalk.green('  ✓ Role/group mapping hook'));
  console.log(chalk.green('  ✓ JWKS-backed bearer token verifier'));
  console.log(chalk.green('  ✓ NestJS dashboard/API guard with platform context'));
  console.log(chalk.green('  ✓ Laravel/Filament and Next/Node integration notes'));
  console.log(
    chalk.yellow(
      '  Keep dashboard RBAC local or PARC-backed; OIDC proves identity, not product authorization.',
    ),
  );
}

const configContent = `export interface OidcDashboardConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret?: string;
  callbackUrl: string;
  postLogoutRedirectUrl?: string;
  scopes: string[];
  adminEmails: string[];
  allowedEmailDomains: string[];
  roleClaim: string;
  groupClaim: string;
  audience?: string;
  jwksUrl?: string;
}

function listFromEnv(value: string | undefined, fallback: string[] = []): string[] {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function oidcDashboardConfigFromEnv(): OidcDashboardConfig {
  const issuerUrl = process.env.OIDC_ISSUER_URL;
  const clientId = process.env.OIDC_CLIENT_ID;
  const callbackUrl = process.env.OIDC_CALLBACK_URL;

  if (!issuerUrl || !clientId || !callbackUrl) {
    throw new Error(
      "OIDC_ISSUER_URL, OIDC_CLIENT_ID, and OIDC_CALLBACK_URL are required for dashboard SSO",
    );
  }

  return {
    issuerUrl: issuerUrl.replace(/\\/+$/, ""),
    clientId,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    callbackUrl,
    postLogoutRedirectUrl: process.env.OIDC_POST_LOGOUT_REDIRECT_URL,
    scopes: listFromEnv(process.env.OIDC_SCOPES, ["openid", "profile", "email"]),
    adminEmails: listFromEnv(process.env.OIDC_ADMIN_EMAILS).map((email) =>
      email.toLowerCase(),
    ),
    allowedEmailDomains: listFromEnv(process.env.OIDC_ALLOWED_EMAIL_DOMAINS).map(
      (domain) => domain.toLowerCase(),
    ),
    roleClaim: process.env.OIDC_ROLE_CLAIM ?? "roles",
    groupClaim: process.env.OIDC_GROUP_CLAIM ?? "groups",
    audience: process.env.OIDC_AUDIENCE ?? clientId,
    jwksUrl: process.env.OIDC_JWKS_URL || undefined,
  };
}
`;

const principalContent = `export interface OidcDashboardPrincipal {
  subject: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  roles: string[];
  groups: string[];
  claims: Record<string, unknown>;
}
`;

const mappingContent = `export interface OidcDashboardAccessMappingInput {
  subject: string;
  email?: string;
  claims: Record<string, unknown>;
  roleClaim: string;
  groupClaim: string;
}

export interface OidcDashboardAccessMapping {
  roles: string[];
  groups: string[];
}

export type OidcDashboardAccessMappingHook = (
  input: OidcDashboardAccessMappingInput,
) => OidcDashboardAccessMapping | Promise<OidcDashboardAccessMapping>;

export const defaultOidcDashboardAccessMapping: OidcDashboardAccessMappingHook = (
  input,
) => ({
  roles: oidcClaimValues(input.claims, input.roleClaim),
  groups: oidcClaimValues(input.claims, input.groupClaim),
});

export function oidcClaimValues(
  claims: Record<string, unknown>,
  claimName: string,
): string[] {
  const value = claims[claimName];
  return uniqueStringList(stringListFromClaimValue(value));
}

function stringListFromClaimValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    return value.split(/[\\s,]+/);
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => Boolean(nestedValue))
      .map(([key]) => key);
  }

  return [];
}

function uniqueStringList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
`;

const verifierContent = `import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { defaultOidcDashboardAccessMapping } from "./oidc-access-mapping";
import {
  OidcDashboardConfig,
  oidcDashboardConfigFromEnv,
} from "./oidc-dashboard.config";
import { OidcDashboardPrincipal } from "./oidc-principal";

@Injectable()
export class OidcTokenVerifierService {
  private readonly config: OidcDashboardConfig;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor() {
    this.config = oidcDashboardConfigFromEnv();
    this.jwks = createRemoteJWKSet(
      new URL(this.config.jwksUrl ?? this.config.issuerUrl + "/oauth/v2/keys"),
    );
  }

  async verifyBearerToken(token: string): Promise<OidcDashboardPrincipal> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.config.issuerUrl,
        audience: this.config.audience,
      });

      const subject = String(payload.sub);
      const email = typeof payload.email === "string" ? payload.email : undefined;
      const claims = payload as Record<string, unknown>;
      const access = await defaultOidcDashboardAccessMapping({
        subject,
        email,
        claims,
        roleClaim: this.config.roleClaim,
        groupClaim: this.config.groupClaim,
      });

      if (email && !this.emailAllowed(email)) {
        throw new UnauthorizedException("OIDC email domain is not allowed");
      }

      return {
        subject,
        email,
        emailVerified:
          typeof payload.email_verified === "boolean"
            ? payload.email_verified
            : undefined,
        name: typeof payload.name === "string" ? payload.name : undefined,
        roles: access.roles,
        groups: access.groups,
        claims,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid OIDC bearer token");
    }
  }

  private emailAllowed(email: string): boolean {
    if (this.config.adminEmails.includes(email.toLowerCase())) {
      return true;
    }

    if (this.config.allowedEmailDomains.length === 0) {
      return true;
    }

    const domain = email.split("@").pop()?.toLowerCase();
    return Boolean(domain && this.config.allowedEmailDomains.includes(domain));
  }
}
`;

const resolverContent = `import { UnauthorizedException } from "@nestjs/common";
import { VerifiedPlatformPrincipal } from "../../platform-context/platform-context.types";
import { OidcDashboardPrincipal } from "./oidc-principal";

export const CANONICAL_PLATFORM_PRINCIPAL_RESOLVER = Symbol(
  "CANONICAL_PLATFORM_PRINCIPAL_RESOLVER",
);

export interface CanonicalPlatformPrincipalResolver {
  resolve(
    principal: OidcDashboardPrincipal,
  ): VerifiedPlatformPrincipal | Promise<VerifiedPlatformPrincipal>;
}

export const defaultCanonicalPlatformPrincipalResolver: CanonicalPlatformPrincipalResolver =
  {
    resolve() {
      throw new UnauthorizedException(
        "Canonical platform principal mapping is not configured",
      );
    },
  };
`;

const guardContent = `import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { createPlatformRequestContext } from "../../platform-context/platform-context.factory";
import { PlatformRequestContext } from "../../platform-context/platform-context.types";
import {
  CANONICAL_PLATFORM_PRINCIPAL_RESOLVER,
  CanonicalPlatformPrincipalResolver,
} from "./canonical-platform-principal.resolver";
import { OidcTokenVerifierService } from "./oidc-token-verifier.service";

export interface RequestWithOidcPrincipal extends Request {
  oidcPrincipal?: Awaited<
    ReturnType<OidcTokenVerifierService["verifyBearerToken"]>
  >;
  platformContext?: PlatformRequestContext;
}

@Injectable()
export class OidcDashboardGuard implements CanActivate {
  constructor(
    private readonly verifier: OidcTokenVerifierService,
    @Inject(CANONICAL_PLATFORM_PRINCIPAL_RESOLVER)
    private readonly principalResolver: CanonicalPlatformPrincipalResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithOidcPrincipal>();
    const token = this.extractBearerToken(request.headers.authorization);

    const oidcPrincipal = await this.verifier.verifyBearerToken(token);
    request.oidcPrincipal = oidcPrincipal;

    const verifiedPrincipal = await this.principalResolver.resolve(oidcPrincipal);
    request.platformContext = createPlatformRequestContext({
      principal: verifiedPrincipal,
    });

    return true;
  }

  private extractBearerToken(authorization?: string): string {
    const [scheme, token] = authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Bearer token is required");
    }
    return token;
  }
}
`;

const indexContent = `export * from "./oidc-dashboard.config";
export * from "./oidc-principal";
export * from "./oidc-access-mapping";
export * from "./oidc-token-verifier.service";
export * from "./canonical-platform-principal.resolver";
export * from "./oidc-dashboard.guard";
`;

const docsContent = `# OIDC Dashboard Integration

Use this recipe for internal dashboards, operator portals, and admin APIs that
delegate authentication to an OIDC broker such as ZITADEL.

## Ownership Boundary

- OIDC authenticates the human or machine session.
- The service maps the OIDC subject and email to a local operator record.
- Product authorization stays local or PARC-backed. Do not grant access merely
  because a user can authenticate with the broker.
- Identity Manager remains the canonical identity profile service. VerifyHQ
  remains verification evidence. Service Access remains service/client
  enrollment and discovery.

## NestJS API/Dashboard Pattern

1. Configure env values from \`.env.oidc-dashboard.example\`.
2. Register \`OidcTokenVerifierService\` as a provider.
3. Provide \`CANONICAL_PLATFORM_PRINCIPAL_RESOLVER\` with an implementation that
   maps the verified OIDC principal to \`VerifiedPlatformPrincipal\` through
   Identity Manager and Business Entity. Do not set \`actor.subjectId\` to the
   OIDC \`sub\` automatically; canonical subjects come from platform identity
   services after broker verification.
4. Apply \`OidcDashboardGuard\` to dashboard/admin API controllers. The guard
   verifies the bearer token, resolves the canonical principal, builds
   \`platformContext\` with \`createPlatformRequestContext\`, and attaches it to
   the request. Do not read actor, business, or application identity from custom
   headers or query parameters.
5. Before privileged mutations, require both Service Access capability grants and
   PARC action checks. Record Service Access and PARC decision references in the owner
   audit trail.
6. On first successful login, map broker identity to your local operator record
   or ask PARC for roles/permissions.
7. Keep the OIDC client secret in Vault, External Secrets, or the deployment
   secret store. Never commit it.
8. Set \`OIDC_JWKS_URL\` only when the broker does not expose keys at the
   default ZITADEL-compatible \`/oauth/v2/keys\` path.

## Environment Contract

- \`OIDC_ISSUER_URL\`: OIDC issuer URL, for example \`https://auth.example.com\`.
- \`OIDC_CLIENT_ID\`: dashboard/application client ID.
- \`OIDC_CLIENT_SECRET\`: secret loaded from the environment secret store.
- \`OIDC_CALLBACK_URL\`: exact redirect URI registered on the OIDC client.
- \`OIDC_SCOPES\`: comma-separated scopes, usually \`openid,profile,email\`.
- \`OIDC_ALLOWED_EMAIL_DOMAINS\`: comma-separated allow-list for staff/operator
  domains. Leave empty only when the dashboard has a stronger local allow-list.
- \`OIDC_ROLE_CLAIM\`: token claim used for roles. Defaults to \`roles\`.
- \`OIDC_GROUP_CLAIM\`: token claim used for groups. Defaults to \`groups\`.

## Role And Group Mapping Hook

\`oidc-access-mapping.ts\` is intentionally framework-neutral. Use
\`defaultOidcDashboardAccessMapping\` as the safe default, then wrap or replace
it when a dashboard needs to map broker roles/groups to local roles, tenant
access, or PARC permissions. Keep this mapping after token verification and
before local session creation.

## Laravel/Filament Pattern

Laravel dashboards should use Socialite with an OpenID Connect provider.
Filament panels can either:

- use a Filament Socialite plugin when the panel wants provider buttons and
  allow-list callbacks; or
- use a custom Socialite controller when tenant/PARC assignment is more complex.

The same rule applies: Socialite proves who logged in; the dashboard still needs
local/PARC authorization before showing resources.

## Next.js/Node Pattern

Next.js dashboards should use Auth.js/NextAuth or \`openid-client\` with the
same issuer, client, callback URL, and scopes from the environment contract. In
the sign-in callback, enforce \`OIDC_ALLOWED_EMAIL_DOMAINS\`, then call the same
role/group mapping hook before writing the local session. Plain Node services
that receive bearer tokens can reuse the generated \`jose\` verifier pattern and
map roles/groups before applying route permissions.

## Required Redirect Shape

Create one OIDC application per dashboard/environment. The redirect URI must
match the app exactly, for example:

\`\`\`text
https://dashboard.example.com/auth/oidc/callback
\`\`\`

For private/VPN-only staging surfaces, HTTP can be acceptable inside the private
network when the edge already terminates transport securely elsewhere, but
production dashboards should use HTTPS.
`;

const envExampleContent = `# OIDC dashboard SSO
OIDC_ISSUER_URL=https://auth.example.com
OIDC_CLIENT_ID=replace-me
OIDC_CLIENT_SECRET=replace-me
OIDC_CALLBACK_URL=https://dashboard.example.com/auth/oidc/callback
OIDC_POST_LOGOUT_REDIRECT_URL=https://dashboard.example.com
OIDC_SCOPES=openid,profile,email
OIDC_AUDIENCE=replace-me
OIDC_JWKS_URL=
OIDC_ROLE_CLAIM=roles
OIDC_GROUP_CLAIM=groups
OIDC_ADMIN_EMAILS=admin@example.com
OIDC_ALLOWED_EMAIL_DOMAINS=example.com
`;
