# ADR-003 — Dexie over Raw IndexedDB

**Decision status:** ❌ Superseded on 2026-10-03 by [ADR-018](ADR-018-full-stack-server-storage.md).
**Historical implementation:** This decision was never implemented in application code. Historical sections below describe the former v2 plan, not current instructions.
**Replacement:** Next.js runtime APIs, Supabase Auth/PostgreSQL/Storage, no persistent browser notes and no E2EE vault.

**Recorded:** 2026-10-03.

## Context

MindMora needs typed asynchronous persistence, schema versions, and reliable transactions behind small repositories.

## Decision

Use Dexie to wrap IndexedDB; one database module owns versions and table declarations, and feature repositories own domain operations.

## Alternatives

Raw IndexedDB; another wrapper; direct storage calls throughout UI components.

## Why

A typed promise-based interface keeps persistence focused and supports schema evolution without scattering browser database mechanics.

## Trade-offs

Adds a dependency and requires compatibility/license verification. Simulated IndexedDB tests need real-browser coverage. Dexie is not automatic Drive synchronization.

## Consequences

Feature components never import database tables. Test repository behavior with isolated databases and verify durability in a browser. Plan and test upgrades when persisted models evolve.

## References

[Product specification](../../PRODUCT_SPEC.md) · [Architecture](../../ARCHITECTURE.md) ·
[Phase 1 ExecPlan](../../.agent/active/phase-01-foundation.md)

## Historical foundation security update — before the full-stack revision

The storage choice remains unchanged. [ADR-017](ADR-017-client-side-encryption.md) now
requires encrypted knowledge records before persistence. Plaintext domain objects are
in-memory views; storage/indexes must not contain private title/body fields. Implementation
and vault-specific SEC verification were planned at that time; this entire requirement is now superseded by ADR-018. Current SEC IDs refer to the full-stack security contract, not these vault tests.
