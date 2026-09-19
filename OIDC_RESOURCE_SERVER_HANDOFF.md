# OIDC resource-server recipe checkpoint — September 12

Owner requested implementation stop and commit/push; this is an unpublished
candidate, not production authentication acceptance. Branch
codex/oidc-resource-server, base a636dad. No consuming MyDermaLife service changed.

The recipe emits a verifier, portable real-key verifier spec, sync/async Nest
module, barrel, and operator docs through the DDD CLI. It requires explicit
trusted HTTPS issuer/JWKS, resource audiences, authorized clients, RS256,
exp/iat/sub/azp, optional nbf, and bounded clock tolerance. Configuration arrays
are snapshotted. Tokens, claims, key material, and upstream bodies never appear
in authentication errors. No AppModule wiring or automatic business grants.
The verifier uses Node/Bun crypto and Fetch only; generated consumers add no
dependency and do not migrate their package-manager lockfiles.

Current proof is recorded by the follow-up commit on this branch: the generated
output is strict-typechecked, the standalone CommonJS/Bun fixture executes real
RSA verification and rejection cases, and the generated consumer spec executes
19 real-key cases. Dry-run writes nothing; repeat/conflict and symlink safeguards
remain tested. Full-repository CI and package publication are separate gates.
Package version remains 3.2.2.

The local pre-commit hook runs `npx lint-staged` with automatic source rewriting.
For this explicitly requested stop/checkpoint only it is disabled: local commands
must use Bun, and the owner asked to stop executable changes. The already-recorded
focused checks are retained; this is not a claim that the full hook/CI ran.

Important: a valid JWT signature + aud/azp is not proof that a provider token is
an access token rather than an ID token. The consuming service must fix and prove
its provider access-token/active-human/organization contract separately. Do not
invent a generic token-kind bypass or put MyDermaLife IAM policy in this recipe.

Consumer command: `ddd recipe oidc-resource-server --path <service> --dry-run`,
then the same command without `--dry-run`. Prefer
`OidcResourceServerModule.registerAsync` with the owning service's validated
`ConfigService`. Publish only through the normal authorized registry workflow,
then consume with dry-run in Identity. Do not run `ddd update` or generate the
Pulsar event-backbone for MyDermaLife (Kafka/Debezium).
