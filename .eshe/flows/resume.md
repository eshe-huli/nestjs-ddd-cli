# Resume and recover alignment

Trigger: new session/agent, compaction, interruption, changed source, conflicting summaries or detected drift.

1. Read the original locked request, latest explicit corrections, active task, accepted decisions and next action. Do not resume solely from an agent's completion summary.
2. Inspect current repository/worktree and external operation state relevant to the task. Compare baseline, dirty changes, deployment identity and evidence dates/conditions.
3. Classify differences: authorized changes, unrelated user work, superseded decisions, stale evidence, unknown external outcomes. Preserve existing work.
4. Invalidate affected proof only. If a requirement changed, revise that acceptance item with provenance; do not edit success criteria to fit existing output.
5. For uncertain consequential operations, look for receipts/current state before retrying. Avoid duplicate payment, migration, release or message effects.
6. Re-run routing if scope/risk changed. Resume the earliest unmet gate with a concrete next action.

Use [context rules](../rules/context.md) and the [action packet](../templates/context-packet.md) for substantial handoffs. Refresh a scoped codebase map rather than trusting cached observations. Recalculate the [ready plan steps](planning.md) from current dependencies; the first unchecked item is not necessarily executable. Reconcile manual spec/code edits through [spec change](spec-change.md).

## Drift repair

Compare current work with original acceptance IDs. Keep useful in-scope work; park unrelated additions. Do not auto-delete user changes, create a second task/goal for the same outcome, or invent fresh work to avoid admitting a miss.

Record: preserved result, invalidated evidence, blocker if any, and exact next step. Keep summaries short enough that another agent can act without loading the full historical transcript.

Exit gate: the agent can identify the current intent, source baseline, valid proof and next permitted action. Status is a navigation aid, not the work itself.
