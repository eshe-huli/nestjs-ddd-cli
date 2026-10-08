# Feature, bug fix, integration or refactor

Inputs: locked outcome, baseline, affected ownership chain and active profiles.

Choose the [work track](../rules/work-tracks.md). Standard/extended work uses [planning](planning.md); intended behavior changes use [requirement deltas](spec-change.md). Quick corrections can record those checks inline.

| Step | Required work | Gate |
| --- | --- | --- |
| C1 Contract | Identify allowed changes, preserved behavior, non-goals and affected consumers | Every proposed change maps to acceptance or necessary preservation |
| C2 Trace | Read route/caller → contract → owner → storage/provider → consumers; assess existing implementation quality | Truth owner, constraints, failure paths and concrete debt understood |
| C3 Design | State smallest change, dependencies, state transitions and proof plan; check cross-artifact coverage/readiness | Inputs/outputs accounted for; material decisions resolved; next step ready |
| C4 Implement | Make bounded changes in the owning layer; use actual platform capabilities | Candidate diff matches allowed scope |
| C5 Verify | Run required checks and original user path; add regressions proportionate to risk; complete [both review passes](review.md) | Current-baseline evidence proves acceptance, integration and preserved behavior |
| C6 Close | Reconcile specs/decisions with actual delivery; apply lifecycle close gate | No omitted required clause or unsupported claim |

## Bug branch

Reproduce the reported failure first when possible. Distinguish observation from hypothesis. Test the cheapest falsifiable hypothesis; repair the cause; rerun the original reproducer and affected regressions. If two repair attempts fail without new understanding, stop patching and reassess the ownership/causal model. Do not conceal pre-existing failures or widen to unrelated cleanup.

Record three sets explicitly: observed defective behavior, intended corrected behavior, and unaffected behavior to preserve. A regression should demonstrate the cause when feasible; never preserve a confirmed defect just because it was in the baseline.

## Feature branch

Trace actor entry → authorization → state transition → authoritative persistence/external effect → receipt → error/recovery/return. Explicitly account for data inputs and absent backend capability. A mocked screen may satisfy a prototype contract but cannot prove a real integration.

## Refactor branch

Use the [existing-code/refactor flow](refactor.md). Preserve intended product behavior, valid contracts, data and unrelated user work; do not blindly reproduce bad implementation patterns or encode known defects as invariants. Compare a sound local repair with a bounded deeper refactor.

If the deeper change expands current authority, prepare concrete evidence, affected modules, alternatives, risk and proof, then ask the developer whether to include it. Do not implement that expansion before agreement. Already authorized deeper refactoring needs no repeated approval. If no sound narrow path exists, name the blocked requirement rather than shipping a known bad workaround.

Write equivalence assertions for required behavior and explicit corrections for confirmed defects. If public behavior/contracts change, reclassify and apply migration/product gates; “refactor” is not an exemption.

## Risk overlays

For stateful/auth/financial flows, test applicable replay, concurrency, denial, stale state, partial failure and recovery properties. Identify the authoritative owner rather than teaching a UI adapter to decide business truth.

Executable/configuration/CI/migration changes in Ben's environment also invoke the local Sonar gate. Distinguish a local analysis result from the server gate, CI and runtime. Do not create low-value tests that simply repeat implementation for a reversible copy/spacing change; still run required project checks and inspect the actual result.
