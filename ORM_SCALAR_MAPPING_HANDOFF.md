# Explicit ORM field mapping — October 10

The entity hbs template emitted inferred @Column metadata for non-money scalar
fields although field.utils already computes SQL types and the scaffold emitter
uses them. An object-shaped json field therefore could not initialize PostgreSQL
TypeORM metadata. The template now consumes existing dbType while retaining
unique/optional flags and the unchanged relation path. No new type policy or
registry release is introduced.

The existing compiled ddd3.2.2 entry reused its JS; only the changed template was
copied into its ignored runtime template directory. ClinicalRecordRevision was
generated through actual dry-run/generation, then its ORM alone was regenerated
after the upstream fix. Generated jsonb/uuid/int/timestamp metadata initialized
in the actual startup-built Clinical API and disposable PostgreSQL17.11 install.
Domain specialization is recorded in the Clinical owner handoff.

The established binary/deadline changes remain. CI/suites recorded for784d566 are
historical evidence for that head, not current-template acceptance. No tests/specs
or new automated suite/lint/typecheck/CI dispatch were requested. Final checks
remain deferred by the user's implementation-first policy. Existing release
controls stay required; no registry publication, live provider or staging claim.
