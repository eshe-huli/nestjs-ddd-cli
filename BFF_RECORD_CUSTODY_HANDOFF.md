# Encrypted external session custody — 2026-10-09

Consumed the actual `ddd recipe oidc-bff-session` output from the upstream
restore-epoch candidate. The generator now emits AES-256-GCM record protection
and honors `features.tests=false`; no new specs were emitted or written.
Existing suites remain untouched and deferred to whole-project final validation.

The server-only adapter requires `BFF_SESSION_ENCRYPTION_KEYS` as explicit
approved secret JSON: exactly `activeKeyId` and `keys`, mapping 1–8 IDs to
canonical unpadded base64url encodings of 32 random bytes. No staging key was
generated, provisioned or committed. Retain old decryption keys for queued
credentials and any retained restore material. This is separate from
`BFF_RESTORE_EPOCH`, which still fences active handles after recovery.

Pending state, verifier, nonce and return path plus access/refresh credentials
are encrypted. Authenticated metadata binds the client, purpose, original epoch,
record ID, browser/generation and expiry where applicable. Lua retains one-time
claim, exact staged-pair transfer and per-app logout. Callback completion uses
the same store instance and its authenticated pending object. Retirement keeps
original context and can use retained old keys across an epoch advance.
Legacy plaintext records fail closed; no automatic conversion or queue purge.

Actual source operation: generated production files only, authenticated disposable
native Redis8.10.2 with two explicitly synthetic clients, real Lua/store login and
logout, a new store object reading saved custody, cross-client handle denial,
altered expiry metadata refusal, sibling storage session retained, old-key queued
credential recovered by a new-epoch owner, and storage-only retirement ack.
The inspected live string values and two native AOF files contained none of the
synthetic token or pending secret strings. This is not disk durability, Valkey
staging, provider revocation, restore-snapshot rollback or human actor evidence.

Actual changed Next development login/callback/logout routes in Patient16.3.3,
Pro16.3.3, Seller15.5.25 and Storefront15.5.25 returned503/private,no-store without
redirects or cookie writes under explicit missing encryption-key configuration.
The client configuration was synthetic and unregistered. It granted no identity,
domain, financial or clinical access. Initial Pro startup lacked dependencies;
locked Bun installation repaired that prerequisite without changing tracked locks.
Only that affected entry was resumed; unchanged Patient proof was reused.

CLI startup compilation and Next route compilation served actual software
operation. No tests, lint, typecheck, doctor, Sonar, benchmark or manual CI
dispatch ran. Existing generated test fixtures that omit the newly required
key ring are not current-format proof and need owner adaptation at final
validation. Enforced remote CI/release controls remain open. The local upstream
rewriting lint hook is skipped under the explicit hands-on-first/no per-commit
check instruction, not recorded as passed.

Staging Valkey activation remains held until authentication/private transport,
app ACLs, persistence/recovery controls and independently approved key custody
are established. Current metadata reads found no ory-staging namespace or
controller deployment in the expected external-secrets namespace. Provider credentials, Ory/database/ESO activation,
account preservation, real admission, migration/cohorts and coordinated
develop→staging release remain open. No engine/BFF image or staging activation.


The final packaged record ceilings are70,000 plaintext bytes/100,000 stored
characters to include JSON escaping of both16KiB token fields. This changes only
previously unoperated size ceilings. The ordinary native payload and missing-key
entry observations are reused; maximum escaped-size admission is not claimed.

The upstream [PR13](https://github.com/eshe-huli/nestjs-ddd-cli/pull/13) retains
`BFF_RECORD_CUSTODY_NATIVE.json` with actual observations and both artifact
snapshots. Payload-size relaxation is recorded separately from operated inputs.
