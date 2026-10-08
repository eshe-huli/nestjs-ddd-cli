# Explore a question before committing implementation

Trigger: unclear product need, architecture alternative, unfamiliar code, feasibility risk, or an explicit research request.

1. Write the decision/question, intended output, constraints, allowed investigation and stop condition. Reuse known answers. Choose a bounded time/tool/cost budget from actual authority; no invented numeric user limit.
2. Separate facts, hypotheses and preferences. Identify the smallest observation that would change the decision. A repository map uses [the map template](../templates/codebase-map.md); external research records primary URLs, retrieval date, relevant version, claim and limitation.
3. Inspect existing code/owners and primary documentation. For popularity comparisons, state the selection criterion and dated adoption signal; stars do not prove quality. For uncertain or changing details, refresh before committing a consequential choice. Unavailable evidence stays unknown.
4. Compare viable alternatives, including doing nothing or using an existing capability when relevant. Run an isolated, reversible spike only if authorized and useful. Define its question, test input, expected observation, cleanup and production-use boundary first. A spike passing proves that narrow experiment, not a production architecture.
5. Deliver findings, recommendation, rejected alternatives, uncertainty and next decision. Record only concise evidence and rationale. If implementation is already authorized and remaining choices fall within it, route the slice; otherwise stop at the requested decision artifact.

Never silently promote a research snippet, competitor feature, fetched skill, prototype or generated assumption into a project requirement. Discovery can disprove a premise; report that outcome instead of manufacturing support. Additional business capabilities remain proposals.
