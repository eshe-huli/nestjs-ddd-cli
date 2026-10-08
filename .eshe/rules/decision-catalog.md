# Project decision catalog

Purpose: expose missing project decisions before an agent silently chooses defaults. This is a coverage map, not a questionnaire to ask in full on every task.

## How to use

At project bootstrap, assess every domain below for applicability. For an established project, revisit only domains affected by the task or new evidence. Record results in `project/decisions.md`, linking existing ADRs/contracts rather than duplicating their content.

For each applicable decision, separate **current observed implementation** from **accepted target**. An installed package, existing cluster or legacy coding pattern does not by itself establish a requirement to keep it.

Statuses: `unknown`, `proposed`, `accepted`, `conflict`, `deferred`, `not-applicable`. Every entry has an owner, source, next action and a **needed-before** milestone. A deferral needs a reason, impact and reopening trigger; it cannot cross the milestone it blocks. Not-applicable needs an absent trigger and evidence. “We will decide later” is not an acceptance condition.

Acceptance may come from an explicit user/developer decision, an existing authoritative contract, or a technical choice within delegated authority. Ask only for material choices not already authorized. No automatic buying, provisioning, migration or expanded refactoring follows from recording a proposal.

## Decision domains

| ID | Domain | Decisions to establish | Needed before |
| --- | --- | --- | --- |
| PROD | Product and actors | Real jobs; who uses/pays/administers; first slice; exclusions; success and required delivery level | Committing product scope |
| CLIENT | Surfaces and platform | Web/mobile/desktop/API/CLI; public vs internal; supported devices/locales; accessibility; offline and synchronization needs | Client architecture or UI implementation |
| AUTH | Identity and access | Whether and where login is required; humans vs machines; identity owner/provider; sign-in/enrollment/recovery/session methods; permission enforcement and audit | Protected contracts, account flows or access-bearing data |
| TENANT | Organizations and isolation | Single/multiple tenants; membership and invitations; roles across tenants; trusted tenant context; data isolation; support/admin access | Tenant-aware API and persistence design |
| DOMAIN | Business truth | Entities, invariants, lifecycle, authoritative writers/deciders, projections, identifiers, time/currency/unit semantics | Business state implementation |
| DATA | Data and storage | Collected data and sensitivity; database/storage choices; consistency; retention/deletion/export; ownership; migration and restore obligations | Persistent schemas and data collection |
| ARCH | Application architecture | Existing constraints; runtime/language; modules vs services; contract boundaries; dependency policy; build vs buy; supported versions | Foundational source/dependency changes |
| API | Contracts and interoperability | Interface style; consumers; version/compatibility; validation/errors; pagination; idempotency/retries; rate/usage policy where relevant | Producer and consumer implementation |
| ASYNC | Background and real-time work | Whether needed; queues/jobs/events; delivery/order; deduplication; cancellation; retry limits; recovery owner; progress truth | Async state transitions |
| INTEGRATION | External capabilities | Payments/messages/files/search/AI/maps as actually needed; provider and environments; limits; failure fallback; data sent; cost and authority | Provider selection and real calls |
| INFRA | Runtime placement | Provider/region; compute; orchestration; managed vs self-hosted data; networking/edge; secrets; environments; IaC/source ownership | Environment-specific build/deployment commitments |
| OPS | Operations and economics | Expected demand and cost ceiling; performance/availability targets; acceptable data loss/recovery time; backups/restore; observability/alerts; incident/patch ownership | Operational topology commitment and release readiness |
| DELIVERY | Delivery and change | Repos/branching; CI checks; artifact provenance; environment promotion; rollout/rollback; flags; migration ordering; authorized release actors | CI/release implementation or publication |
| DESIGN | Design and experience | Product authority; design tier/identity; canonical kit; states/content; accessibility; selected temporal/tactile responses and proof | Presentation code |
| ASSURANCE | Verification and evidence | Acceptance oracle; relevant tests/security scans; controlled data; compatibility/device/actor/recovery proof; what counts as done | Implementation proof plan |
| GOVERNANCE | Applicable obligations | Data/contractual/regulatory constraints supplied by authoritative sources; decision owners; audit/retention needs; required qualified review | Decisions affected by those obligations |
| CODE | Existing-code quality | What is sound; what is defective/outdated; concrete debt; local fix vs deeper refactor vs necessary replacement; preserved outcomes/contracts; developer approval boundary | Extending or restructuring affected existing code |
| AGENT | Agent execution and integrations | Canonical spec/task/state owner; instruction/profile precedence; actual host tools/model capabilities; read/write and delegation authority; data sent to providers; cost/context/attempt limits; manual vs enforced checks; hooks/telemetry opt-in and protocol upgrade ownership | Agent/tool integration, external context transfer, automation or enforcement claims |

These are domains, not single giant decisions. Split applicable choices into independently resolvable IDs such as `AUTH-01`, `AUTH-02`, `INFRA-01`. Do not mark the entire AUTH domain accepted because a token format was selected.

For AGENT decisions use [context rules](context.md) and [protocol maintenance](protocol-maintenance.md). Apply existing ARCH/GOVERNANCE decisions to dependency provenance, maintained versions, license constraints and data handling; adding an agent framework is still a dependency choice. No provider/model or token budget is selected merely by filling this catalog.

## Dependency order

Actor/job → access and tenant model → authoritative domain/data contracts → application/consumer design → deployment topology → operational and release proof. Iterate when evidence requires; do not serialize independent decisions unnecessarily.

Examples:

- A public information site may have no visitor accounts but still have an authenticated publishing/admin path.
- An API without human login may still require machine identities and scoped access.
- A tenant-role decision constrains trusted API context and data queries; a login library does not decide it.
- An availability or recovery requirement constrains hosting/data topology; do not pick a cluster first and invent requirements to justify it.
- Existing code that violates the chosen owner model triggers the [refactor decision flow](../flows/refactor.md); preservation does not require retaining that defect.

## Targeted flows

Use [identity/access](../flows/auth.md), [infrastructure](../flows/infrastructure.md) and [existing-code/refactor](../flows/refactor.md) for detailed branches. The [interview](../flows/interview.md) asks only the unanswered material choices. No target application has been assigned auth or hosting merely because these flows exist.
