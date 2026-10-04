# ADR-022 — HTTP Admission and Safe Logging

**Decision:** Accepted for Milestone 1D, 2026-10-04. ✅ Auth admission/logging and reusable
HTTP/basic/expensive helpers implemented; 1E note API basic callers implemented. Hosted
deployment and expensive-job callers remain planned.

## Context

Before exposing notes, the existing auth routes need bounded requests, stable errors,
observable safe metadata and shared admission that cannot be bypassed by forged headers.
Redis failure must not silently authorize expensive/provider work. The selected host and
proxy are unknown, and the budget target is 3–4 daily users.

## Decision

Use a server-only node-redis client with atomic first-hit counters/TTL and bounded deadlines.
Ignore forwarded headers by default, sharing auth budgets. Explicit x-real-ip trust requires
sanitizing ingress and closed direct access. Fail auth/expensive admission closed. Basic
helpers require an issued verified owner and permit a bounded conservative process-local
fallback. Return typed fixed errors, server-generated correlation IDs and private no-store.
Pino is hidden behind a schema/metadata allowlist plus static redaction, without raw errors
or free-form messages. Exact policy and flow are owned by the [services guide](../integrations/backend-services.md).

## Alternatives and rationale

- Trust arbitrary X-Forwarded-For: better apparent per-client distribution, but clients can
  rotate a header and bypass budgets. Default shared admission is honest about absent ingress.
- Local-only limits: simpler, but cannot coordinate healthy instances. Redis supplies a
  shared atomic counter; local fallback is explicitly weaker.
- Sliding windows/token buckets: smoother bursts but more coordination/state. First-hit
  counters are adequate for this small foundation; adjacent-window bursts remain possible.
- Fail all basic reads/writes closed on outage: strongest consistency of admission, but the
  product requires conservative basic availability without weakening authentication.
- Log requests/errors and redact fields: brittle against unknown/nested payloads. A narrow
  validated facade prevents private values entering serialization in the first place.

## Trade-offs and consequences

Shared auth defaults can let one caller exhaust everyone’s budget. Configured forwarding
trust can be unsafe without real ingress checks. Process fallback is not global and resets
on restart; future routes must disclose degradation. Logout admission rejection retains
cookies and is unsuccessful logout. Redis EVAL/internal commands consume provider quota;
stdout requires external retention/access controls. Local Valkey tests prove compatible
counter behavior, not hosted TLS, quotas, cloud security or production readiness.

No queues, canonical Redis knowledge/session cache, note routes, deployment or paid resource.
[Security](../architecture/security-architecture.md) · [ADR-019](ADR-019-backend-services-and-api-tooling.md).
