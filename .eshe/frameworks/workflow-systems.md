# Workflow-system decision cards

Checked 2026-09-24. These cards adapt selected mechanisms; they do not install or invoke the named products. The rules and flow links below are Eshe's own protocol choices. Load only the card that resolves a current process gap.

| Card / primary source | Apply / question | Eshe output | Reject when / do not use as |
| --- | --- | --- | --- |
| W1 [Spec Kit](https://github.github.com/spec-kit/reference/agentic-sdd.html) | Several artifacts govern one outcome: do requirements, design and tasks agree? | [Readiness and traceability review](../flows/planning.md) | Reject uncovered/orphan/conflicting items; do not turn an implementation checkbox into reviewer approval |
| W2 [OpenSpec concepts](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md) | Existing behavior changes: what delta applies to which accepted baseline? | [Requirement change and reconciliation](../flows/spec-change.md) | Reject stale/conflicting or unauthorized deltas; do not rewrite intent to match a defect or treat archive as release |
| W3 [GSD architecture](https://github.com/gsd-build/get-shit-done/blob/main/docs/ARCHITECTURE.md) | Long tasks or handoffs: what context and dependencies does the next step need? | [Action packet](../templates/context-packet.md), [dependency plan](../templates/plan.md) | Reject missing critical inputs or unsafe shared writers; do not require subagents or a fixed context-window assumption |
| W4 [Superpowers](https://github.com/obra/superpowers) | Candidate work looks plausible: is it the right outcome and is the implementation sound? | [Contract then quality review](../flows/review.md) | Reject unsupported claims and unresolved required findings; do not force TDD for every copy edit or delete existing work |
| W5 [BMAD planning](https://docs.bmad-method.org/plan/choose-a-planning-path/) | How much planning does this job need? | [Work track](../rules/work-tracks.md), bounded [exploration](../flows/explore.md) | Reject missing shared decisions; do not require a full PRD for an obvious local fix or let small size hide risk |
| W6 [Kiro steering](https://kiro.dev/docs/steering/) and [hooks](https://kiro.dev/docs/hooks/) | Which guidance should load and which checks can this host really enforce? | [Context policy](../rules/context.md), [adapter contract](../templates/adapter.md) | Reject unverified capabilities; do not confuse advisory prompts or after-action hooks with prevention |

These mechanisms complement the architecture and product/design cards. They do not select authentication, Kubernetes, a product feature or a UI identity. Those choices remain in the project's own decision register and domain flows.
