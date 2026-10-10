# Held Kafka intake and retained worker history

Source prerequisite for MyDermaLife's October 8 full web closeout. Base origin/main53ca0a9; no package publication or ddd update.

Kafka options now accept an optional boolean enabled flag. Explicit false makes no broker connection; omitted preserves existing caller behavior. Both Kafka receipt and external projection migrations now refuse destructive down when retained history exists, under a PostgreSQL transaction/table lock. The external worker's injected interface imports are explicitly type-only for Nest consumers with isolatedModules plus emitDecoratorMetadata.

The actual CLI build ran once, and actual dry-run/generation consumed these recipes in Communication. Source template-only follow-ups copied only changed runtime templates; the generator TypeScript build remained unchanged. Communication startup compilation exposed the decorated-import issue; fixing the upstream template and regenerating the unchanged emitted target resolved it. The actual compiled Nest service started all providers with both worker/listener disabled and installed six pending migrations on fresh private PostgreSQL17.11. HTTP ready200; intake/work/booking receipts/intents/events all0. This is held-rollout/bootstrap evidence, not broker consumption, populated recovery, migration reversal, provider delivery or staging/actor proof.

No new tests, automated suites/lint/types/doctor/Sonar, migration rehearsal or manual CI dispatch/retry. The local npx/lint-staged rewrite hook is deferred under the human's October 9–10 implementation-first policy; CI/release gates remain unchanged and required. Existing source and tests remain preserved.

Pending whole-project final checks and real broker/provenance/replay/lease/retained-history/restore acceptance before rollout.
