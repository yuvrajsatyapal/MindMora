# ADR-001 — Static Export

**Decision status:** ❌ Superseded on 2026-10-03 by [ADR-018](ADR-018-full-stack-server-storage.md).
**Historical implementation:** Static export was implemented for the UI showcase only; its runtime migration is planned. Historical sections below describe the former v2 plan, not current instructions.
**Replacement:** Next.js runtime APIs, Supabase Auth/PostgreSQL/Storage, no persistent browser notes and no E2EE vault.

**Recorded:** 2026-10-03.

## Context

MindMora must run as a frontend-only application without server-owned knowledge storage.

## Decision

Use Next.js App Router static export and browser-side application services.

## Alternatives

A request-time Next.js server; a custom backend; a different static SPA framework.

## Why

This meets the specified frontend-only boundary while retaining the React/Next.js ecosystem.

## Trade-offs

No runtime server routes or persistence Server Actions. Arbitrary local note IDs cannot require prebuilt dynamic pages. Static hosting and browser API compatibility require validation.

## Consequences

Use stable browser routes plus URL state for local note IDs. Initialize browser-only storage on the client. Validate exported output on a static server; choose hosting only after verifying current terms.

## References

[Product specification](../../PRODUCT_SPEC.md) · [Architecture](../../ARCHITECTURE.md) ·
[Phase 1 ExecPlan](../../.agent/active/phase-01-foundation.md)
