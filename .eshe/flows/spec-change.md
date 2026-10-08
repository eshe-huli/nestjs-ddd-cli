# Requirements evolve without losing intent

Trigger: adding/changing/removing behavior, discovering a code/spec mismatch, overlapping changes, or closing a material feature. For unchanged narrow corrections, reference the existing requirement and record no behavior delta.

## Separate three facts

- **Accepted requirement:** what an authorized source says should be true, with ID, revision and owner.
- **Proposed delta:** additions, modifications, removals or renames relative to a specific baseline. A proposal does not overwrite accepted intent.
- **Observed delivery:** what a particular source build/environment/actor currently demonstrates. It may lag or violate the requirement.

Use the project's existing spec authority. Only if absent and needed, create a scoped requirement record under `.eshe/specs/`. Larger changes may use `.eshe/changes/<id>/`; quick work keeps the delta inline in its task. Templates: [requirement](../templates/requirement.md), [change record](../templates/change.md).

## Procedure

| Step | Action | Gate |
| --- | --- | --- |
| SC1 Baseline | Locate canonical requirement IDs/revisions, actual behavior, owners and overlapping active changes | Observation and intent are separately sourced |
| SC2 Delta | State before/after, reason, actor scenarios, removals, preserved outcomes and affected consumers | Each delta maps to the locked request; removal is explicit |
| SC3 Authority | Record existing authorization or obtain a missing material decision | Do not ask again for an already authorized change; unresolved delta cannot govern implementation |
| SC4 Propagate | Revise affected plans, decisions, tests, docs and evidence freshness links | No stale dependent artifact still appears current |
| SC5 Reconcile | Compare authorized target with actual diff and observed behavior | Missing behavior is fixed; unintended behavior is removed or explicitly agreed; unresolved conflict blocks affected closure |
| SC6 Close record | Update canonical target under its owner's process; attach delivered-baseline evidence and link the completed change | Complete at the requested delivery stage; no implied production rollout |

If code differs from the spec, determine which is defective from authority and evidence. Never automatically change the spec to match code. If the target is accepted before implementation, label delivery `not-run`; if source is complete but production lags, record both rather than calling the target deployed.

Before merging competing deltas, compare their baseline revisions and semantic requirements, even when Git has no textual conflict. Rebase the proposal against the newer target and rerun impacted checks. Deleting or renaming a requirement preserves its history and updates dependent references.

After closure, retain a stable record with status and receipts; an archive move is optional and must repair links. Archiving means record organization, not acceptance, implementation success or permission. Cancellation preserves the proposal as cancelled and does not merge it into accepted requirements. Source-controlled records follow the project's publication/retention rules.
