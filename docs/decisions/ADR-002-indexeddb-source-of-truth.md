# ADR-002 — IndexedDB as Source of Truth

**Decision status:** ❌ Superseded on 2026-10-03 by [ADR-018](ADR-018-full-stack-server-storage.md).
**Historical implementation:** This decision was never implemented in application code. Historical sections below describe the former v2 plan, not current instructions.
**Replacement:** Next.js runtime APIs, Supabase Auth/PostgreSQL/Storage, no persistent browser notes and no E2EE vault.

**Recorded:** 2026-10-03.

## Context

Users must edit without network/account access and own knowledge data, with Drive synchronization later.

## Decision

Persist canonical knowledge data in local IndexedDB; commit local writes before optional cloud sync.

## Alternatives

Server database as canonical store; localStorage; remote API cache as authoritative data.

## Why

Local transactions and structured storage support the required local-first write path.

## Trade-offs

Browser storage can fail, be evicted, or be cleared. Multi-device sync needs durable queues and conflict handling. IndexedDB persistence alone does not cache the app shell.

## Consequences

Repositories report committed writes accurately; failed writes retain drafts. Later sync adds atomic durable operations and explicit conflicts. Supabase never stores knowledge data.

## References

[Product specification](../../PRODUCT_SPEC.md) · [Architecture](../../ARCHITECTURE.md) ·
[Phase 1 ExecPlan](../../.agent/active/phase-01-foundation.md)

## Historical foundation security update — before the full-stack revision

The storage choice remains unchanged. [ADR-017](ADR-017-client-side-encryption.md) now
requires encrypted knowledge records before persistence. Plaintext domain objects are
in-memory views; storage/indexes must not contain private title/body fields. Implementation
and vault-specific SEC verification were planned at that time; this entire requirement is now superseded by ADR-018. Current SEC IDs refer to the full-stack security contract, not these vault tests.
