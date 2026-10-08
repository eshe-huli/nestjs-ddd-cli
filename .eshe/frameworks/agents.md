# Agent decision architecture

## G1 — Explicit routing and small workflows

Use a fixed route when task categories and required steps are known; allow judgment within bounded decisions. Anthropic distinguishes predefined workflows from agents that dynamically choose their process and describes chaining, routing and evaluation patterns. Eshe adapts that distinction into a task router and workflow gates. This does not establish that any particular model will obey them. [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents).

## G2 — Guarded state transitions

Represent the task's state, triggering event and required guard explicitly. State-machine semantics make allowed transitions inspectable; W3C SCXML formalizes states, events and conditional transitions. Eshe borrows the concept, not an XML implementation or a claim of SCXML conformance. [W3C SCXML](https://www.w3.org/TR/scxml/).

## G3 — Small action packet

Eshe synthesis from the local scope, architecture, handoff and orchestration skills:

- Current outcome and requirement IDs.
- Current state and exact next step.
- Relevant accepted decisions and protected invariants.
- Read inputs and allowed write boundary.
- Expected artifact and proof method.
- Stop/escalation conditions.

Load that packet plus the applicable flow. Do not repeatedly load every skill or ask the model to improvise workflow selection from a giant prompt.

Version 0.2 makes this concrete through [context rules](../rules/context.md), the [packet template](../templates/context-packet.md) and [planning readiness](../flows/planning.md). Additional sourced [workflow cards](workflow-systems.md) cover specification evolution, reviews, proportionality and integration contracts.

## G4 — Verification independent of persuasive prose

Bind evidence to task ID, requirement, baseline, environment, actor and data conditions. Verify actual files/results. A polished summary or another agent agreeing is not evidence. Use independent review for consequential decisions where justified; it does not replace real tests or actors.

## Selection and rejection contract

| Card | Apply / decision question | Output | Reject when | Do not apply as |
| --- | --- | --- | --- | --- |
| G1 | Repeated known task families: which steps should be fixed? | Route and bounded workflow | Misclassified/mixed tasks lose required gates | A reason to force open research into an inflexible implementation path |
| G2 | Tasks can advance incorrectly: what event and guard permit each transition? | State/event/guard table | A required transition is unguarded or recovery is impossible | Proof that a prose state label enforces execution |
| G3 | Context is large or resumption is unreliable: what does the next action actually need? | Compact action packet | It omits a relevant constraint or loads unrelated history | Mandatory file creation for every trivial question |
| G4 | Completion depends on verifiable claims: what observation could disprove success? | Claim/evidence mapping and review | Receipt is stale, irrelevant or self-asserted without observation | An independent reviewer ritual for every low-impact edit |

## Runtime design — specified, not implemented

A future local runner should separate four responsibilities:

| Responsibility | Owns | Must not pretend to prove |
| --- | --- | --- |
| Router | Typed impact flags and applicable gate set | Correct classification from vague text alone |
| State store | Versioned task/decision/evidence records, atomic writes, single writer or compare-and-swap | Tamper resistance when the agent can edit the store |
| Validator | Schema, IDs, required fields, allowed transitions, evidence presence/freshness and configured checks | Truth of arbitrary prose or adequacy of fake receipts |
| Agent/tool adapter | Next action packet and actual host capabilities/permissions | Permission derived solely from a Markdown instruction |

Before implementation, define a machine schema for task, decision, evidence and transition receipts. The minimum candidate commands are `init`, `route`, `next`, `record`, `check` and `resume`; these are design names, not installed executables.

## Enforcement boundary

Document compliance is voluntary. A CLI validator can catch structural errors but is bypassable if the agent controls its evidence and execution path. Stronger enforcement needs trusted checks/tool mediation and protected authority records. It still cannot remove the need for model judgment or human decisions.

Never run arbitrary commands read from untrusted evidence files. Resolve paths within the authorized project, detect symlink escapes, keep credentials out of records, and bind checks to the actual changed baseline. These are requirements for the future runner, not capabilities delivered by this folder.

Use the [evaluation protocol](../evaluation/README.md) before making lower-model reliability claims.
