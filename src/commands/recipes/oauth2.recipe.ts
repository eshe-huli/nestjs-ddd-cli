import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../../utils/file.utils';

export async function applyOAuth2Recipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const oauthPath = path.join(sharedPath, 'oauth');

  await ensureDir(oauthPath);
  await ensureDir(path.join(oauthPath, 'strategies'));
  await ensureDir(path.join(oauthPath, 'guards'));

  // OAuth types
  const oauthTypesContent = `export interface OAuthProfile {
  provider: string;
  providerId: string;
  email: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  raw: any;
}

export interface OAuthUser {
  id: string;
  email: string;
  providers: OAuthProvider[];
}

export interface OAuthProvider {
  provider: string;
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
  linkedAt: Date;
}

export type OAuthProviderType = "google" | "github" | "microsoft" | "facebook";
`;
  await writeFile(path.join(oauthPath, 'oauth.types.ts'), oauthTypesContent);

  // Google Strategy
  const googleStrategyContent = `import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback, Profile } from "passport-google-oauth20";
import { OAuthProfile } from "../oauth.types";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
      scope: ["email", "profile"],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ): Promise<void> {
    const { id, emails, name, photos, displayName } = profile;

    const oauthProfile: OAuthProfile = {
      provider: "google",
      providerId: id,
      email: emails?.[0]?.value || "",
      emailVerified: emails?.[0]?.verified || false,
      firstName: name?.givenName,
      lastName: name?.familyName,
      displayName: displayName,
      avatarUrl: photos?.[0]?.value,
      accessToken,
      refreshToken,
      raw: profile._json,
    };

    done(null, oauthProfile);
  }
}
`;
  await writeFile(path.join(oauthPath, 'strategies/google.strategy.ts'), googleStrategyContent);

  // GitHub Strategy
  const githubStrategyContent = `import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, Profile } from "passport-github2";
import { OAuthProfile } from "../oauth.types";

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, "github") {
  constructor() {
    super({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL || "/auth/github/callback",
      scope: ["user:email"],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any) => void
  ): Promise<void> {
    const { id, emails, displayName, photos, username } = profile;

    const oauthProfile: OAuthProfile = {
      provider: "github",
      providerId: id,
      email: emails?.[0]?.value || "",
      emailVerified: true, // GitHub verifies emails
      displayName: displayName || username,
      avatarUrl: photos?.[0]?.value,
      accessToken,
      refreshToken,
      raw: profile._json,
    };

    done(null, oauthProfile);
  }
}
`;
  await writeFile(path.join(oauthPath, 'strategies/github.strategy.ts'), githubStrategyContent);

  // OAuth Guards
  const oauthGuardsContent = `import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = (await super.canActivate(context)) as boolean;
    const request = context.switchToHttp().getRequest();
    await super.logIn(request);
    return result;
  }
}

@Injectable()
export class GitHubAuthGuard extends AuthGuard("github") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = (await super.canActivate(context)) as boolean;
    const request = context.switchToHttp().getRequest();
    await super.logIn(request);
    return result;
  }
}

@Injectable()
export class OAuthCallbackGuard extends AuthGuard(["google", "github"]) {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new Error("OAuth authentication failed");
    }
    return user;
  }
}
`;
  await writeFile(path.join(oauthPath, 'guards/oauth.guard.ts'), oauthGuardsContent);

  // OAuth Service
  const oauthServiceContent = `import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OAuthProfile, OAuthUser, OAuthProvider } from "./oauth.types";

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(private jwtService: JwtService) {}

  /**
   * Handle OAuth callback - find or create user
   */
  async handleOAuthLogin(profile: OAuthProfile): Promise<{
    user: OAuthUser;
    accessToken: string;
    isNewUser: boolean;
  }> {
    // TODO: Implement actual user lookup/creation
    // This is a placeholder implementation

    const existingUser = await this.findUserByProvider(
      profile.provider,
      profile.providerId
    );

    if (existingUser) {
      // Update tokens
      await this.updateProviderTokens(
        existingUser.id,
        profile.provider,
        profile.accessToken,
        profile.refreshToken
      );

      const accessToken = await this.generateJwtToken(existingUser);
      return { user: existingUser, accessToken, isNewUser: false };
    }

    // Check if user exists with same email
    const userByEmail = await this.findUserByEmail(profile.email);

    if (userByEmail) {
      // Link new provider to existing account
      await this.linkProvider(userByEmail.id, profile);
      const accessToken = await this.generateJwtToken(userByEmail);
      return { user: userByEmail, accessToken, isNewUser: false };
    }

    // Create new user
    const newUser = await this.createUserFromOAuth(profile);
    const accessToken = await this.generateJwtToken(newUser);
    return { user: newUser, accessToken, isNewUser: true };
  }

  /**
   * Link OAuth provider to existing account
   */
  async linkProvider(userId: string, profile: OAuthProfile): Promise<void> {
    const provider: OAuthProvider = {
      provider: profile.provider,
      providerId: profile.providerId,
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken,
      linkedAt: new Date(),
    };

    // TODO: Save provider to database
    this.logger.log(\`Linked \${profile.provider} to user \${userId}\`);
  }

  /**
   * Unlink OAuth provider from account
   */
  async unlinkProvider(userId: string, provider: string): Promise<void> {
    // TODO: Remove provider from database
    // Ensure user has at least one auth method remaining
    this.logger.log(\`Unlinked \${provider} from user \${userId}\`);
  }

  /**
   * Generate JWT token for user
   */
  async generateJwtToken(user: OAuthUser): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
    };

    return this.jwtService.signAsync(payload);
  }

  /**
   * Refresh OAuth access token
   */
  async refreshProviderToken(
    userId: string,
    provider: string
  ): Promise<string | null> {
    // TODO: Implement token refresh using provider's refresh token
    return null;
  }

  // Placeholder methods - implement with your actual data layer
  private async findUserByProvider(
    provider: string,
    providerId: string
  ): Promise<OAuthUser | null> {
    return null;
  }

  private async findUserByEmail(email: string): Promise<OAuthUser | null> {
    return null;
  }

  private async createUserFromOAuth(profile: OAuthProfile): Promise<OAuthUser> {
    return {
      id: "new-user-id",
      email: profile.email,
      providers: [
        {
          provider: profile.provider,
          providerId: profile.providerId,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
          linkedAt: new Date(),
        },
      ],
    };
  }

  private async updateProviderTokens(
    userId: string,
    provider: string,
    accessToken: string,
    refreshToken?: string
  ): Promise<void> {
    // TODO: Update tokens in database
  }
}
`;
  await writeFile(path.join(oauthPath, 'oauth.service.ts'), oauthServiceContent);

  // OAuth Controller
  const oauthControllerContent = `import {
  Controller,
  Get,
  UseGuards,
  Req,
  Res,
  Query,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from "@nestjs/swagger";
import { Response } from "express";
import { GoogleAuthGuard, GitHubAuthGuard } from "./guards/oauth.guard";
import { OAuthService } from "./oauth.service";
import { OAuthProfile } from "./oauth.types";

@ApiTags("OAuth")
@Controller("auth")
export class OAuthController {
  constructor(private oauthService: OAuthService) {}

  // Google OAuth
  @Get("google")
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: "Initiate Google OAuth login" })
  googleLogin() {
    // Guard redirects to Google
  }

  @Get("google/callback")
  @UseGuards(GoogleAuthGuard)
  @ApiExcludeEndpoint()
  async googleCallback(@Req() req: any, @Res() res: Response) {
    return this.handleCallback(req.user, res);
  }

  // GitHub OAuth
  @Get("github")
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({ summary: "Initiate GitHub OAuth login" })
  githubLogin() {
    // Guard redirects to GitHub
  }

  @Get("github/callback")
  @UseGuards(GitHubAuthGuard)
  @ApiExcludeEndpoint()
  async githubCallback(@Req() req: any, @Res() res: Response) {
    return this.handleCallback(req.user, res);
  }

  /**
   * Common callback handler
   */
  private async handleCallback(profile: OAuthProfile, res: Response) {
    try {
      const { user, accessToken, isNewUser } =
        await this.oauthService.handleOAuthLogin(profile);

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const redirectUrl = new URL("/auth/callback", frontendUrl);
      redirectUrl.searchParams.set("token", accessToken);
      redirectUrl.searchParams.set("isNewUser", String(isNewUser));

      return res.redirect(redirectUrl.toString());
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const errorUrl = new URL("/auth/error", frontendUrl);
      errorUrl.searchParams.set("error", "oauth_failed");

      return res.redirect(errorUrl.toString());
    }
  }
}
`;
  await writeFile(path.join(oauthPath, 'oauth.controller.ts'), oauthControllerContent);

  // OAuth Module
  const oauthModuleContent = `import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { GoogleStrategy } from "./strategies/google.strategy";
import { GitHubStrategy } from "./strategies/github.strategy";
import { OAuthService } from "./oauth.service";
import { OAuthController } from "./oauth.controller";

@Module({
  imports: [
    PassportModule.register({ session: false }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: "7d" },
    }),
  ],
  controllers: [OAuthController],
  providers: [
    OAuthService,
    GoogleStrategy,
    GitHubStrategy,
  ],
  exports: [OAuthService],
})
export class OAuthModule {}
`;
  await writeFile(path.join(oauthPath, 'oauth.module.ts'), oauthModuleContent);

  // Index exports
  await writeFile(path.join(oauthPath, 'index.ts'), `export * from "./oauth.types";
export * from "./oauth.service";
export * from "./oauth.controller";
export * from "./oauth.module";
export * from "./strategies/google.strategy";
export * from "./strategies/github.strategy";
export * from "./guards/oauth.guard";
`);

  await writeFile(path.join(oauthPath, 'strategies/index.ts'), `export * from "./google.strategy";
export * from "./github.strategy";
`);

  await writeFile(path.join(oauthPath, 'guards/index.ts'), `export * from "./oauth.guard";
`);

  console.log(chalk.green('  ✓ OAuth types and interfaces'));
  console.log(chalk.green('  ✓ Google OAuth strategy'));
  console.log(chalk.green('  ✓ GitHub OAuth strategy'));
  console.log(chalk.green('  ✓ OAuth guards'));
  console.log(chalk.green('  ✓ OAuth service (login, link/unlink providers)'));
  console.log(chalk.green('  ✓ OAuth controller with callbacks'));
  console.log(chalk.green('  ✓ OAuth module'));
}
