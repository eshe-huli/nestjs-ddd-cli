# Node18 release policy repair

Source-only root delegation2026-10-08. Isolated branch
`codex/node18-release-policy-20261008` starts at freshly fetched
`origin/main=53ca0a9f7c946e0617708deae2915e96de52acc1`.
The unrelated untracked `.impeccable/` remains preserved. No primary-checkout,
generator, dispatcher, package-version, tag or publication change.

| ID | Accepted requirement | Current evidence |
| --- | --- | --- |
| R1 | Declare the existing Node>=18 contract as a major relative to published3.2.2 Node>=14 | Verified published commit/tag and actual merge analyzer before/after |
| R2 | Breaking bang/footer always takes major precedence while ordinary release semantics stay intact | Real installed analyzer39 cases + portable Jest wrapper |
| R3 | Existing named conventionalcommits preset must be installed | Exact dev-only9.1.0, verified registry integrity and Bun lock |
| R4 | Existing npm CI lock provenance must come from the actual manager without local npm | Independent Node24 lock-metadata job37814789276 succeeded; only necessary emitted additions consumed |
| R5 | No publication/token access or unreviewed commit/push | Root reviewed source and authorized draft PR10/artifact integration; registry publication remains held |

## Reproduced baseline

The verified restored annotated `v3.2.2^{commit}` is
`978a49abe04b4daeebed6a6d7b06bd2a421eb070`; its source package is3.2.2 with
`engines.node=">=14.0.0"`. Current main already declares `>=18.0.0`.
Actual merge53ca0a9 has both `feat(generator)!` and a `BREAKING CHANGE` footer
explaining Node14/16 incompatibility. The fixture preserves that exact public
commit message and parent analyzer configuration, not a fabricated parsed
commit object.

Real semantic-release24.2.7 resolves commit-analyzer13.0.1 through
`createRequire(realpathSync(node_modules/semantic-release/package.json))`,
then dynamically imports its actual resolved ESM module. Before adding the
already configured preset, execution failed
`MODULE_NOT_FOUND: conventional-changelog-conventionalcommits`; neither
manifest nor Bun/npm lock included it. No fallback parser was substituted.

Root approved exact dev-only
`conventional-changelog-conventionalcommits@9.1.0`, whose registry metadata
declares Node>=18 and integrity
`sha512-MnbEysR8wWa8dAEvbj5xcBgJKQlX/m0lhS8DsyAAWDHdfs2faDJxTgzRYlRYpXSe7UiKrIIlB4TrBKU9q9DgkA==`.
It was added with `bun add --dev --exact --ignore-scripts`; unrelated dependency
ranges/versions remain intact. Registry latest10.4.1 requiresNode>=22, so it was
not selected. Both analyzer and release-notes configuration keep their existing
named preset.

After that installation, the actual unmodified current and parent analyzer
policies both returned `minor` for the real merge. The configured feat rule
matches before default breaking rules are considered. Adding the explicit
`{breaking:true,release:"major"}` custom rule fixes precedence without
rewriting the remaining custom rules.
[Pinned analyzer behavior](https://github.com/semantic-release/commit-analyzer/blob/v13.0.1/README.md)
explains matching/custom-rule precedence; actual installed execution is the
proof for this repository.

## Local proof and current limits

`bun tests/fixtures/release-policy.mjs` passes39 cases against the installed
plugin and preset. Actual parent merge→minor; corrected actual merge→major;
semver computes prospective4.0.0 from published3.2.2. That prospective result
does not mutate a package version or create a tag.
The installed release-notes-generator also renders the real merge into a
breaking-change section declaring Node>=18 and that Node14/16 users retain3.2.2;
the portable fixture asserts all three statements.

Every ordinary feat/fix/perf/revert/docs/refactor result is preserved. Ordinary
chore/test/build/ci/style and nonconventional/empty histories remain no-release.
Every tested type's bang and breaking footer produces major, including types
ordinarily excluded from releases. Mixed commits keep the highest warranted
release.

The default-discovered Jest test invokes the real portable fixture with Bun,
which existing CI already installs;1 wrapper test passes locally. Production
`bun run typecheck` and `bun run build` pass; focused nonrewriting ESLint has
zero warnings. No analyzer/preset/config mock or suppressed assertion is used.
This is Bun/local analyzer evidence, not a new established Node release run.

The only CI addition is an independent Node24 job using existing checkout and
setup-node actions to run
`npm install --package-lock-only --ignore-scripts --no-audit --no-fund` remotely,
then upload only `package-lock.json`. Existing test/build/publish job bodies,
package managers, release credentials and branch conditions are unchanged.
Root reviewed the source candidate and authorized normal commit/push plus draft
[PR10](https://github.com/eshe-huli/nestjs-ddd-cli/pull/10). Its initial head is
`c88807764f245ca4b6dcd54e56f0337339d7a57e`. Actual CI37814789276 produced the
`npm-lock-metadata` artifact successfully. Node18/22/24 install steps failed
with EUSAGE because the old npm lock did not yet include the preset; Node20 was
cancelled by matrix fail-fast. The publisher was skipped by its existing branch
condition. No tests were suppressed or release credentials accessed.

The downloaded artifact SHA256 is
`884f6434689615078c02560f95c3ef4f79d96e4e9e552b89224e4972a1db13e1`.
Structural review checked every one of the1026 preexisting package records:
versions, resolved URLs, integrity, dependency/optional-dependency maps and
engine declarations are unchanged; no package was removed. The only new
package is the approved preset9.1.0. Only the exact manager-emitted root dev
dependency and its package record were consumed. Unrelated peer-flag removals
and key-order normalization in the artifact were deliberately excluded. The
lockfile now adds14 lines with no preexisting record changes. This consumes
actual npm metadata rather than deriving npm fields from Bun or running npm
locally. Exact-head Node matrix proof remains pending after this lock commit.

Root reports the prior main publication failed npm verifyConditions with
EINVALIDNPMTOKEN/401 before analysis; no token was read and no publication/rerun
was attempted here. Source review and artifact generation/consumption are
complete; exact-head Node CI and a valid securely supplied registry token remain
separate gates. The PR stays draft and unmerged.
