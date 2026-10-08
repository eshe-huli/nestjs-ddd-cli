# Portable entrypoint template

Write only the fenced Markdown payload below to the target `.eshe/README.md`. The payload's relative links are intentionally relative to that destination, not this template. The bootstrap manifest supplies every linked file. Record the installed version and actual active profiles in the target authority map.

```markdown
# Project decision protocol

Protocol version: 0.2.

1. Follow the host instruction hierarchy and current authorized request.
2. Read [core rules](rules/core.md), [project charter](project/charter.md), [authority map](project/authorities.md), and relevant [project decisions](project/decisions.md).
3. Find the relevant current task in `runs/`; use [resume](flows/resume.md), or create a substantial new task from [the template](templates/task.md).
4. Apply [the router](router.md) and [work track](rules/work-tracks.md), then load only the selected flow and registered applicable profiles.
5. Follow [the lifecycle](rules/lifecycle.md), attaching real evidence before advancing.

Project records are authoritative only to the extent their sources support them. Templates, proposals and assumptions are not accepted decisions. Empty fields mean unknown.

See [the decision catalog](rules/decision-catalog.md), [UI-kit status](project/ui-kit.md), [selected source inventory](sources/skill-inventory.md), and [framework library](frameworks/README.md).

Use [planning](flows/planning.md) for multi-step readiness, [spec changes](flows/spec-change.md) for evolving behavior, [review](flows/review.md) before closure, [context](rules/context.md) for handoffs and [maintenance](rules/protocol-maintenance.md) for integration/upgrades. Quick work can keep these checks inline.

This is a document protocol. No runtime enforcement or model reliability result is implied. See [evaluation requirements](evaluation/README.md).
```
