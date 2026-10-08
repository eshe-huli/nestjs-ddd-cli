# Configuration, CI, infrastructure and delivery

Inputs: exact desired delivery stage, source owner, target environment, current state, release policy and action authority.

## Prepare before execution

1. Verify the repository, target account/cluster/environment, current source/config/runtime and unrelated changes. Inaccessible infrastructure remains unknown.
2. Identify the authorized source-of-truth path: repository configuration, GitOps, protected pipeline or owner API. Do not repair managed runtime by bypassing its owning source.
3. Produce the concrete change, local validation and rollback/recovery plan appropriate to risk. Scan executable/configuration changes through the required quality gate.
4. Determine which external actions the request already authorizes. If a material action is still unauthorized, present the prepared result and request only that decision.

## Keep delivery claims separate

| Stage | Evidence |
| --- | --- |
| Local artifact | Actual diff/files, baseline and required local checks |
| Source published | Commit and remote reference actually present |
| CI verified | Required pipeline for the exact source revision |
| Candidate built | Immutable artifact identity and provenance |
| Deployed | Desired promotion plus actual running revision/digest/config |
| Runtime healthy | Relevant service state and operational checks |
| Actor outcome | Authorized user completed the requested behavior; denied/recovery cases where required |

The task's DoD selects the required stages. A local-only task need not deploy. A deployment task cannot close at a source patch. Health is not an actor transaction; an MR is not a release receipt.

Use existing project release policies rather than universal assumptions about `develop`, `main`, image tags or hosting. Preserve checked-in package managers unless migration is explicitly requested. For data changes also run the migration flow.

On uncertain external outcome, inspect operation state and idempotency before retrying. Never interpret a timeout as proof nothing happened. Do not cancel shared jobs or change platform policy to clear a task's gate.
