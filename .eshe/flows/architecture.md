# Architecture decision

Inputs: real problem, existing architecture, measured or sourced constraints, ownership, expected change and operational capacity.

Before selecting technologies, check the relevant domains in [the decision catalog](../rules/decision-catalog.md) and link accepted choices in `project/decisions.md`. Use [auth](auth.md) and [infrastructure](infrastructure.md) for their detailed decision branches. Current code/deployment is observed evidence, not automatic endorsement; use [refactor](refactor.md) when a justified change to existing structure exceeds the task boundary.

1. Name the decision and the failure it must prevent. Separate functional requirements from quality constraints: consistency, latency, availability, security, operability and cost.
2. Map the relevant system context, deployable units, data and trust boundaries. Draw only the detail needed for the decision.
3. Identify one authoritative owner for each important fact or state transition. Distinguish domain truth, orchestration, projection, storage and presentation.
4. Compare the incumbent/smallest solution with credible alternatives. Include tradeoffs, failure modes, migration burden and operational complexity. Do not default to microservices, CQRS, event sourcing or a new framework because their names sound rigorous.
5. Consult only relevant [architecture cards](../frameworks/architecture.md). A pattern is accepted because its trigger and constraints match, not because it is on a “top designs” list.
6. Record a [decision](../templates/decision.md), including source, owner, status, rejected alternatives and reopening conditions. Resolve owner-only decisions through the interview flow.
7. If feasibility is uncertain, design the smallest falsifiable spike. State what result would reject the architecture. A successful demo does not settle production scale or recovery questions it did not test.
8. Route implementation and compatibility changes to change/migration/release flows as needed.

Gate: the next implementer can explain who owns truth, where contracts cross boundaries, what can fail, why the chosen structure fits, and what evidence could overturn it.

Plan completion and architectural acceptance are distinct from implementation and deployment. No framework selection automatically authorizes paid services, new data collection or changes to other products.
