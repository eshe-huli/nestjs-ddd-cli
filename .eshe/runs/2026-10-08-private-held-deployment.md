# Private held deployment source generator — 2026-10-08

Root approved a bounded shared-generator correction before source delivery for
MyDermaLife's new private Accounts and Courier APIs. Work is isolated from CLI
PR10 at upstream main `53ca0a9f7c946e0617708deae2915e96de52acc1`, branch
`codex/private-held-deploy-20261008`. Only the deployment renderer, its Commander
block, focused behavior tests, README and this record are owned. Existing
managers, service bodies, package/locks, publisher/token, default/public/npm/active
behavior and the primary checkout remain unchanged. No merge/package release,
private repository creation, live migration/provider/network or workload
activation is authorized by this source proof.

Accepted additions: explicit visibility/state/name/port/manager/Node image,
bounded probe path, explicit no-probe and probe mode. Private requires
`--no-compose`, ClusterIP/noIngress and refuses existing selected delivery targets
or symlink ancestry. Held requires `--no-compose`, replicas0/noHPA; a pre-existing
HPA is refused. CI source gates use the selected manager and existing frozen lock,
without invented provider/database authority or coverage upload for private
profiles. Held CD is manual with publicationfalse default; Docker metadata
normalizes repository names and creates full-commit tags with latestfalse. No
cluster/migration step is emitted. GitLab has an equivalent manual false-default
publish variable. Public active defaults are preserved.

All option/lock metadata and target preflight happen before writing. Private
creation is exclusive to preserve a concurrent owner. Existing environment and
ignore files are preserved. Bun single-package lock declarations/resolutions are
validated; container installs remain authoritative frozen-lock proof. Production
dependencies are installed hoisted inside pinned Bun1.4.0/Node stages and copied
to a Node runtime, not copied from the workstation store. Actual owned Nest config
is copied when present. Optional Prisma COPY/generation is emitted only for an
owned schema; invalid shell-redirection COPY is removed. Readiness remains an
activation prerequisite: Accounts has no probes; Delivery explicitly chooses
`live-only` for `/health/live`, never provider readiness.

## Proof and limits

- Final focused Linux homelab suite:42 actual renderer/YAML/CLI/negative cases
  pass in job`laptop-test-a51a5a8171ec`, snapshot
  `8f8b668e2ccb96280ad50ca2ebf536818d3ed9ec12323e3dbd1b2f682bac8f5a`,
  exit0/cleanup0. Production build/typecheck and strict owned lint0warnings pass.
  Local source build/type/lint/diff checks pass too. No framework mocks, new
  test skips or gate suppression are added.
- Full Linux Bun/Jest job`laptop-test-57de25df9bf2`, snapshot
  `fd451e325b5ca2293aef7aba19bd2c54995562ba10bb1e760a08a111735fa40a`:
  29 suites pass,3 fail;205 cases pass,3 fail,1 existing opt-in init skip;2 snapshots
  pass, cleanup0. Build/type/strict owned lint pass. Two unchanged failures are
  bounded-json CLI dry-run and generated OIDC crypto subprocesses with blank
  captured errors. The new CLI test's stderr-empty expectation failed on the
  pre-existing automatic npm-update warning. This is not a full-green claim.
- Actual CLI diagnostic job`laptop-test-2db5c22f608c` exits0 and emits exact held
  files. Its only stderr is the existing `npm view nestjs-ddd-cli version` probe
  warning because npm is absent. The new test now permits exactly that known
  warning, preserving all invalid/exit/state/file/schema assertions and rejecting
  any other stderr. Update-checker source is outside this lease and unchanged.
- Bun isolated Nest peers are resolved from their actual installed owners into
  NODE_PATH; Jest uses the documented globalsCleanupoff option. No source
  dependency/lock/loader mock is changed. Established Node matrix CI remains the
  independent authoritative runtime gate; publication interpretation is root-owned.
- Final temporary DDD output is recorded in
  `/tmp/mdl-held-reviewed-preview-20261008.json`, emitterSHA256
  `7ff4f73cbab31f64c61a049e7169a105f1b7784dffea6d188cdf2e5223eb7620`.
  It is generated from archived Accounts`f5924b1` and Delivery`692960a`, not live
  or mutable source copies. Tests use ports3007/3008; no origin/DNS is selected.
- Actual pinned base indexes: Node24 Alpine
  `sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1`,
  Bun1.4.0 Alpine
  `sha256:07235578f79ef8c6f97d94aee7938e76f5cdba5f21ae5dbfdd3d3d38058437eb`.
  Both consumer builds pass on native arm64 and emulated amd64 via existing
  Docker29.4.0. Accounts images:e2c0c67.../390ebe45...; Delivery:0818d5e.../a266bdf....
  Node24.21.0/nonrootuid1001, production package resolution and dependency
  portability checks are network-free and do not start either API. Bun is absent
  from runtime. Container source proof is not DB startup/provider/actor proof.
- Kubeconform0.8.0 strict Kubernetes1.34 schemas validate all6 held resources:
  zero invalid/errors/skips. No cluster context/application is accessed or applied.

Root must review source, exact published draft CI and emitted artifacts before
consumer file generation. Service provenance, provider custody, readiness,
matching-major restore and authorized actors remain the owning project gates.
PR10/package publication stays held independently.


Root reviewed the complete source and actual generated profiles, then approved
normal draft publication with the two unchanged Bun subprocess limits disclosed.
Consumer generation remains conditional on established exact-head Node CI.
Final proof JSON includes all four immutable images, actual production imports
on arm64/x64 and all emitted-file SHA256 values. MDL service repositories,
application bodies and locks are preserved until that separate consumption gate.

## Deployment end-of-file correction

PR11's initial exact head `afbf838` passed all four established Node CI jobs in
run37821276369 before actual CLI consumption into the two held service repos.
Source commits Accounts`c99bb74` and Delivery`8eb7573` preserve those original
emissions. Their Deployment documents have a trailing empty line, independently
detected by `git diff --check` at lines34/40; their prior bytes also fail the
new final-newline invariant. This is a formatting defect, not a YAML policy or
runtime change, and root authorized a follow-up without amending those commits.

Only the Deployment document's trailing whitespace is normalized to one newline.
Four new actual-emission tests cover public/active defaults and held no-probe,
liveness-only and liveness-plus-readiness profiles, retaining replica/probe
semantics. Focused Linux homelab job`laptop-test-7131b91e5f15` snapshot
`ffbc2d95d7a85ec4a26a30b2c6dc778d9b091120d81570390f0b5467ba257b3b`
passes46/46, production build/typecheck and strict owned lint, exit0/cleanup0.
Local build/typecheck/strict owned lint and source diff-check pass as well.

Actual temporary CLI regeneration changes only `k8s/deployment.yaml` in each
service; parsed YAML is identical and the other six generated hashes are
unchanged. Clean Deployment hashes are Accounts
`b354edfccc8845e637d8f6121b457759f560e97c98869b8f00e071294d04dc5a`
and Delivery
`618b2fd0a519f515006a9b78b31c18975304d6d66c2e884e06d1c2d4bc6e36e2`.
Compiled emitter SHA256 is now
`646fed66cd9ac307bba150b7c56b079bdcfba650ac10974d91e7d7288c28d83f`;
`/tmp/mdl-held-final-clean-preview-20261008.json` supersedes the earlier newline
receipt only. Exact follow-up Node CI remains required before real service
regeneration. Existing Docker/package/source inputs are identical, so their
immutable build proof is retained without a redundant rebuild. Service schema,
doctor and diff checks must be repeated after consumption; activation stays held.

## Additive Next standalone source preparation

The accepted MDL Accounts browser is a new Next frontend. Existing Nest output
cannot produce its standalone runtime or native Bun source test command. Root
extends only this generator lease with explicit `--application next-standalone`,
requiring private/held/Bun/no-probe, current Next build/native Bun test scripts,
and no Nest/Prisma source. Default Nest options/files remain unchanged. No existing
workflow manager, package/lock, source application or main branch is migrated.

The generated builder uses frozen container-owned hoisted dependencies and Next
standalone build output. Runtime remains the selected official Node image with
uid1001, fixed listener/port, no Bun, no provider environment or automatic deploy.
Docker context excludes local `.next`, protocol/workflow/Kubernetes records and
environment files; existing owned exclusions are validated and preserved. Source
CI chooses the native Bun test script without Jest arguments. Shared private
target/symlink/exclusive-create/held-state guards remain in force.

Current local focused58renderer/YAML/negative/actual-CLI cases, production build,
typecheck and strict owned lint pass. Independent source review found one context
guard omission: an existing Docker ignore also needs node_modules excluded.
That guard and a rejection-before-write regression now pass; no material source
finding remains. The supported Linux profile `laptop-test-31c577b34e09` passes
all58cases/build/type/strict owned lint, exit0/cleanup0, snapshot
`224f54da7bef6c169f496d6b5be1af54b69666fd1f687d6f26e4cc6b05594109`.
The initial bare test invocation11e0e44489de omitted the compiled CLI build and
the previously documented Jest globalsCleanup option:56pass/2fail, cleanup0.
The corrected profile builds first and retains that existing runtime option;
no source assertion, timeout, dependency or compiler rule was weakened.

Actual emitter parity checks compare every output byte with preceding598cfe8
for default GitHub, default GitLab and both private held Accounts/Courier API
profiles. All are identical; the two API profiles additionally match every
checked-in generated artifact. Courier retains its existing /health/live
liveness-only probe; Accounts remains without probes. Actual compiled CLI
generation against the new browser's real package/lock emits eight held files:
Docker/ignore, sourceCI/manualCD, Deployment/Service/ConfigMap and the private
minimal environment example. Preview receipt is
`/tmp/mdl-next-emission-receipt-20261008.json`; no app artifact is consumed yet.

Exact Node matrix CI remains before consumer generation. Actual emitted frontend
Docker/build/native HTTP proof follows consumption; the earlier API immutable
container receipts do not cover this new frontend. Runtime readiness, custody
and real actors remain open.
