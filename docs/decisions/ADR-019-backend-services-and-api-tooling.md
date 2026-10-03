# ADR-019 — Backend Services and API Tooling

**Decision status:** Accepted for planning, 2026-10-03. **Implementation:** ✅ Zod for server configuration in 1A; 📋 other tooling/services; none deployed.

## Context

The user agreed to Redis/BullMQ workers, optional Nginx, structured Pino logging, Zod validation and OpenAPI/Swagger/Postman documentation while reviewing the full-stack design. MinIO was explicitly excluded.

## Decision

Use Redis for expiring request limits and job coordination; BullMQ OSS with a separate Node worker for exports/indexing/attachments and scoped optional AI. Regular saves go to PostgreSQL without queue dependency. Pino logs safe metadata; Zod validates runtime boundaries. Version OpenAPI, expose Swagger UI and generate Postman collections. Nginx is self-hosted ingress when needed; managed ingress may replace it.

## Alternatives

Synchronous long tasks inside request handlers; ad-hoc in-process queues; unstructured console logs; duplicated manually maintained API schemas; custom ingress on every managed host.

## Rationale

Separate fast note APIs from long work; keep runtime input and API contracts explicit and operations traceable without collecting private content. Delay queue implementation until a real job needs it.

## Trade-offs

Redis/worker introduce hosting, command quotas, retry/idempotency and operational work. Worker polling can consume resources without users. Optional Nginx needs TLS/configuration maintenance. RLS, ownership and session checks remain mandatory; these tools don't grant confidentiality themselves. Free libraries do not include free unlimited service hosting.

## Consequences

Phase 1 adds Zod/Pino/Redis limits/API contracts; Phase 4 adds jobs/files, durable outbox/reconciliation and scoped result APIs. No note bodies/secrets in queues, logs or Redis caches. Select/verify provider/worker/ingress topology before deployment. [Service design](../integrations/backend-services.md), [API tooling](../integrations/api-tooling.md) and [hosting budget](../integrations/hosting-and-costs.md) define planned acceptance.
