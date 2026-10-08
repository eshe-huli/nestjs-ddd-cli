# Context that survives a new session

The whole skill inventory is research input, not an execution prompt. Keep a small always-read core and load the selected flow, relevant decisions and actual source ownership chain on demand. File patterns are hints; semantic risk can require another overlay.

For a substantial handoff or context reset use [the action packet](../templates/context-packet.md). It contains outcome/IDs, baseline, cursor, governing decisions, input links, allowed writes, proof and stop conditions. Reuse task fields through links instead of maintaining a second authority. Preserve material constraints even when they conflict; never summarize the conflict away.

## Budget and freshness

- Record actual host/model context and tool limits if available, otherwise unknown. Do not assume another tool's context size or invent token usage.
- Load the core, packet and owning sources first; reserve capacity for execution and receipts. Split a large slice or checkpoint before the host warns of exhaustion. Essential contracts cannot be dropped simply to fit a preferred budget.
- Summarize previous attempts as observation, hypothesis, action and result. No hidden reasoning transcript, raw secrets or indiscriminate session-history ingestion.
- A map or summary records the source revision/date. Refresh affected links on source, contract, environment or decision changes. A cached map directs inspection; it never overrides fresh source.

## Existing repositories

Map only what the task needs: actual repo roots, entrypoints, modules and truth owners, contracts/consumers, data, integrations, tests/run commands, deployment links, known debt and unknowns. Broaden on evidence. Do not document the entire estate before a localized fix. Separate observed conventions from required standards so bad patterns are not propagated as instructions.

## Handoff and multiple agents

Use delegation only when permitted and useful. Assign one owner per task cursor and explicit write ownership; include sibling work/protected paths and the current revision. Results return changed artifacts, requirement/evidence IDs, blockers and next action. Parent verifies claims and integrates once. Shared-state writers need serialization; worktrees isolate files, not shared databases or external effects. Cancellation stops owned work without deleting another actor's edits.

A checkpoint is complete only when another session can re-establish current facts and the next action through [resume](../flows/resume.md). Status text alone does not establish that commands finished. For unknown external outcomes, inspect receipts before retrying.
