# Jest ESM dependency compatibility

Authorized by the MyDermaLife root on 8 October 2026 after Care draft PR CI run
37793979297 failed under its existing Node 20/Jest runtime before two matching
suites executed. `@nestjs/config` 12 ships ESM JavaScript, while Jest's default
node_modules ignore policy bypassed the ts-jest transform. Bun's native module
loader had masked this gap. Edge's existing PR run 37794484910 passed, with its
older configuration mocks; it still shares the same framework configuration.

JEST-01: provide an additive `ddd recipe jest-cjs-compat` that dry-runs and updates
only the existing package.json Jest transform. Explicit allowJs/CommonJS test
overrides preserve production tsconfig, decorators, aliases, versions, scripts,
lockfiles and checked-in CI/container package managers. Whitelist only the exact
Nest configuration dependency; customized ESM/file-based/transform policies are
refused before mutation. Generator tests prove preservation and CommonJS export
transformation. Care and Edge consume through the CLI with actual unmocked Nest
configuration bootstrap regressions; no clinical or authorization behavior change.

Generator owners coordinated: courier/init owner has no Jest overlap; BFF owner
has no Jest overlap. Isolated branch starts from accepted `bcc3949`. Root integrates
additive dispatcher changes. No CLI publication or push is authorized here;
Care/Edge draft branches may be updated and their exact-head CI rechecked. No
merge, staging promotion or deployment belongs to this task.

Local recipe and adjacent resource-server/Joi checks pass all 12 cases, the
established production TypeScript build passes, and changed-file lint/diff checks
pass. Broad plain `tsc --noEmit` still reports unrelated existing CLI debt; it is
not substituted for the established build. CLI homelab receipt
`laptop-test-c8dedad82c54` passes all 12 cases across the recipe, resource-server
and Joi checks with source hash
`8a636ecc5523726063a502a74807bef7baed38135f24971aac8ded19b75ba75a`.

Care's full Bun/Jest receipt `laptop-test-82eb8544ea56` demonstrates a separate
runtime incompatibility: after transforming the ESM dependency to CommonJS,
Bun evaluates it as ESM and reports `exports is not defined`. Its 16 unaffected
suites and 103 cases pass; three importing suites cannot start. No passing Bun
Jest claim is made for the exact generated configuration. A separate Bun check
may retain all tests and the real ConfigModule with the documented command
override `--transformIgnorePatterns=/node_modules/`, allowing Bun's native ESM
loader to handle dependencies. The real bootstrap smoke passes locally under
that exception. This does not verify the CommonJS dependency transform; actual
unchanged Node 20 CI is authoritative for that proof. No local Node/npm fallback,
dependency mock, skipped test, version change or CI manager change is introduced.
