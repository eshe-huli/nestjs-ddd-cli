# Bootstrap

Trigger: authorized work in a project without a usable Eshe record.

Inputs: actual request, repository boundary, existing instruction/product/design/architecture records. Output: a small project context, not an invented specification.

| Step | Action | Exit evidence | If missing |
| --- | --- | --- | --- |
| B1 Locate | Establish actual repository/package roots and dirty state; inspect governing instructions | Root, baseline, existing work ownership | Do not initialize a sibling or umbrella repo by guess |
| B2 Discover | Find equivalent vision/PRD, scope, DoD, decisions, design tokens/components and existing spec/task systems; assess decision-catalog applicability and existing-code quality | Authority map and decision register with observed vs accepted state; one owner for each canonical record | Record unknowns; use B3 |
| B3 Interview | Ask only material unanswered questions through [interview](interview.md) | Sourced answers, safe assumptions and blocking questions separated | Continue independent discovery |
| B4 Create | Create `.eshe` only when absent; add only missing records if present | Entry point and project record linking existing authorities | Never replace existing folder or duplicate canonical facts |
| B5 Register kit | Apply UI-kit applicability/discovery logic | Canonical kit, bounded creation requirement, or reason no interface applies | UI implementation waits for its kit/design prerequisites |
| B6 Start slice | Lock one deliverable with acceptance and non-goals; route it | Task record with first next action | Clarify only the missing decision |

## Minimum initialization

Use this complete starter manifest from a known protocol version:

| Destination under `.eshe/` | Source / initialization |
| --- | --- |
| `router.md` | Copy protocol router |
| `rules/`, `flows/`, `frameworks/`, `templates/` | Copy these complete protocol directories |
| `evaluation/README.md` | Copy evaluation protocol; do not copy this instance's results as destination evidence |
| `README.md` | Use only the fenced payload in [entrypoint template](../templates/entrypoint.md); record installed protocol version |
| `project/charter.md` | Populate [project template](../templates/project.md) from target project authority |
| `project/authorities.md` | Populate [authority template](../templates/authorities.md) |
| `project/decisions.md` | Populate [decision register](../templates/decision-register.md) from the [catalog](../rules/decision-catalog.md), including auth/infra applicability and needed-before milestones |
| `project/ui-kit.md` | Populate [kit template](../templates/ui-kit.md) |
| `sources/skill-inventory.md` | Populate [source-index template](../templates/source-index.md) with selected sources actually available in the destination |
| `profiles/` | Create directory; add only explicitly applicable profiles and register them in authorities |
| `runs/` | Create directory and one real task from [task template](../templates/task.md) |

Create `specs/` and `changes/` only when [spec-change work](spec-change.md) needs them and no equivalent canonical records exist. These hold target-project requirements and changes, never copied source-project facts. Context packets, scoped maps, plans and adapter records are likewise instantiated on demand from `templates/`; they are not extra mandatory bootstrap paperwork.

Do not copy this instance's Eshe charter, run records, personal profile or machine-specific corpus inventory as destination facts. Existing equivalent records stay authoritative. A copied template starts as unfilled, not validated.

After initialization, resolve every relative Markdown link from its containing file and verify all required manifest paths. Review unknown project fields and selected source availability. Never claim the destination is ready merely because the directory exists. Before a repeated initialization, inspect existing records; create missing files only, and propose reviewed version upgrades separately.

Existing `PRODUCT.md`, `DESIGN.md`, ADRs or a component package stay canonical. A `.eshe` record may contain a link, ownership and validation date instead of a duplicate document. Missing filenames alone do not mean missing intent or design authority.

Initialization must be repeatable: a second pass preserves accepted decisions, edits and task state. Updates require a reviewed difference and version note. No automatic publishing, remote repository creation, package installation or global agent reconfiguration.

Use [protocol maintenance](../rules/protocol-maintenance.md) for coexistence and upgrades. Replacing this instance's 0.1 rules with 0.2 is a document revision; destination projects retain their installed version until an authorized reviewed upgrade.

Gate: another agent can identify the user, job, scope, proof bar, current decisions, kit status, unknowns and first action without guessing. Full company strategy is not a prerequisite for a narrow established-project fix.
