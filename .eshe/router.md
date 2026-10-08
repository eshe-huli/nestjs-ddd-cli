# Task router

Route by observable impact. Filename, task size, confidence and a user saying “simple” do not erase consequences. More than one row may apply.

## First pass

1. Identify output: explanation/review, product decision, source change, interface change, data change, operational action, or resumption.
2. Identify impact flags: behavior, visual identity, shared component, persistence/schema, API compatibility, authentication/authorization, tenant boundary, money/health truth, external mutation, destructive action, runtime rollout.
3. Select the primary flow below and add every applicable overlay. Do not let a UI route hide a schema change or a release route hide an authorization change. Choose [explore, quick, standard or extended](rules/work-tracks.md) by uncertainty and consequences.
4. Record unknowns. Inspect before classifying them low risk; block only the dependent action if uncertainty remains material.

| Trigger | Primary flow / overlay | Required precondition |
| --- | --- | --- |
| Missing project context or `.eshe` | [Bootstrap](flows/bootstrap.md) | Authorized project work and correct repository root |
| Material unknown intent | [Interview](flows/interview.md) | Retrieve available answers first |
| Research, options, feasibility or understanding is the deliverable | [Explore](flows/explore.md) | Question, evidence boundary and stop condition |
| Multiple steps, sessions, owners or repositories | [Planning](flows/planning.md) | Requirement coverage, dependencies and readiness |
| Intended behavior changes or spec/code disagreement | [Spec change](flows/spec-change.md) | Canonical requirement baseline and actual authority |
| Missing project technology/operating choices | [Decision catalog](rules/decision-catalog.md), then affected flow | Register applicability, owner and needed-before milestone |
| Identity/login/session/permission decision | [Auth](flows/auth.md) | Actor/operation/data-scope and existing identity ownership |
| Hosting/runtime/topology decision | [Infrastructure](flows/infrastructure.md) | Requirements, existing estate, cost and operating responsibility |
| Any presentation change | [UI](flows/ui.md) | Tier A/B/C, product authority and UI-kit decision |
| Bug, feature, integration or behavior-preserving refactor | [Change](flows/change.md) | Owner chain, invariants and proof plan |
| Architecture/boundary/technology choice | [Architecture](flows/architecture.md) | Problem, constraints and alternatives |
| Existing implementation debt or deeper restructuring | [Refactor](flows/refactor.md) | Concrete evidence; developer agreement for expanded scope |
| Schema/data/API-breaking migration | [Migration](flows/migration.md) | Consumer/data inventory and compatibility/recovery plan |
| CI, config, deployment or infrastructure | [Release](flows/release.md) | Exact target and change authority; separate source vs execution |
| Interrupted task, new agent or conflicting prior status | [Resume](flows/resume.md) | Actual task record and fresh baseline |
| Candidate result or substantive review feedback | [Review](flows/review.md) | Contract pass, quality pass and actual evidence |
| Adopting/upgrading Eshe, another workflow or host hooks | [Protocol maintenance](rules/protocol-maintenance.md) | Existing authorities, reviewed differences and real capability support |
| Explanation or review only | Lifecycle with relevant domain flow in read-only mode | No mutation implied by findings |

## Risk overlays

- **Authorization / tenant / money / health:** identify authoritative owner and actor, denied cases, replay/concurrency or failure behavior as applicable. Load the project's explicit domain profile; never copy another product's rules by name similarity.
- **Destructive / external:** prepare concrete reviewable changes and verify existing authorization before execution. A plan to deploy is not deployment approval.
- **Shared source:** inspect dependent consumers and verify preservation in representative affected contexts.
- **Unavailable tooling:** choose a valid supported alternative or record the missing proof; do not weaken the claim to hide the gap.

## UI tier is separate from risk

Tier C can still require sensitive-domain proof, for example changing a displayed payment status or consent wording. Tier A can be local and reversible. Select the design research tier by the nature of the presentation change, then combine its gates with the real behavioral risk.

## Compact route examples

| Request | Route |
| --- | --- |
| Button spacing inside approved component | UI C + shared-source overlay if token is shared |
| New screen in established app | UI B + change for connected behavior |
| Replace visual identity | UI A; preserve contracts unless change authorized |
| Rename persisted account field | Migration + change; release only for authorized rollout |
| Fix permission-denied bug | Change + authorization overlay; UI overlay only if presentation changes |
| “Just increase a timeout” in settlement | Change + financial/state impact investigation |
| Green tests, user requested live release | Release and runtime/actor gates remain required |
| Public site with no visitor accounts | Auth surface inventory; separately resolve admin/publishing access |
| “AWS, VPS or Kubernetes?” | Infrastructure axes and whole-topology comparison |
| Small feature exposes duplicated business rules | Change + refactor assessment; ask only for expansion beyond authority |
