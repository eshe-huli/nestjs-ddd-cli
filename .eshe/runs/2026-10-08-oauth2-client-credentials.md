# OAuth2 client credentials and bounded JSON POST

Root authorized an additive generator slice on 2026-10-08, starting at approved
`f57e33c`, before consuming it in MyDermaLife's new private identity-delivery-api.
Existing introspection/OIDC APIs, business policy, package publication, CI and
provider activation remain outside this change. Local commands use Bun.

Accepted contract: fixed HTTPS token URL, client-secret Basic authentication,
bounded form grant, Bearer token with explicit valid lifetime, request-start
expiry, bounded margin, per-instance cache and single-flight, compare-token
invalidation, no retry or provider send policy. Secrets stay in ECMAScript private
fields; errors retain no raw responses or credentials. Orange's decimal-string
expiry requires an explicit generic compatibility option.

The new recipe reuses exactly the introspection recipe's bounded HTTP template
and adds JSON POST without changing GET/form semantics. Both plans share one
whole-plan preflight/exclusive-write/owner-preserving-rollback implementation.
No AppModule or database wiring. JSON requests require plain bounded values,
finite numbers, bounded depth/nodes/UTF-8 bytes and sanitized serialization.

Acceptance: dry-run and rerun safety, later conflict/symlinks/concurrent owner
rollback, strict emitted compilation, cache/expiry/concurrency/failure/redaction
behavior, JSON wire/byte/depth/cycle cases, prior introspection/OIDC/doctor
regressions, focused lint/type/build and diff checks. Source checks, CI,
publication, consuming-service tests and real provider proof remain distinct.

New service boundary and provider choices remain in the owning MyDermaLife
workspace's accepted run; this recipe grants no identity or delivery authority.
Local source acceptance: 27 suites, 137 tests and two snapshots pass (one opt-in smoke skipped in the full run); the separate real Bun Nest/DDD initialization smoke and option checks pass 9/9. New recipe safety10 and emitted behavior46 pass; prior introspection safety10 and emitted behavior51 pass. Production type/build, focused strict lint and diff checks pass. The existing external-projection suite needs reflect-metadata via the established consumer NODE_PATH because the shared upstream dependency snapshot does not expose that peer; no CI/dependency policy was changed. Common writer extraction ba91b5d and explicit Bun initialization7878389 are separate local commits. No publication, CI, live send or credential proof claimed.
