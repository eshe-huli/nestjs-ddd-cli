# Bounded HTTP evidence transports — 2026-10-08

This additive recipe starts from upstream `origin/main`
`53ca0a9f7c946e0617708deae2915e96de52acc1`. It emits one dependency-free
`src/shared/http/bounded-binary-http.client.ts` and its consumer documentation.
It uses the existing all-target preflight and successor-safe static recipe
writer. A separate corrective commit strengthens the existing canonical JSON
transport shared by the JSON, introspection and client-credentials recipes.
Their APIs, limits, error reasons and single-attempt semantics stay unchanged.
OIDC authentication, deployment, package, lockfile and CI sources are unchanged.
No package release or Media deployment is authorized by this work.

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

The JSON transport now uses that same whole-operation deadline invariant and a
single response capacity buffer. Its cutoff starts before path/query or JSON/form
preparation, covers transport and headers, and is checked before and after each
read, parse and freeze. It copies each chunk before another read. A producer
reusing its chunk buffer cannot change accepted bytes, and empty synchronous
chunks cannot indefinitely starve the cutoff. Cancellation cleanup cannot mask
the sanitized result. No provider admission or consumer authorization changed.

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
- Binary source local full CLI: 32 suites, 177 passed, one existing opt-in init skip,
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

## Canonical JSON correction

Independent review of the original canonical JSON reader found timer starvation
and per-chunk memory overhead also affected existing JSON consumers. Four added
behavior cases failed the unchanged baseline: a finite synchronous empty stream
returned success after 43ms against 10ms; delayed transport followed by an empty
stream returned success after 176ms against 120ms; a late header returned success
after 31ms against 10ms; and a reused producer buffer changed the parsed value.
The new cutoff/capacity implementation passes all four. Baseline receipt:
`/tmp/mdl-json-deadline-baseline-20261008.log` on the owning host.

The corrected template and regressions received independent read-only review.
Focused current source passes four generator suites/41 cases, with strict emitted
compilation and JSON 33, introspection/shared JSON 67, client-credentials/shared
JSON 62 and binary 46 consumer cases. Established production typecheck/lint and
independent emitted JSON type-checked ESLint pass with zero errors/warnings.
Consumer review then found the late-header fixture's bound `Headers.get`
lost its type under an existing consumer's `strictBindCallApply: false` flag.
A separate fixture-only correction snapshots `new Headers(response.headers)`
and reads that snapshot from the spy. The same timing/assertions remain.
Both emitted helper and spec now strict-compile and pass recommended
type-checked ESLint with that consumer flag (zero errors/warnings); the
11-case JSON generator suite and all 33 emitted behaviors pass. Production
helper bytes are unchanged by this correction.
Combined current full local CLI passes 32 suites/177 cases, one existing opt-in
init skip and two snapshots (24.964s). This includes the unchanged OIDC crypto
fixture. Receipt: `/tmp/mdl-combined-http-full-20261008.log` on the owning host.

Current supported homelab snapshot
`631061cce6d218e629215427bb0728e109a91e228ce71331bde997cbb15eca9c`, job
`laptop-test-89d4e3afc014` on k3s-03: four generator suites/41 cases and the
same 33/67/62/46 emitted cases pass, as do build, production typecheck and
established lint. Exit and cleanup are both zero. This profile covers the four
affected transport recipes; it does not repeat or claim a full remote pass for
the previously failing unchanged OIDC crypto child.

Draft source PR: https://github.com/eshe-huli/nestjs-ddd-cli/pull/12.
The binary-only head `eacf2a26c4ebea8a1b45e1c70114261369af34cc` passed
Node 18/20/22/24 CI run 37828007175. The corrected combined head must pass its
own exact-head Node matrix before any consumer regeneration; binary-only CI
does not authorize consumption of this corrective source.

Required exact-head Node 18/20/22/24 CI is separate publication evidence and must
be read back before consumption. No real keys, private native storage, Tus hooks,
MinIO bytes, authorized actors, staging or production were exercised here.
