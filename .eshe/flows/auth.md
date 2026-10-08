# Identity and access decisions

Trigger: new project access model, account/login work, machine API access, tenant/role changes, or a defect affecting who can do what. Inputs: actor/jobs, exposure, data ownership, existing identity contracts and affected clients.

## Resolve in this order

| Step | Required decision | Evidence / output | If unresolved |
| --- | --- | --- | --- |
| A1 Surface | Which operations are public, authenticated, restricted, or administrative? Include machine callers | Actor × operation × data-scope matrix | Do not default every route to public or require accounts everywhere |
| A2 Identity owner | Reuse existing organizational identity, select a managed provider, or operate an identity service? Which system owns people, credentials, memberships and permissions? | Explicit owner map and build/buy/operate decision | Inspect existing authority, then ask material ownership/cost tradeoff |
| A3 Enrollment and sign-in | Invite/self-registration/provisioning; password, passkey, link/code, federation/SSO as applicable; verification and stronger authentication requirements | Selected methods per actor/client, with rationale and failure path | Recommend appropriate options using current verified provider/platform capabilities when selecting |
| A4 Session/client contract | Browser/mobile/service credential handling; session lifetime, refresh, logout, revocation; callback/redirect contract where relevant | Client/server session and credential lifecycle | “JWT” alone does not close this decision |
| A5 Authorization | Roles/attributes/relationships/scopes as appropriate; tenant context; enforcement owner; administrative delegation | Permission matrix and trusted enforcement boundary | Login success cannot stand in for permission |
| A6 Lifecycle | Recovery, lost factors, invitations, suspension, deletion, access changes, compromised/rotated credentials and support intervention | State transitions, authority and audit requirements | Missing recovery path blocks promising that capability |
| A7 Proof | Required allow/deny, tenant-boundary, expiry/revocation, recovery and abuse/error cases | Controlled actor-specific evidence plan | No available test identity means missing proof, not successful authorization |

The method, protocol/token format, identity provider and authorization model are distinct decisions. Existing integrations should be inspected before proposing replacement. No broad provider choice is made in this protocol.

## Explicit no-login branch

If no human sign-in is needed, record which actors/operations are public and why. Still assess administration/publishing, machine access and protected data; mark only genuinely absent branches not-applicable. “No login screen” is not evidence of “no access-control requirements.”

## Existing-code branch

Capture how access actually works and compare it with the accepted model. A custom auth implementation is not automatically defective; justify concerns with evidence. If remediation exceeds the task's authority, use [refactor](refactor.md) to prepare the developer decision. Do not silently weaken checks or replace an identity provider to make a test pass.

Gate: every in-scope operation has an intentional access policy and authoritative enforcement owner; implementation-critical identity/session/permission decisions are accepted; remaining questions have explicit blocking milestones. Then use [change](change.md) for implementation and [migration](migration.md) if existing accounts, sessions or consumers move.
