# Adaptive interview

Trigger: a missing answer could materially alter behavior, scope, acceptance, architecture or risk.

Use [the decision catalog](../rules/decision-catalog.md) to identify unanswered domains, and persist decisions in `project/decisions.md`. Do not rely on the model remembering to ask about auth, hosting, recovery or existing-code quality. Inspect settled decisions first; a missing decision blocks only its dependent work.

## First classify each unknown

| Kind | Agent action | Example |
| --- | --- | --- |
| Discoverable fact | Inspect authoritative material | Which package owns the button? |
| Expert implementation choice within authority | Recommend and decide with concise rationale | Reuse the existing variant rather than introduce another primitive |
| Owner-only intent or tradeoff | Ask a focused question | Is the milestone a local prototype or a deployed actor flow? |
| Required authority or credential | Prepare dependent work; request only the missing authorization/input | Is the prepared destructive cutover authorized? |
| Nonessential uncertainty | State a reversible assumption and its review trigger | Working name while designing the protocol |

Unknown security, tenancy, financial truth or irreversible data consequences cannot be silently classified as harmless assumptions.

## Interview branches

Ask only the unanswered fields needed by the current slice. Usually one to three related questions per exchange; do not unload the whole table.

| Context | Questions to resolve | Output |
| --- | --- | --- |
| New project | Who is it for, what job hurts, what changes, what is explicitly out, how will success be observed? | Vision and first bounded slice |
| Existing project | What exact outcome/defect, which actor/state, what must survive, what is the authoritative reference? | Change contract |
| UI | Preserve or replace direction, which surface/device, which design authority and kit, which states matter? | Research tier and design inputs |
| Migration | Which persisted truth/consumers, tolerable compatibility window, failure/recovery constraints, authorized environment? | Migration contract |
| Architecture | Which quality constraint cannot be met today, measured demand, ownership, operations capacity, alternatives? | Decision criteria |
| Identity/access | Which actors/operations need identity, who owns it, how do sign-in/session/recovery and permissions work? | [Auth flow](auth.md) decision set |
| Infrastructure | Existing estate and constraints; provider, compute, orchestration, data services, environments and operator? | [Infrastructure flow](infrastructure.md) topology decision |
| Existing implementation debt | What is demonstrably wrong; can a sound bounded fix satisfy the task; is deeper scope justified? | [Refactor proposal](refactor.md) for developer decision when expansion is needed |
| Delivery | Local artifact, tested source, CI, staged release, or actual runtime/actor outcome? | Required proof level |

## Question form

State the missing decision, why it changes the result, and two or three viable options when helpful. Recommend one when expertise supports it. Allow a free answer. Never ask the user for a file path, fact or preference already available in authorized context.

Record answer + source + date + affected acceptance IDs. An unanswered question is not approval. Elapsed time is not approval. A user correction updates only affected decisions and invalidates their dependent proof.

## Decision completeness check

For a planned capability, list every value it must produce, compute, display or persist. Name its authoritative input, derivation or accepted rule. A missing source identifies a decision or contract still owed; do not fabricate a plausible value.

For substantial new work, maintain a small dimension ledger covering applicable functionality, data/lifecycle, interfaces, authorization, validation, integrations, failure/recovery, scale, security, observability, configuration and UX. Public discovery/SEO applies only when it serves the product. Each dimension is `discovered`, `answered`, `recommended`, `settled`, `unknown` or `not-applicable`, with source or reason. This is a completeness check, not a requirement to ask a question in every category.

Exit gate: each material unknown is resolved, explicitly blocking a named action, or a justified reversible assumption. Stop interviewing when the next bounded action is valid.
