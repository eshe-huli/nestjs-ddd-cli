# OAuth2 token introspection recipe

ID GEN-20261008, revision 2; owner generator worker, reviewer root. State: verified source; authorized user Ory split and root generator assignment. Worktree /Users/macbook/development/command/.codex-worktrees/nestjs-ddd-oauth2-introspection-20261008, branch feat/oauth2-token-introspection-20261008, freshly fetched origin/main baseline 0ca15f7. Original checkout clean. No consuming-service, infra, CI/container manager or unrelated recipe change. No push or publication before review.

Locked outcome: additive bounded RFC7662 mechanism and consumer-owned principal seam through supported ddd recipe, with safe generation and executable proof. Extended track for shared authentication infrastructure; change/auth overlays. All implementation-critical decisions [GEN-01..10](../project/decisions.md) are resolved; no UI presentation changes. Upstream protocol docs initialized only because this authorized repository had no .eshe.

| Acceptance | Outcome | Required proof | Status |
| --- | --- | --- | --- |
| A1 | CLI listing/application/dry-run integrate new recipe | Rebuilt CLI integration tests | Verified locally |
| A2 | Generator protects owners, no partial writes | Conflict, rerun, symlink, rollback tests | Verified locally |
| A3 | RFC7662 bounded transport, no cache/leaks | Emitted behavior spec, timeout/stream/redaction/denial cases | Verified locally |
| A4 | Consumer owns provider/principal/session/domain policy | Typed evidence + required validate callback, docs/spec | Verified locally |
| A5 | Nest sync/async owner composition | Strict output compilation/module proof | Verified locally |
| A6 | Preserve existing generator behavior | Related recipe/doctor checks, lint/typecheck/build | Verified locally |
| A7 | Reviewable diff and handoff | Exact command/path/check receipts; no push | Verified locally |

Next permitted action: deliver the reviewed source checkpoint and consumption contract to root. Publication, push, CI and live deployment remain outside this source checkpoint. Dependencies are available locally via existing dependency store; no installation/lock migration. No secret values logged/stored. Proposed transport supports explicit trusted internal HTTP; consumer policy covers exact issuer/client/audience/expiry/access-token type and any Ory session binding.

Progress: source acceptance is verified; root approved the first contract and generic GET extraction. CI/publication/deployment/runtime/actor evidence is not established by this generator slice.

## First verified milestone and review

2026-10-08: Root approved the transport/module contract and Identity consumption. Root required successor-safe rollback; inode/timestamp/content receipts now preserve replacement and modified owner files and report rollback conflict. Focused recipe10 cases pass with strict emitted output and34 consumer behavior cases. Earlier full repository gate passed26 suites/122 tests/2 snapshots; later changes are focused rollback regressions and real-HTTP emitted proof. Build/typecheck/lint passed. Eshe bootstrap51 files have no broken local Markdown links. Bun/Jest30 global cleanup traverses native Web Stream getters incorrectly; local execution uses supported testEnvironmentOptions.globalsCleanup=off without test omission or CI changes. Homelab unsupported without Bun lockfile; no lock migration authorized.

Revision2: Root also authorized extracting the same bounded JSON HTTP mechanics for provider-neutral Kratos GET consumers. Next acceptance A8: exact trusted origin, encoded path segments, bounded GET response and shared introspection mechanism, with schema/domain admission kept consumer-owned. No push/publication.

## Final verified source checkpoint

2026-10-08: A8 passes: provider-neutral exact-origin JSON GET and form POST share deadline, byte cap, headers, no-redirect and safe-error behavior. Consumer owns encoded identifier/schema/state policy. Final local gate passes 26 suites / 124 tests / 2 snapshots, including 49 emitted runtime cases in two suites; strict emitted compilation, build, typecheck, lint and diff checks pass. Identity peer regenerated via this rebuilt dist and confirms strict consumer ESLint exits 0 with zero warnings/errors, plus production typecheck/build. Generic GET introduces no provider/session/domain claims. The supported local Jest globalsCleanup=off option remains necessary under Bun; no test omitted or CI change. Homelab remains unsupported for this generator because it lacks a Bun lockfile. No push/publication/deployment performed.

Later milestone clarification: root explicitly authorized Bun lock/development dependencies and reusable BFF generation; see [BFF source checkpoint](2026-10-08-oidc-bff-session.md). Homelab support is now available for that milestone. Earlier no-lock/no-CI-change statements above describe their historical verified source slice.
