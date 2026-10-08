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

| GEN-10 | API / INTEGRATION | Kratos current session and identity reads need the same bounded mechanism | Export exact-origin encoded-path JSON GET and share POST mechanism; schemas/state/policies consumer-owned; accepted | Root explicit additive authorization | Generic transport proof |

Required decisions are resolved. Homelab offload requires a Bun lockfile; inspect compatibility before offload. A missing lockfile does not authorize package-manager migration.

| GEN-11 | AUTH / API / ASYNC | Patient reviewed OIDC and opaque Lua core need a single distribution owner | Additive framework-independent oidc-bff-session with exact trusted HTTPS endpoints, immutable configuration, bounded Valkey, durable retired-token subset and explicit provider-cutoff custody guard; accepted | Root explicit delegation; reviewed Patient core freeze | Emitted verification |
| GEN-12 | ASSURANCE / DELIVERY | Emitted specs use Bun and exact jose/Redis runtime dependencies | Exact dev dependencies, Bun lock, preserve npm-lock provenance and Node CI matrix, test-job setup-bun1.4.0 only; accepted | Root explicit approvals | Established CI |
| GEN-13 | DATA / INFRA | Redis JSON contains plaintext secrets; key hashes do not encrypt values | Production consumption needs authenticated app-scoped ACLs, private/TLS transport and verified encrypted storage/backup custody; no encryption redesign or activation in generator slice; accepted | Root live readiness audit | Deployment acceptance |
