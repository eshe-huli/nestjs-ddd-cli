# Confidential OIDC BFF session recipe

ID GEN-BFF-20261008, revision1; owner generator worker, reviewer root. Authorized by user Ory split and root additive generator delegation. Existing reviewed Patient OIDC, opaque-session Lua and Valkey core are source input, frozen by root before extraction. This slice owns generator/template/test/docs only; no app domain policy, UI, cookie, provider provisioning, production deployment or push.

Extended auth/async infrastructure track. GEN-11..13 resolve exact endpoint ownership, single distribution owner, provider-lifetime custody defaults, dependency/CI runtime and plaintext storage acceptance boundaries. Source compatibility remains provider-neutral and framework-independent. Next server-only markers and application admission stay consumer-owned.

Acceptance: dry-run writes nothing; collision/symlink/rerun-safe all-target preflight and successor-safe rollback; emitted strict compilation; real signed OIDC code/nonce/state/auth_time/type/scope/JWKS/custody failure proofs; bounded single-flight Valkey transport; actual disposable Redis Lua one-time claims, exact pair transfer, switch/logout, lease/retry/stale owner/restart/client isolation and refresh-only custody; established generator lint/typecheck/build/full suite. Source proof and CI/deployment/real actor proof remain distinct.

Verified source checkpoint (2026-10-08): generator full gate27suites/134tests/2snapshots; focused recipe10 cases includes all-target dry-run/conflict/rerun/symlink/rollback successor protection plus emitted strict compilation and75 emitted unit cases (17 actual Redis cases skipped in unit profile). Separately authorized disposable Redis profile passes92 cases/267assertions across4files, including18 store file cases and the adapter's actual connection-restart proof. No server flush/kill or existing namespace is used.

Peer read-only review found and corrected two material gaps: provider expiry is now conservatively anchored before token exchange, and retirement CLAIM sets a durable non-admissible marker so session commit cannot race a revocation attempt, including retries and expired leases. Regression proofs cover both. No remaining material peer findings.

Remote supported proof: homelab job laptop-test-a9b15e00f089 on k3s-03, source SHA256801f5187246454a97333745d6c6e51a36f010ae2d143bcc988dbde38d02ebad1, pinned Bun1.4 image, exit0/cleanup0. It rebuilt CLI and passed10 recipe cases including strict emitted compilation and emitted OIDC/unit behavior. Redis remains the separately authorized local synthetic profile, not reached by the isolated remote test job.

Established typecheck/build and emitted strict compilation pass. Changed generator files and all emitted TypeScript/specs pass explicit lint/Prettier with zero warnings. Existing repository-wide lint:strict returns zero errors with baseline warnings; optional whole-project typecheck:strict retains extensive pre-existing index-signature errors outside this slice. Full Bun/Jest uses globalsCleanup=off for native Stream/Jest30 incompatibility and read-only NODE_PATH installed Nest peer roots for the isolated store; no test omissions, dependency copies or consumer patches. CI keeps npm ci/scripts, Node18/20/22/24 and release workflow; only Bun1.4 test runtime is added for emitted verification.

Next permitted action: root review and local coherent source commit, then generated consumption with Next server-only wrappers and per-app domain admission. No push, package publication, CI/deployment or real actor proof is established by this checkpoint. Existing Husky npx hook is not used on the local Bun-only host; the equivalent required checks above ran directly through Bun before the source commit.

## Strict consumer-spec and existing logging emission follow-up

Two independently scoped source reviews produced this additive follow-up. The
BFF test callback now explicitly returns undefined, satisfying the emitted
fixture's response type under the complete Next consumer strict programs. No
runtime behavior, dependency, dispatcher or release workflow changes. Both
commerce consumer programs compile their generated specs; the separately owned
actual Redis profile passes 222 cases / 719 assertions with no skips.

The shared logging emitter already uses node:crypto randomUUID and typed user
narrowing. An older Clinical generated copy was stale; no new emitter or uuid
dependency is needed. A new emitted real Nest middleware test checks generated
request IDs, preserved request IDs, invalid user-ID rejection and concurrent
AsyncLocalStorage separation. Clinical's actual Nest/Express type graph strictly
compiles the consumed generated context. This does not broaden its business
authorization.

Root aggregate verification passes both focused suites / 12 cases, production
build/typecheck, strict changed-test lint and whitespace checks. The BFF recipe
executes actual signed OIDC and storage behavior and strictly compiles emitted
production code. Local Bun uses the documented installed-peer NODE_PATH and
globalsCleanup=off exceptions; established Node CI is unchanged. No optional
global Bun types were added. Root owns publication and exact-head matrix CI;
these receipts alone do not prove activated apps or deployed actors.
