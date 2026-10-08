# nestjs-ddd-cli project context

Verified 2026-10-08. Repository: eshe-huli/nestjs-ddd-cli; source checkout /Users/macbook/development/command/nestjs-ddd-cli. Ben Ouattara owns product decisions. [README](../../README.md), [AGENTS](../../AGENTS.md), and [OIDC checkpoint](../../OIDC_RESOURCE_SERVER_HANDOFF.md) retain existing authority.

The CLI produces predictable NestJS DDD infrastructure. This milestone adds a reusable OAuth2 introspection recipe so consuming APIs avoid copied authentication frameworks. Users are service engineers; the job is generate, review, integrate and verify supported infrastructure. No package publication, identity-provider selection, business permission grant or consuming-service edit is authorized in this slice.

Canonical task: [OAuth2 introspection](../runs/2026-10-08-oauth2-token-introspection.md). Proof bar: generator safety, emitted strict compilation and adverse transport behavior, related recipes/doctor regressions, lint/typecheck/build. CI, publication and deployed actor evidence remain distinct. Headless infrastructure slice; no product presentation or UI-kit change.

Existing RS256/azp recipe remains unchanged. OAuth2 social-login and bespoke service-access recipes are unrelated and must not be repurposed. No database schema/data or transport adoption change. Architecture: recipe dispatcher owns composition; templates own generated framework; consuming services own principal/session/domain policy. See [decisions](decisions.md) and [authorities](authorities.md).

The next authorized headless milestone is [Confidential OIDC BFF sessions](../runs/2026-10-08-oidc-bff-session.md): one reusable generator distribution owner for reviewed authorization-code transport, opaque server-session Lua and bounded Valkey command adapter. Application/provider/domain policy and deployment storage custody remain explicit external owners. This supersedes the initial milestone's no-transport-adoption scope only for this additive accepted BFF recipe.
