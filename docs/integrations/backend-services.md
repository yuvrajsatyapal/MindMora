# Redis, Jobs, Ingress and Logging

**Status:** 📋 Planned, accepted 2026-10-03. No Redis, BullMQ, Pino or Nginx runtime exists in current source. Supabase Auth/database are separate implemented integrations. The behaviors below are requirements for future work, not observed service behavior.

## Roles

| Tool | MindMora responsibility | Scope |
|---|---|---|
| Redis-compatible service | Expiring API rate counters and BullMQ queue coordination | Phase 1 limits; Phase 4 queue |
| BullMQ OSS | Enqueue, retry and coordinate exports/indexing/attachment/optional AI tasks | Phase 4 onward |
| Node worker | Executes queued work, loads authorized source data and writes scoped results | Separate hosted process, Phase 4 |
| Nginx OSS | HTTPS/reverse proxy when self-hosted; optional edge limits/load balancing | Deployment-dependent; managed ingress can replace |
| Pino | Structured JSON backend/worker logs | Phase 1 onward, safe metadata only |

```text
Browser → HTTPS ingress → Next.js API → session/validation/ownership/admission
                                      ├→ Drizzle → PostgreSQL (ordinary saves)
                                      └→ job/outbox → BullMQ → Redis → Node worker
                                                                         ↓
                                                         private result + DB status
Pino records safe metadata from API and worker; no payloads or credentials.
```

## Redis and limits

Upstash is a candidate free-tier provider, not a deployed dependency. Check BullMQ TCP/TLS/Lua/blocking-command support and `noeviction`, quotas and persistence; rate-counter expiry must not evict queue data. Use separate namespaces and capacity budgeting; isolate instances if provider/config requires it, without assuming multiple free databases. Never store readable notes or tokens in Redis. General session caching is not required; later caches must respect expiry/revocation.

Limit public login/start routes and expensive job creation by trustworthy IP/user identity. Choose windows/budgets during Phase 1D using expected workload, not arbitrary undocumented numbers. Return 429/Retry-After. Redis outage rejects public auth/expensive jobs; basic note APIs use an explicit conservative local fallback while still validating identity/ownership. Multi-instance fallback limitations are documented. Do not trust arbitrary forwarded IP headers; Nginx/managed ingress must sanitize them.

## Worker durability

Jobs contain `jobId`, owner ID, referenced records and revision. Validate job Zod schema and recheck ownership/deletion/revision at execution. Use bounded retries/backoff, idempotency, timeouts, concurrency, graceful shutdown, job/result retention and explicit failed status. PostgreSQL outbox/status reconciles committed work with failed enqueue. Poll status on bounded intervals through authenticated APIs; completed objects use private short-lived download access. Worker cannot perform a credential-bearing AI job by persisting a BYOK secret in Redis. AI worker scope must have an approved credential strategy.

A browser Web Worker serves tab-local computation; it is not this Node queue worker. Serverless handlers returning a response cannot be assumed to keep processing. Worker hosting is a separate capacity/cost decision; idle queue polling consumes Redis commands too.

## Ingress

Nginx terminates HTTPS and routes page/API traffic to Next.js. If upstream leaves the trusted host/network, use encrypted upstream transport. Configure bounded request bodies/timeouts, forwarded-header trust and no private caching. Nginx does not store notes or replace app auth/RLS. Managed hosting may already provide all required ingress functions. No custom Nginx file will be added until deployment topology is selected.

## Logging

Pino fields: timestamp, level, correlation ID, safe operation, response status, duration, safe error code; worker adds job ID/attempt. Do not log URLs containing private query text, bodies/titles, raw errors with sensitive payloads, cookies, tokens, keys, signed URLs or SQL parameters. Redaction tests use distinctive markers and scan output. Production JSON logs have restricted access/retention; log aggregation/hosting isn't automatically free. Operational logs are distinct from optional user analytics.

## Acceptance and trade-offs

SEC-05/07 test logging/limits in Phase 1. SEC-09 covers enqueue outages, duplicate retry, stale/deleted records, foreign-owner jobs/results, bounded retention and Redis payload scans in Phase 4. Reference IDs still leak metadata to infrastructure; secure credentials/network and restrict access. Redis/BullMQ improve throughput and reliability, not confidentiality by themselves.

[Redis/BullMQ integration](https://upstash.com/docs/redis/integrations/bullmq) · [BullMQ production](https://docs.bullmq.io/guide/going-to-production) · [Nginx proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/) · [Pino](https://github.com/pinojs/pino) · [budget](hosting-and-costs.md)
