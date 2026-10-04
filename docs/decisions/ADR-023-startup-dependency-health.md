# ADR-023 — Startup Dependency Health

**Decision:** Accepted by the user's explicit startup-health request, 2026-10-04.
✅ Server-only startup probes; no periodic health monitor or note API.

## Context

The user wants visible Redis/PostgreSQL connectivity each time Next starts, safe messages,
one probe per process, friendly development and production fail-fast. Existing clients are
lazy and request-owned, so startup could otherwise appear healthy before a dependency fails.

## Decision and rationale

Use Next Node instrumentation and a process-global promise, not request handlers. Run bounded
PING/SELECT 1 through dedicated short-lived clients and the existing TLS/runtime configuration.
Print only fixed service names and classified errors. Production requires both and exits
nonzero on failure; development warns and continues. Skip builds and Edge. Explicit exit is
necessary because observed Next 16.3.8 instrumentation rejection can leave the process alive;
its early Ready banner is not an application readiness signal.

## Alternatives

- Request-time checks only: keeps cold startup fast but does not meet the requested visible
  startup verification. Existing request admission/auth protections remain mandatory.
- Persistent probing/request pools: avoids an extra connection but couples startup to shared
  resources or identity-scoped transactions. Dedicated clients isolate lifecycle and close.
- Throw from instrumentation only: conventional, but actual process tests show it does not
  reliably stop this Next version. Explicit production termination enforces fail-fast.
- Warn in every environment: useful for public specimens, but contradicts production
  fail-fast. Production browser fixtures now provision temporary local services instead.

## Trade-offs and consequences

Production public preview now needs both configured services; builds and local dev do not.
Restarts/serverless cold starts consume probes and may fail on transient outages. Each process
checks once, so later failures still need request-level handling; no readiness/liveness endpoint
is implied. SELECT 1/PING prove connectivity only, not RLS/schema/EVAL permission or quotas.
Probe error classification avoids raw private details at the cost of reduced diagnostics.
Hosted access/log/retention configuration remains independent. No paid service/deployment or
knowledge mutation. [Exact behavior](../integrations/backend-services.md#server-startup-health--implemented-follow-up-to-1d).
