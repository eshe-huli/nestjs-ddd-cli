# OAuth2 token introspection recipe

ID GEN-20261008, revision 1; owner generator worker, reviewer root. State: implementing; authorized user Ory split and root generator assignment. Worktree /Users/macbook/development/command/.codex-worktrees/nestjs-ddd-oauth2-introspection-20261008, branch feat/oauth2-token-introspection-20261008, freshly fetched origin/main baseline 0ca15f7. Original checkout clean. No consuming-service, infra, CI/container manager or unrelated recipe change. No push or publication before review.

Locked outcome: additive bounded RFC7662 mechanism and consumer-owned principal seam through supported ddd recipe, with safe generation and executable proof. Extended track for shared authentication infrastructure; change/auth overlays. All implementation-critical decisions [GEN-01..09](../project/decisions.md) are resolved; no UI presentation changes. Upstream protocol docs initialized only because this authorized repository had no .eshe.

| Acceptance | Outcome | Required proof | Status |
| --- | --- | --- | --- |
| A1 | CLI listing/application/dry-run integrate new recipe | Rebuilt CLI integration tests | Pending |
| A2 | Generator protects owners, no partial writes | Conflict, rerun, symlink, rollback tests | Pending |
| A3 | RFC7662 bounded transport, no cache/leaks | Emitted behavior spec, timeout/stream/redaction/denial cases | Pending |
| A4 | Consumer owns provider/principal/session/domain policy | Typed evidence + required validate callback, docs/spec | Pending |
| A5 | Nest sync/async owner composition | Strict output compilation/module proof | Pending |
| A6 | Preserve existing generator behavior | Related recipe/doctor checks, lint/typecheck/build | Pending |
| A7 | Reviewable diff and handoff | Exact command/path/check receipts; no push | Pending |

Next permitted action: implement and verify A1..A5 before checks A6 and root review A7. Dependencies are available locally via existing dependency store; no installation/lock migration. No secret values logged/stored. Proposed transport supports explicit trusted internal HTTP; consumer policy covers exact issuer/client/audience/expiry/access-token type and any Ory session binding.

Progress: local candidate in progress. CI/publication/deployment/runtime/actor evidence not yet established by this generator slice. Close only after required verification and report.

## First verified milestone and review

2026-10-08: Root approved the transport/module contract and Identity consumption. Root required successor-safe rollback; inode/timestamp/content receipts now preserve replacement and modified owner files and report rollback conflict. Focused recipe10 cases pass with strict emitted output and34 consumer behavior cases. Earlier full repository gate passed26 suites/122 tests/2 snapshots; later changes are focused rollback regressions and real-HTTP emitted proof. Build/typecheck/lint passed. Eshe bootstrap51 files have no broken local Markdown links. Bun/Jest30 global cleanup traverses native Web Stream getters incorrectly; local execution uses supported testEnvironmentOptions.globalsCleanup=off without test omission or CI changes. Homelab unsupported without Bun lockfile; no lock migration authorized.

Revision2: Root also authorized extracting the same bounded JSON HTTP mechanics for provider-neutral Kratos GET consumers. Next acceptance A8: exact trusted origin, encoded path segments, bounded GET response and shared introspection mechanism, with schema/domain admission kept consumer-owned. No push/publication.
