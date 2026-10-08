# Task lifecycle

Each substantial task has exactly one current state, a revision, its source baseline, and one next action. These are protocol requirements; this version does not enforce them in software.

| State | Permitted work | Gate to next state | Next |
| --- | --- | --- | --- |
| `discover` | Read scope, instructions, repo state and existing authorities | Known project/repo boundary and requested deliverable | `clarify` |
| `clarify` | Resolve only material missing facts; use interview flow | Outcome, exclusions, authority and acceptance are sufficient for this slice | `route` |
| `route` | Classify task, track, risks, UI tier and profiles | Selected flow plus every applicable overlay, with reasons | `prepare` |
| `prepare` | Inspect owner chain and implementation quality; research; specify proof/recovery; resolve catalog decisions; check plan/requirement consistency | Flow preconditions, needed-before decisions, next-step dependencies and any required refactor expansion agreement satisfied | `execute` |
| `execute` | Perform authorized bounded changes | Candidate artifact or behavior exists and passes scope/preservation review | `verify` |
| `verify` | Collect real evidence; review contract and implementation quality | All required checks and integration proof pass for current baseline | `close` |
| `close` | Reconcile original request, canonical specs, diff, receipts and claimed delivery stage | Every required outcome proven or explicitly changed/deferred by user; accepted intent and observed delivery recorded distinctly | `complete` |
| `complete` | Report bounded result | A new request starts a new task; corrections reopen affected work | terminal |

Read-only research tasks use `execute` to produce the requested analysis; the state does not authorize source edits. Clarification may pass immediately when the existing request is sufficient.

Use [tracks](work-tracks.md) to scale artifact size, [planning](../flows/planning.md) for readiness, [review](../flows/review.md) for verification and [spec change](../flows/spec-change.md) for reconciliation. A quick task may record these checks inline; no new mandatory file or user approval is implied by each state.

## Exceptional transitions

| Event | Transition | Required record |
| --- | --- | --- |
| Verification fails | `verify → execute` | Failed claim, new hypothesis and smallest repair |
| New risk or missing prerequisite discovered | Any active state → `route` or `prepare` | Classification change and affected gates |
| User changes outcome | Any active state → `clarify` | Revised acceptance IDs and superseded decisions |
| Baseline changed externally | Any active state → `discover` | What changed and which evidence is invalidated |
| Missing required user decision or external capability | Active state → `blocked` | Missing item, why it matters, owner/unblock event, resumable state |
| User pauses | Active state → `paused` | Exact state and next action |
| User cancels | Active state → `cancelled` | Preserved work and stopped owned actions |
| Blocker resolved or user resumes | `blocked/paused → discover` | Verify current baseline, then resume earliest invalidated gate |

Task record states are not commands to host goal/automation tools. Host lifecycle rules may differ and must be followed separately.

## Transition receipt

Record task ID, revision, prior/new state, triggering event, satisfied gate IDs, evidence IDs, actor, source baseline and next action. A missing field means the transition is incomplete. Multiple writers must not update one task cursor concurrently; assign one owner and reconcile revisions.

## Evidence status

Use `not-run`, `pass`, `fail`, `stale`, `blocked`, or `not-applicable`. For `not-applicable`, name the trigger that is absent and supporting evidence. Lack of access, time, tool availability or a failed check is never a reason for `not-applicable`.
