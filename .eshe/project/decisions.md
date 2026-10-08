# Project decision register

Verified 2026-10-08; accepted scope from current user authorization and root delegation. Code is observation, not automatic authority.

| ID | Domain/question | Observation | Target/status | Authority | Needed before |
| --- | --- | --- | --- | --- | --- |
| GEN-01 | PROD / CLIENT / ARCH | Recipe dispatcher and static templates | Additive oauth2-token-introspection; existing recipes preserved; accepted | User generator-first rule/root scope | Implementation |
| GEN-02 | AUTH / DOMAIN / TENANT | No generic opaque-token mechanism exists | Transport returns evidence; mandatory consumer policy owns principal, session, tenancy and permissions; accepted | Root task | Template contract |
| GEN-03 | API / INTEGRATION | RFC7662 fields optional; Hydra v26.2.0 emits ext/client_id/token_use | Bounded private POST form; typed optional claims; no invented grant/session fields; accepted | RFC7662 and pinned official source | Behavior proof |
| GEN-04 | INFRA / OPS | K3s private admin can be HTTP | HTTPS default; explicit trustedInternalHttp opt-in for verified exact private endpoint; accepted | Root clarification | Configuration proof |
| GEN-05 | ASSURANCE / CODE | Existing preflight recipe tests | All-target conflict/symlink preflight, write rollback, emitted strict compile/runtime cases and related regressions; accepted | Root task/AGENTS | Handoff |
| GEN-06 | DATA / ASYNC | No persistence/event change | No cache, retries, schema or event infrastructure; not applicable beyond timeout/stream cleanup | Bounded task | Implementation |
| GEN-07 | DELIVERY / GOVERNANCE | Existing CI npm convention | Bun local; retain CI/container workflows; review before push; no package publication; accepted | User/root/AGENTS | Delivery |
| GEN-08 | DESIGN | Headless server change | UI-kit/research not applicable | Slice inventory | Implementation |
| GEN-09 | AGENT | Isolated origin/main 0ca15f7 worktree | Generator-only ownership; preserve siblings/consumers; accepted | Root delegation | All actions |

Required decisions are resolved. Homelab offload requires a Bun lockfile; inspect compatibility before offload. A missing lockfile does not authorize package-manager migration.
