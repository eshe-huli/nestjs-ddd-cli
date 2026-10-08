# Product and design decision cards

## P1 — Discover, define, develop, deliver

**Apply:** the problem or solution direction is genuinely uncertain. Separate learning about the problem from exploring and testing solutions. **Ask:** what evidence could change the problem framing or reject a candidate? **Produce:** a defined challenge and a small tested solution. **Eshe adaptation:** reuse existing evidence for established projects and avoid reopening discovery for Tier C corrections. [Design Council: Double Diamond](https://www.designcouncil.org.uk/resources/the-double-diamond/).

## P2 — Treat a design system as maintained evidence

GOV.UK's contribution model evaluates usefulness, distinctness, usability, consistency and versatility before accepting shared components and patterns. **Eshe adaptation:** discover/reuse the kit, explain a real gap, prove required states/accessibility, and document ownership/adoption before adding a primitive. **Avoid:** treating a downloaded component collection or a token file as proof of fit for the product. [GOV.UK Design System contribution criteria](https://design-system.service.gov.uk/community/contribution-criteria/).

## P3 — Product authority before personas and screens

Source: local `standing-operator`, `feature-flow-planning` and `product-intent-guardian` skills. Derive job-based roles from actual product authority; label assumptions and research gaps. Each surface answers a primary actor question. Personas organize hierarchy, not permissions. Produce a trace from job → flow → state → contract → evidence.

## P4 — Research proportional to the change

Source: current `never-skip-design-research`. Tier A discovers a product-specific identity; Tier B extends a known system; Tier C corrects against incumbent authority. The [UI flow](../flows/ui.md) contains the exact gates. Avoid both skipped research and unnecessary research ceremony.

## P5 — Identity is a system of choices

Source: `brand-art-direction`, `anti-ai-slop-ui`, `ui-designer-process`. Product truth supplies the identity nucleus; references teach conventions and transferable structure. Produce a signature that survives logo removal, grayscale, competitor substitution and multiple states. Familiar controls remain where they protect comprehension and accessibility.

## P6 — Behavior has a truthful response

Source: `beyond-the-object`, `motion-choreography`, `interaction-state-design`. First specify functional states. Then select responses for meaningful moments and choose deliberate quiet elsewhere. Carry trigger/truth/sequence/end/interruption/repetition/accessibility/performance/proof into acceptance. Do not confuse a working state, a distinctive composition and an earned temporal/tactile response; each requires its own proof.

## P7 — Walk the service behind the screen

Source: `service-blueprint`, `hands-on-ux-audit`, `page-by-page-product-review`. Follow an actor's job through frontstage, backstage, waits, failure, recovery and return. Every visible action or status is a promise to check against the real owner. A page audit uses a stable coverage inventory; unavailable cases remain visible as blocked or not run.

Local source paths and version hashes are in [the skill inventory](../sources/skill-inventory.md). These sources are not a claim that real user fieldwork happened in this task.

## Selection and rejection contract

| Card | Apply / decision question | Output | Reject when | Do not apply as |
| --- | --- | --- | --- | --- |
| P1 | Unknown problem/direction: which belief must be tested? | Problem definition and experiment | Actual observations contradict the selected problem/solution | Full rediscovery for an established spacing fix |
| P2 | Shared component gap: reuse, compose, extend or create? | Kit decision and stateful example | Incumbent already solves it, or required states/accessibility fail | A requirement to copy GOV.UK visual identity |
| P3 | New/changed surface: whose real job organizes it? | Sourced persona/job/governing question | Persona is invented or used to grant permissions | A substitute for server authorization |
| P4 | Presentation change: what depth of evidence is needed? | Tier and research evidence | Work changes identity while labeled a correction | A mandatory competitor survey for Tier C |
| P5 | New/replacement identity: what rule makes this product recognizable? | Identity/signature contract | Logo-off, neighbor-swap or multi-state test fails | An excuse to replace an approved target during refinement |
| P6 | Meaningful interaction: what response earns its cost? | Response requirement or deliberate quiet | It misstates truth, harms access or fails real-medium proof | Animation quotas or proof of functional completeness |
| P7 | End-to-end product promise: can the actor actually finish? | Journey and coverage/evidence map | Visible promise has no working owner path or recovery | A full application audit for a bounded copy change |
