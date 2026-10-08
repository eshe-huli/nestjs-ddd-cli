# Review the intended outcome and implementation

Trigger: candidate result is ready for verification, meaningful review feedback arrives, or artifacts disagree. Scale effort to [track and impact](../rules/work-tracks.md); a quick correction can do both passes in a few lines.

## Pass 1: contract and scope

Check each acceptance ID against current evidence, normal actor paths and preserved behavior. Detect omissions, invented capabilities, unauthorized scope, changed meaning and stale specifications. Include denial/failure/recovery cases when applicable. A polished implementation of the wrong outcome fails this pass.

## Pass 2: implementation and operational quality

Check ownership, avoidable complexity, duplication, correctness, security, accessibility/performance and operational consequences relevant to the change. Apply required project checks. Use the [refactor flow](refactor.md) for justified expansion; review does not authorize rewriting adjacent modules.

Each finding records location/evidence, violated requirement or concrete failure, impact, recommended action, owner and disposition. Reproduce disputed findings when possible. Accept, correct or reject with evidence; an agent review is neither automatically correct nor an approval from the developer. Required defects block affected closure; optional improvements do not become new mandatory scope.

Use an independent reviewer when required or justified and authorized. Otherwise record self-review accurately. A second model's agreement is not runtime proof. Preserve reviewer-owned sign-offs; implementers cannot silently mark another actor's approval complete. Fix findings and repeat affected checks once the baseline changes; do not run endless reviews after the requirements pass.

For behavioral defects, prefer a regression that fails for the original cause and passes after repair when feasible; record why if infeasible. For suitable state/data invariants, consider property-based tests with an independent oracle and reproducible seed. Do not mechanically add tests for every text/token edit or mirror implementation as the oracle. Required CI and project quality gates still apply.

Exit: both passes have evidence at the required delivery stage, findings have a truthful disposition, and [spec reconciliation](spec-change.md) agrees with the task. Verification, user acceptance and release authorization remain distinct facts.
