import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, fileExists, writeFile } from '../../utils/file.utils';

export async function applyOidcDashboardRecipe(basePath: string): Promise<void> {
  const authPath = path.join(basePath, 'src/shared/auth/oidc-dashboard');
  const docsPath = path.join(basePath, 'docs/auth');

  await ensureDir(authPath);
  await ensureDir(docsPath);

  await writeFile(path.join(authPath, 'oidc-dashboard.config.ts'), configContent);
  await writeFile(path.join(authPath, 'oidc-principal.ts'), principalContent);
  await writeFile(path.join(authPath, 'oidc-token-verifier.service.ts'), verifierContent);
  await writeFile(path.join(authPath, 'oidc-dashboard.guard.ts'), guardContent);
  await writeFile(path.join(authPath, 'index.ts'), indexContent);
  await writeFile(path.join(docsPath, 'oidc-dashboard.md'), docsContent);

  const envExamplePath = path.join(basePath, '.env.example');
  const fallbackExamplePath = path.join(basePath, '.env.oidc-dashboard.example');
  const targetExamplePath = (await fileExists(envExamplePath))
    ? fallbackExamplePath
    : envExamplePath;

  await writeFile(targetExamplePath, envExampleContent);

  console.log(chalk.green('  ✓ OIDC dashboard config contract'));
  console.log(chalk.green('  ✓ JWKS-backed bearer token verifier'));
  console.log(chalk.green('  ✓ NestJS dashboard/API guard'));
  console.log(chalk.green('  ✓ Laravel/Filament integration notes'));
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
  claims: Record<string, unknown>;
}
`;

const verifierContent = `import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify } from "jose";
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

      const email = typeof payload.email === "string" ? payload.email : undefined;
      const roleClaim = payload[this.config.roleClaim];
      const roles = Array.isArray(roleClaim)
        ? roleClaim.filter((role): role is string => typeof role === "string")
        : [];

      if (email && !this.emailAllowed(email)) {
        throw new UnauthorizedException("OIDC email domain is not allowed");
      }

      return {
        subject: String(payload.sub),
        email,
        emailVerified:
          typeof payload.email_verified === "boolean"
            ? payload.email_verified
            : undefined,
        name: typeof payload.name === "string" ? payload.name : undefined,
        roles,
        claims: payload as Record<string, unknown>,
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

const guardContent = `import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { OidcTokenVerifierService } from "./oidc-token-verifier.service";

export interface RequestWithOidcPrincipal extends Request {
  oidcPrincipal?: Awaited<
    ReturnType<OidcTokenVerifierService["verifyBearerToken"]>
  >;
}

@Injectable()
export class OidcDashboardGuard implements CanActivate {
  constructor(private readonly verifier: OidcTokenVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithOidcPrincipal>();
    const token = this.extractBearerToken(request.headers.authorization);

    request.oidcPrincipal = await this.verifier.verifyBearerToken(token);
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
export * from "./oidc-token-verifier.service";
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
3. Apply \`OidcDashboardGuard\` to dashboard/admin API controllers.
4. On first successful login, map \`sub\` and \`email\` to your local operator
   table or ask PARC for roles/permissions.
5. Keep the OIDC client secret in Vault, External Secrets, or the deployment
   secret store. Never commit it.
6. Set \`OIDC_JWKS_URL\` only when the broker does not expose keys at the
   default ZITADEL-compatible \`/oauth/v2/keys\` path.

## Laravel/Filament Pattern

Laravel dashboards should use Socialite with an OpenID Connect provider.
Filament panels can either:

- use a Filament Socialite plugin when the panel wants provider buttons and
  allow-list callbacks; or
- use a custom Socialite controller when tenant/PARC assignment is more complex.

The same rule applies: Socialite proves who logged in; the dashboard still needs
local/PARC authorization before showing resources.

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
OIDC_ADMIN_EMAILS=admin@example.com
OIDC_ALLOWED_EMAIL_DOMAINS=example.com
`;
