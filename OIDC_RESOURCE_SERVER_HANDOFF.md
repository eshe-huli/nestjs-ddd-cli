# OIDC resource-server recipe checkpoint — September 12

Owner requested implementation stop and commit/push; this is an unpublished
candidate, not production authentication acceptance. Branch
codex/oidc-resource-server, base a636dad. No consuming MyDermaLife service changed.

The new recipe emits verifier/module/barrel/docs through the DDD CLI. It requires
explicit trusted HTTPS issuer/JWKS, resource audiences, authorized clients,
asymmetric algorithms, exp/iat/sub/azp and bounded clock tolerance. Config arrays
are snapshotted. No tokens/claims/upstream bodies are returned in failure messages.
No AppModule wiring or automatic business grants. jose6.2.12 is a development
test dependency here; generated consumer requires jose^6.2.12.

Worker proof: focused generator tests, build/typecheck/lint and complete-file
Sonar passed. Generated CommonJS verifier passed37 real-key cases under Bun and
Node22.22 production-compatibility probe. Dry run writes nothing; repeat/conflict
and symlink safeguards tested. Full-repository CI/publishing not run for this
checkpoint. Root reviewed the recipe/template diff; further independent acceptance
remains before integration/publication. Package version remains3.2.2.

The local pre-commit hook runs `npx lint-staged` with automatic source rewriting.
For this explicitly requested stop/checkpoint only it is disabled: local commands
must use Bun, and the owner asked to stop executable changes. The already-recorded
focused checks are retained; this is not a claim that the full hook/CI ran.

Important: a valid JWT signature + aud/azp is not proof that a provider token is
an access token rather than an ID token. The consuming service must fix and prove
its provider access-token/active-human/organization contract separately. Do not
invent a generic token-kind bypass or put MyDermaLife IAM policy in this recipe.

Next: review tests/generated output, run complete appropriate CLI gates, integrate
under that repository's verified branch policy, publish only through its normal
authorized registry workflow, then consume with dry-run in Identity. Do not run
ddd update or generate the Pulsar event-backbone for MyDermaLife (Kafka/Debezium).
