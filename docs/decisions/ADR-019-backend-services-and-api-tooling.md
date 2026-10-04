# ADR-019 — Backend Services and API Tooling

**Decision:** Accepted for staged planning 2026-10-03. **Current:** Zod config/auth/note
contracts and auth/note OpenAPI records exist. Pino/Redis admission were implemented in
1D, note callers in 1E. BullMQ, Swagger/Postman generation and optional Nginx remain planned;
this accepted decision itself did not install/deploy services.

## Context

The accepted full-stack model needs runtime input checks, understandable API contracts,
abuse controls and future long-running work. The user agreed to these tools while explicitly
excluding MinIO. Naming tools must not create a worker/ingress deployment or make quotas disappear.

## Decision

Use Zod for runtime boundaries, Pino for safe structured metadata, Redis for expiring limits
and job coordination, BullMQ with a separate Node worker for long work, and versioned
OpenAPI/Swagger/generated Postman for APIs. Nginx is optional self-hosted ingress; managed
ingress may replace it. Normal note saves go directly to PostgreSQL, independent of queues.

## Alternatives considered

- Synchronous long tasks in request handlers: simpler first implementation, but ties work
  to request/runtime duration and lacks durable retry coordination.
- Ad-hoc in-process queue: low setup cost, but loses coordination on process restart and
  becomes harder to operate across instances.
- Unstructured logs/manual unrelated contracts: fewer dependencies, but private-error
  review and schema/route consistency are harder to maintain.
- Custom ingress on every host: redundant where a managed provider already supplies it.

## Why this approach

The accepted separation keeps fast record writes independent of future long work and
keeps inputs/contracts explicit. Queue implementation waits for real jobs, avoiding an
unused worker. Zod is already used; the broader contract generation approach is not selected yet.

## Trade-offs

Redis/worker add command quotas, hosting, retry/idempotency and operational complexity;
background polling may cost resources without users. Pino needs deliberate field selection
and framework/proxy-log review. Contracts need drift checks, not merely generated files.
Nginx adds TLS/configuration maintenance if self-hosted. Free libraries do not imply free
unlimited hosting or complete security.

## Consequences

1D owns admission/Pino; 1H owns interactive/generated tooling. Phase 4 owns jobs/files,
outbox/reconciliation and private result APIs. No bodies/secrets in queue payloads/logs or
canonical notes in Redis. Security gates activate with the feature; provider/topology/cost
must be checked before installation/deployment. The existing OpenAPI file is not proof of
automated route drift enforcement or Postman acceptance.

[Services](../integrations/backend-services.md) · [API tooling](../integrations/api-tooling.md) ·
[Dated hosting research](../integrations/hosting-and-costs.md) · [Phase 1 progress](../../.agent/active/phase-01-foundation.md).
