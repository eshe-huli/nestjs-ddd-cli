# Interface changes and UI-kit stewardship

Inputs: product authority, actor/job, exact surface/state/device, before evidence, existing design authority and kit. Use [change](change.md) too when behavior changes.

Gate zero: read the PRD or equivalent product authority, derive or validate job-based personas from its outcomes, constraints, roles and truth boundaries, and name the primary persona and governing question for this surface. Personas guide hierarchy; they never grant permissions. Tier C reuses the established job/authority and validates only the affected context; it does not force a new persona interview or a new PRD.

## Choose research depth before presentation code

| Tier | Trigger | Required preparation |
| --- | --- | --- |
| C | Narrow copy, contrast, icon, token, spacing, alignment or approved-component correction | Inspect actual before state and incumbent authority; identify exact defect and invariants |
| B | Material screen/flow extension within an established identity | Inspect incumbent UI, tokens/components and response behavior; inspect 1–2 focused live examples; record inherited vs added decisions; wireframe material composition changes |
| A | New/replacement identity, major redesign or explicit originality request | Inspect 3–5 live same-job products and 2–3 cross-domain works; observe an important interaction; define identity nucleus, conventions, owned divergence, signature; write design research and inspect target-geometry composition proof |

For Tier A, use `docs/design-research/YYYY-MM-DD-<surface>.md` or link an existing equivalent. Before coding, test logo-off, neighbor-swap, grayscale silhouette and normal/empty-or-error/completion-or-return states. Tier C does not require a new competitor survey.

## UI-kit branch

1. Search actual shared tokens, themes, components, previews and their imports. Confirm which source owns the surface.
2. If a kit exists, reuse it. If undocumented, record it. If partial, extend only the gap needed by this task.
3. If absent in a UI product, create the smallest coherent source of reusable tokens and primitives after the applicable research: semantic color, typography, spacing, shape, focus, states and selected response behavior. Build only the primitives required by the first slice.
4. Include public exports, stateful catalog examples, accessibility rules, composition guidance, ownership and adoption paths. Verify long content, compact widths, focus, loading, empty, error and denied/unavailable states. A palette file alone is not a kit.
5. Use the kit in an actual in-scope surface and inspect the result. Do not migrate unrelated screens merely because a new primitive exists; record their adoption work separately unless required for preservation.

Register the kit's source and version in `project/ui-kit.md`. Keep component implementation in the product's established source location; `.eshe` points to it rather than becoming a second UI package.

## Behavior and experience

Before implementation, specify the applicable normal, loading, empty, partial/stale, denied, error/recovery, completion and return states. UI cannot imply successful financial or external action before the owning system confirms it.

For meaningful interactions, apply beyond-the-object: select earned responses and deliberate quiet. Each selected response needs trigger, authoritative truth, sequence/end state, interruption, repetition, reduced-motion/mute/accessibility fallback and proof medium. This may deepen an authorized interaction; it cannot introduce a new business capability or permission boundary.

## Execution and verification

Implement through the owning kit, preserve contracts, and inspect the same route, actor, state, theme, content and target geometry before/after. Exercise important controls, error/recovery, focus and accessibility. A shared token change requires checking affected consumers.

For new or changed destinations, prove ordinary navigation/launcher discovery as well as deep-link access. Shared component anatomy does not authorize sharing administrative permissions or collapsing distinct actor jobs into a generic screen. Catalog proof supplements the actual product route; it cannot replace it.

Screenshots prove static appearance. Motion needs playback; haptics/sound need appropriate hardware proof. A simulator cannot prove physical haptics. Apply the active mobile/environment profile without importing a machine-specific device into every project.

Exit gate: task acceptance, kit adoption, appropriate research, functional states and selected experience requirements are evidenced. Missing device/tool access is a named proof gap, not a pass.

Do not hide meaningful user-facing status, costs or recovery information under a “no developer chrome” rule. Remove internal scaffolding copy while preserving information the actor needs.
