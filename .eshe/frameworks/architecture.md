# Software architecture decision cards

## A1 — Explain boundaries with C4

**Apply:** the agent cannot explain actors, systems, deployable units or ownership. **Ask:** who uses this, what are the external systems, where do responsibilities run? **Produce:** the smallest useful context/container map; zoom further only when it resolves a decision. **Reject:** boxes without responsibilities or relationships. **Avoid:** producing all diagram levels for a small local edit. C4 explicitly permits selecting only useful levels. [C4 diagrams](https://c4model.com/diagrams).

## A2 — Preserve why with architecture decision records

**Apply:** a consequential choice could be revisited or misunderstood. **Ask:** what forces constrain it, what was chosen, and what consequences follow? **Produce:** a short status/context/decision/consequences record, with Eshe's added owner/source/reopen fields. **Reject:** an unlabeled proposal presented as accepted. **Avoid:** an ADR for every variable or mechanical edit. Keep superseded decisions traceable. [Michael Nygard: Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

## A3 — Change interfaces through compatible stages

**Apply:** old and new consumers must coexist. **Ask:** how will each consumer migrate before the old interface disappears? **Produce:** expansion, migration and contraction phases. **Eshe proof:** mixed-version behavior, completed migration and evidence authorizing removal. **Avoid:** adding a compatibility layer without an actual consumer or migration obligation. [Parallel Change, Danilo Sato](https://martinfowler.com/bliki/ParallelChange.html).

## A4 — Establish domain boundaries before service boundaries

**Apply:** meanings and business ownership overlap. **Ask:** where does the model/vocabulary change, who owns each fact, and how do contexts exchange it? **Produce:** bounded contexts and explicit contracts. **Eshe proof:** one authoritative writer/decider per critical fact, with consumers/projections identified. **Avoid:** interpreting every bounded context as a required deployable service. [Microsoft: Domain analysis](https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis).

## A5 — Earn distribution

**Apply:** a team proposes multiple services before it understands boundaries. **Ask:** which measured constraint requires independent deployment/scaling, and can the team operate it? **Produce:** comparison with a modular, coarsely divided starting point. **Eshe proof:** demonstrate the constraint and account for coordination/failure cost. **Avoid:** treating “monolith first” as universal law; existing systems or operational constraints can justify another choice. Fowler presents experience and tradeoffs, not a theorem. [Monolith First](https://martinfowler.com/bliki/MonolithFirst.html).

## A6 — Make repeated intent safe

**Apply:** callers retry a consequential operation or cannot tell whether it completed. **Ask:** how are caller intent, duplicate requests, conflicting payloads and late arrival distinguished? **Produce:** an explicit idempotency contract and retention/reconciliation policy. **Eshe proof:** replay, concurrent duplicate and changed-intent cases against the actual owner. **Avoid:** assuming identical parameters always mean the same intent, or calling a client-generated ID sufficient by itself. [Amazon Builders' Library: Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/).

## A7 — Resolve database/message dual writes

**Apply:** one operation must persist a state change and reliably publish its event. **Ask:** what if the database commits and publication fails, or delivery repeats? **Produce:** a transactional outbox or an equivalent justified mechanism, with delivery and consumer duplicate handling. **Eshe proof:** crash between commit/publication and repeated delivery. **Avoid:** adding an outbox where no such obligation exists, or claiming it alone gives exactly-once external business effects. [AWS: Transactional outbox pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

These cards are decision aids. None chooses a database, cloud, framework, compliance policy or service topology without project evidence.

## Rejection evidence

| Card | Reject or revise the decision when |
| --- | --- |
| A1 | An important actor/dependency has no represented owner or relationship |
| A2 | The recorded choice lacks authority or its stated constraints are false |
| A3 | An old consumer breaks during the claimed compatibility window |
| A4 | Multiple contexts independently decide the same critical business fact |
| A5 | Measured isolation/scale requirements cannot be met by the proposed structure |
| A6 | Replays duplicate effects or conflicting intent is silently reused |
| A7 | Failure between commit and delivery loses the required event or corrupts business state |
