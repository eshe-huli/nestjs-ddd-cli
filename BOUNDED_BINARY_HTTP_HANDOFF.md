# Bounded binary and HEAD evidence transport — 2026-10-08

This additive recipe starts from upstream `origin/main`
`53ca0a9f7c946e0617708deae2915e96de52acc1`. It emits one dependency-free
`src/shared/http/bounded-binary-http.client.ts` and its consumer documentation.
It uses the existing all-target preflight and successor-safe static recipe
writer. Existing JSON, OIDC, deployment, package, lockfile and CI sources are
unchanged. No package release or Media deployment is authorized by this work.

## Contract

The client admits only an exact configured origin and explicitly allowed bounded
headers, paths, query strings and bytes. It snapshots the request body before
asynchronous transport and prevents replacement of configured credentials.
HEAD returns selected bounded metadata without reading or manufacturing a body.
Location and object headers are evidence; they never change the destination or
create credentials/resource authority. Redirects are rejected and every call
makes one transport attempt. Unknown POST/PATCH outcomes must remain unknown.

One absolute monotonic cutoff covers preflight, transport, headers, HEAD return
and body collection. The private reader shares that cutoff without renewal,
including zero-byte streams that starve timer callbacks. External cancellation
is preserved; ignored abort cannot keep the caller waiting and a late response
body is cancelled. The incoming stream helper snapshots limits/signal and bounds
actual bytes with one capped backing buffer, avoiding tiny-chunk memory overhead.
Exceptions expose safe reasons/status only, never raw upstream errors or bodies.

Consumers still own current actor/consent, native storage completion, immutable
object bindings, uncertain-write ledgers, restore fencing and content release.
This recipe grants none of those facts. Media consumption remains held until the
published exact-head Node matrix passes and the owning contract is reviewed.

## Source proof and limits

- Focused generator checks: 10 passed, covering real CLI dry-run/list, exact
  output, matching rerun, whole-plan conflicts, symlinks, rollback and preserved
  concurrent successors. Emitted dependency-free output strict-compiles.
- Emitted runtime: 46 passed, including real loopback HEAD/PATCH, redirects,
  stalled body reads and one uncertain POST/PATCH without redrive. Injected
  transports prove ignored abort/late cancellation and timer starvation.
- Independent review found the first version renewed its read timeout after
  delayed transport and could return late HEAD when its timer was starved.
  Two new cases failed that baseline (191ms against a 120ms budget; HEAD
  incorrectly resolved). They pass with the shared absolute cutoff. Receipts:
  `/tmp/mdl-binary-deadline-baseline-20261008.log` and
  `/tmp/mdl-binary-deadline-fixed-20261008.log` on the owning host.
- Final local full CLI: 32 suites, 177 passed, one existing opt-in init skip,
  two snapshots. Build, production typecheck, established lint, owned lint and
  emitted recommended type-checked ESLint (zero errors/warnings) pass.
  Verification used Bun and temporary `--no-save --ignore-scripts` exact fixture
  peers `reflect-metadata@0.2.2`, `rxjs@7.8.2`, `@nestjs/core@11.1.6` because the
  machine's isolated installation did not expose a top-level fixture import.
  Checked package/lock files were preserved.
- Current supported homelab snapshot
  `12c16ec7307dd6a9000b7b03c94b856c3aec98b109cf6375d3183320075981aa`, job
  `laptop-test-b03d824ecffd`: binary 10 generator/46 emitted checks and build
  pass; cleanup exit 0. The existing OIDC crypto child fails with blank error
  output after 10.935s. Its cause is unconfirmed. The unchanged identical suite
  passes locally (4 cases, crypto case 0.749s). Existing budgets/assertions stay.
- An earlier full homelab snapshot before the deadline correction passed 31
  suites/176 cases with one existing skip/two snapshots, but failed that same
  existing crypto child. This is diagnostic history, not a final full pass.

Required exact-head Node 18/20/22/24 CI is separate publication evidence and must
be read back before consumption. No real keys, private native storage, Tus hooks,
MinIO bytes, authorized actors, staging or production were exercised here.
