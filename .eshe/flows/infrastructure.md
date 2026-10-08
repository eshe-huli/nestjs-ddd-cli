# Infrastructure decisions

Trigger: new hosting/runtime choice, environment creation, topology change or a constraint the current deployment cannot meet. This flow prepares a decision; provisioning and deployment use [release](release.md) under actual authorization.

AWS, a VPS and Kubernetes are not one mutually exclusive choice list. They describe different layers that may be combined. Make each relevant axis explicit.

| Axis | Questions / candidate categories | Decision output |
| --- | --- | --- |
| Existing estate | What already runs, who owns it, what is accessible, what capacity/storage/restore proof exists? | Verified current-state map; inaccessible is unknown |
| Requirements | Expected demand, latency, geography/data-location constraints, availability, recovery, budget and operator capacity? | Sourced requirements; unknown estimates labeled |
| Provider and location | Existing estate, cloud provider such as AWS, VPS provider, on-premises/homelab, or hosted platform? Which region? | Provider/location and reason, with actual owner/cost authority |
| Compute | VM/VPS, managed application/container platform, serverless, existing cluster or another justified runtime? | Workload placement and resource assumptions |
| Orchestration | Process manager, Compose, managed scheduler, Kubernetes, or no orchestration layer? | Complexity justified by workload and operating capacity |
| Stateful services | Database, cache, object/files, queues and secrets: managed or self-hosted; persistence owner? | State placement, durability, backup/restore and maintenance responsibility |
| Network and edge | Public/private entry points, domain/DNS/TLS, ingress/load balancing, internal communication and privileged access? | Exposure/trust boundary and owning configuration |
| Environments | Development, preview/test, staging and production actually needed; isolation and cost? | Per-environment topology and data boundaries |
| Delivery ownership | Existing IaC/GitOps/platform owner; CI artifacts; deployment identity; promotion/rollback? | Source-to-runtime path and authorized operators |
| Operations | Logs/metrics/traces, alerts, patching, scaling, restore/incident response and spending visibility? | Named owner, proof plan and operating budget |

## Selection procedure

1. Inspect the actual estate and current contracts before asking the developer to choose from generic vendor names.
2. Establish constraints and consequences. Offer a small number of viable **whole topologies**, each describing provider + compute/orchestration + stateful services + operations, rather than comparing a provider with an orchestrator.
3. Recommend one with rationale, cost assumptions, operational burden, failure/recovery implications and migration impact. Verify live pricing, service features and version compatibility when a real choice depends on them; do not insert remembered numbers.
4. Obtain owner decisions for unsettled spending, data placement, operating responsibility or materially changed risk. Reuse existing authority; do not ask again for an already approved target.
5. Record accepted topology and unresolved dependencies per environment. A design choice is not proof of available access, provisioned capacity or a successful deployment.
6. Prepare source/configuration changes and controlled validation. Execute only through the existing authorized release/infra workflow.

Gate: the next implementer knows what runs where, who owns state and operations, why the topology fits, how it is released/recovered, and which choices remain blocked. Do not introduce Kubernetes because it sounds mature or keep an unsuitable VPS layout merely because it exists. An existing topology may be retained only with a reason relevant to this task.

For a local-only artifact, explicitly defer deployment decisions until the first runtime-dependent milestone. Do not block unrelated source work on hypothetical future production questions.
