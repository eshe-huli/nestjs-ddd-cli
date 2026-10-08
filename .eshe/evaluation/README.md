# Evaluate the protocol before claiming reliability

## Current validation boundary

Version 0.2 can be checked for source coverage, internal consistency, link integrity and scenario routing. A document walkthrough is not an empirical model benchmark, runtime enforcement, or evidence that weaker agents now perform well.

## Model comparison to run later

1. Freeze a representative task set and a separate held-out set before tuning. Include straightforward, ambiguous, mixed-risk, interruption and malicious-source cases.
2. Run the same tasks with and without Eshe using the same model/version, tools, initial repo/data, permissions and sampling settings. Include the intended lower-capability model. Repeat enough trials to report variability; specify the count before running.
3. Keep task success and process compliance separate. An agent that checks every box but fails the user outcome has not succeeded.
4. Score against independent expected outcomes: acceptance coverage, scope drift, correct routing, preserved behavior, unsupported claims, unnecessary questions, stale evidence and safe recovery.
5. Record failures, token/time/tool cost and blocked tasks honestly. Do not silently remove hard cases or retune the held-out set.
6. Set acceptance thresholds before the experiment. Ship stronger reliability claims only when results support them.

## Runner acceptance tests when implementation begins

- Initialization preserves existing project files and decisions on a second run.
- Missing/invalid task fields and illegal transitions are rejected.
- Unknown flags cannot silently remove risk gates.
- Required evidence cannot be replaced by stale or not-applicable evidence without a valid reason.
- Changing source, scope, actor or relevant configuration invalidates dependent proof.
- Forged receipts cannot satisfy checks meant to be independently observed.
- Writes outside authorized root, symlink escapes and competing cursor revisions are rejected.
- Resumption after a crash does not duplicate uncertain external operations.
- Imported prose cannot grant tool permissions or mutate the workflow policy.
- A ready step has current inputs, satisfied dependency proof and actual action authority; cycles and missing IDs fail.
- Orphan tasks, uncovered requirements and contradictory decision/spec revisions are detected before dependent execution.
- A proposed or cancelled delta cannot silently replace accepted intent; overlapping changes require semantic reconciliation.
- Quick tracks cannot disable impact gates; an auth change mislabeled cosmetic still requires authorization proof.
- Protocol upgrade preserves local overrides and current task history; failed upgrade rollback touches only owned changes.
- Adapter claims of enforcement are tested at the real interception point, including missing-hook and crash cases.

Add matched cases for plan-only outcomes, quick corrections, existing framework coexistence, tight context, interrupted dependencies, manual edits and multi-repo partial completion to the future model experiment. Score unnecessary bureaucracy as well as missing safeguards. A structurally valid plan can still be wrong; use independent outcome oracles.

These tests are specifications. There is no runner under test in this version.
