# Plan executable slices

Trigger: work needs ordered steps, several sessions, multiple owners, or nontrivial proof. Inputs: locked task, [track](../rules/work-tracks.md), affected decisions and [requirement changes](spec-change.md).

1. **Define observable acceptance.** For each requirement state actor, precondition/event, expected outcome and relevant failure/preservation behavior. Replace vague words such as fast or secure with an agreed observable criterion; leave missing targets unknown. Use [the requirement template](../templates/requirement.md) only where existing requirements are insufficient.
2. **Choose a coherent slice.** Make one end-to-end outcome usable or one uncertainty resolvable. Record milestone dependencies and deferred work without authorizing that backlog. Foundational tasks are permitted when linked to the slice they enable; every slice must eventually prove integration.
3. **Build a dependency plan.** Use [the plan template](../templates/plan.md). Each step has an ID, requirement IDs, actual owner/paths, inputs, dependencies, permitted action, output, proof, failure route and status. Investigate unknown paths before naming exact edits. Do not invent complete code before inspecting the owner.
4. **Check readiness.** Every affected needed-before decision is resolved; relevant source has been read; inputs exist and are current; dependencies passed their required proof; tooling and test data are available; the next action is authorized. Missing inputs produce `blocked`, never `ready` by optimism. Inspection and preparing an approval package may be ready while a live mutation is blocked.
5. **Check consistency.** Compare request → requirements → decisions/design → steps → evidence plan. Find uncovered requirements, orphan tasks, contradictions, circular/missing dependencies, duplicated owners and criteria that cannot falsify success. Correct the owning artifact, then recheck affected links. Do not rewrite the requirement to excuse a deficient plan.
6. **Execute the ready frontier.** Pick one ready step; update proof before releasing dependent steps. A checkbox means only what its declared proof establishes. Use parallel work only when host/user instructions allow it and independent ownership makes it useful. Shared files, state, contracts or databases require coordination even if dependency IDs look independent.
7. **Integrate and replan.** Verify the combined behavior; individually passing steps do not establish integration. New discoveries update the remaining plan and invalidate affected proof. Unrelated improvements go to a proposal; execute only within the current request. Apply [review](review.md) and [spec reconciliation](spec-change.md) before closure.

## Cross-repository work

Record a baseline and owner per repository, the single contract authority, producer/consumer compatibility, build/publication order, required rollout stage and recovery. Keep one parent outcome with child task references and separate cursors. A completed producer cannot close an unfinished consumer outcome. A shared spec is referenced from its canonical owner; do not copy it into competing authorities. Do not assume Git changes across repositories are atomic.

## Stop and repair

An unbounded task is split before execution. A dependency cycle goes back to design; an unresolved requirement goes to interview; inadequate tooling goes to a supported alternative or a named proof blocker. Persistent failure goes to causal investigation, not endless regeneration of plans. Limits are recorded in the task; reaching them is not completion and does not authorize lowering acceptance.
