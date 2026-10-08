# Existing-code assessment and deeper refactor

Trigger: work touches existing implementation and reveals concrete quality/ownership problems, or the developer explicitly requests restructuring. Preserve required outcomes and contracts; implementation choices are open to evidence-based change. Existing defects are not acceptance criteria.

## Inspect before choosing

Read the affected owner/contract/consumer chain and dirty baseline. Classify findings separately:

- Required product behavior, data, security invariants and compatibility that must survive.
- Sound implementation worth retaining.
- Demonstrated defect or structural debt: duplicated business truth, repeated inconsistent validation, wrong responsibility, fragile coupling, untestable side effects, unsupported dependencies, or a violated project standard with an actual consequence.
- Preferences or unproven hypotheses. “I dislike this framework” or “a rewrite would be cleaner” is insufficient evidence.

For each material finding, record concrete location, observed mechanism, consequence for the requested task, confidence and a falsifiable check. Inspect enough of the dependency chain to make the proposed scope reviewable.

## Decide proportional action

| Situation | Action | Authority boundary |
| --- | --- | --- |
| Small corrective change needed by current task, within existing authorization | Fix the owning implementation and verify affected behavior | No redundant permission request |
| A sound local implementation can complete the task, but deeper refactor has demonstrated value beyond it | Prepare a bounded expansion proposal and ask the developer | Do not execute expanded scope before acceptance; independent in-scope work may continue |
| A sound result cannot be delivered without deeper structural change outside authorization | Explain why the local patch is inadequate, prepare the expansion proposal, and block only dependent work | Do not preserve a known bad path merely to claim completion |
| Developer already authorized this deeper refactor and boundaries remain unchanged | Update task/decision records and proceed | Ask again only for newly material scope/risk |
| Only stylistic preference or unrelated debt found | Record briefly only if useful; do not launch a refactor | No automatic rewrite or distracting approval request |

## Reviewable developer proposal

Use [the proposal template](../templates/refactor-proposal.md). Present:

1. What is wrong, with exact evidence and its effect on this task.
2. The smallest sound option, its remaining limitations, and why it is or is not sufficient.
3. The recommended deeper option: exact modules/contracts, responsibilities moved/removed, preserved behavior, expected benefit, and exclusions.
4. Migration/compatibility, effort uncertainty, delivery impact, risk and rollback/recovery obligations. Do not invent duration estimates.
5. Proof required to establish improved structure and retained outcomes.
6. One focused decision: expand to that bounded scope, use the sound narrow alternative, or defer the dependent work. Do not offer a known unsafe patch as a valid shortcut.

Example question: “The current module duplicates permission rules in three handlers, which caused the inconsistency shown in the failing case. I recommend consolidating them in the existing policy owner and updating these callers. That expands this fix to modules X and Y; public behavior remains as specified. Should I include that refactor, or keep the sound narrower option described above?”

Use actual modules/evidence in the real question. A generic “can I refactor?” is not reviewable. User silence does not approve expansion. Approval here covers agreed source work; destructive migrations or live actions still require their own applicable authority.

## After the decision

Record the developer's answer, exact boundary and affected acceptance IDs. Mark the old implementation as observed/superseded where appropriate; do not erase historical decisions. Update the task write boundary and proof plan. Apply [architecture](architecture.md), [migration](migration.md), UI and release overlays when triggered.

Where useful, characterize intended existing behavior before restructuring; do not encode a confirmed bug as an invariant. Remove superseded duplicate paths when safely inside the agreed scope, or give necessary compatibility paths an owner and removal condition. No permanent second architecture by accident.

Exit gate: the agreed refactor scope is implemented and tested against intended outcomes, affected consumers and the original defect; proof also checks the specific structural problem was removed. If expansion was declined, only call the bounded task complete when its result is sound and satisfies its unchanged acceptance criteria. Otherwise name the unmet criterion and blocker.
