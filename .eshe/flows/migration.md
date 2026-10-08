# Migration

Trigger: change to persisted representation, an externally consumed contract, or a platform/component replacement requiring existing consumers/data to move.

Inputs: source/target contract, inventory, owner, target environments, allowed downtime/compatibility, authoritative invariants. Migration source preparation does not authorize executing against live data.

First lock the requested delivery stage: `plan-only`, `source-and-controlled-rehearsal`, or `live-migration`. The table describes the full lifecycle; execute only the phases/actions needed by that stage. For source-and-controlled-rehearsal, implement and test against authorized disposable data, record live steps as unexecuted handoff obligations, and close against that bounded contract. Do not ask for production authority merely to write/test migration source. For live-migration, verify target-specific authority immediately before the first live mutation and again if scope materially changes.

| Phase | Required decisions and artifacts | Exit evidence |
| --- | --- | --- |
| M1 Inventory | Existing data shapes/volume, readers/writers/jobs, old client versions, ownership, retention and failure impact | Every affected source and consumer accounted for; inaccessible is unknown |
| M2 Plan | Forward path, compatibility window, sequencing, rollback/roll-forward choice, backup/restore requirements, stop thresholds | Concrete plan, requested delivery stage, and authority needed for the next actual action |
| M3 Expand | Add compatible new representation/API when appropriate; preserve old access | Old and new consumers work during overlap |
| M4 Migrate | Bounded restartable backfill/cutover with checkpoints, idempotency and reconciliation | Existing records correct; partial failure and rerun handled |
| M5 Observe | Check invariants, lag, error rates and stragglers against predefined criteria | Consumers demonstrably moved, data reconciled, recovery rehearsed |
| M6 Contract | Remove obsolete representation only after compatibility and authority gates | No required consumer/data remains dependent; recovery plan still valid |

Expand/migrate/contract is a useful pattern, not mandatory theater. A truly atomic offline migration may use another sequence when its assumptions and recovery are explicit. A rollback script does not prove that transformed data or external side effects can be undone.

## Mandatory proof questions

- Does this work on representative pre-existing data as well as a fresh database?
- What happens after interruption, duplicate execution, retries or concurrent writes?
- Can old and new binaries/clients coexist? What enforces deployment order?
- How are unmapped, rejected and partially migrated records reported?
- Which data invariants or business totals must remain unchanged?
- What exact evidence allows cutover and later deletion? Who owns the decision?
- Has the declared recovery route actually been rehearsed in a controlled environment?

Record evidence per phase and immutable source/config identity. Do not equate “migration command exited 0” with successful migration.

If the request is plan-only, produce the plan and proof requirements without executing phases. If it is a full migration, a plan alone cannot satisfy completion. Use [release](release.md) for authorized rollout and [architecture](architecture.md) for changed boundaries.
