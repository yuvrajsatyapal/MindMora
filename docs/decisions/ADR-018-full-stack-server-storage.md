# ADR-018 — Server-Authoritative Storage without a Browser Vault

**Decision:** Accepted 2026-10-03. **Current:** Node runtime, auth and minimal SQL foundation
implemented through 1C; knowledge CRUD/UI and private cache lifecycle implemented through 1G; Storage planned.
Supersedes ADR-001/002/003/017 as requirements; their historical records remain.

## Context

The user replaced the proposed Dexie/IndexedDB/Drive workspace and explicitly removed
end-to-end vault encryption, passphrases and recovery keys. That changes data authority,
connectivity assumptions and who must be trusted, not merely the choice of storage library.

## Decision

Next.js Node APIs will mediate canonical Supabase PostgreSQL records and private Storage.
Use verified authentication/ownership, constrained SQL access and validated transport/
provider encryption configuration. Keep fetched data/drafts in browser memory; no durable
knowledge database/query persister/offline write queue. No E2EE vault is implemented.

## Alternatives considered

- Encrypted local-first vault: durable offline access and user-held keys, but incompatible
  with the user's chosen hosted workspace and removal of vault unlock/recovery flows.
- Server-stored E2EE: protects content from the provider but requires device keys/unlock,
  recovery and constraints on server computation; those were explicitly excluded.
- Plain browser persistence: avoids vault complexity but retains a second durable authority
  and does not meet the no-private-browser-persistence constraint.
- A separate session/account database: additional authority/operations without a present need.

## Why this approach

It follows the explicit hosted-storage choice and avoids synchronizing multiple durable
knowledge authorities or designing key recovery. Identity management replaces account
access recovery needs; it does not solve unsaved-draft loss or guarantee access during outage.

## Trade-offs

Canonical records can be shared across devices after APIs/UI arrive, but server/provider
compromise can reveal readable data and connectivity is needed for durable writes. Browser
memory/DOM exposure remains necessary for editing and vulnerable to XSS/device compromise.
Hosted quotas, pause/backup behavior and provider encryption settings need verification.
There is no durable offline workspace or forensic RAM-erasure promise.

## Consequences

Public pages may remain prerendered, but deployment requires a Node runtime for private
APIs. Phase 1 builds runtime/auth/data/security/UI boundaries; Phase 4 builds jobs/files;
Phase 8 permits a public-only PWA cache. Automatic Drive sync and browser vault plans are
superseded, while portability and the remaining feature roadmap stay planned. Existing
visual components are retained; their local-save/sync wording must not be read as real behavior.

[Architecture](../../ARCHITECTURE.md) · [State](../architecture/state-management.md) ·
[Security](../architecture/security-architecture.md) · [Planned data flows](../architecture/full-stack-architecture.md) ·
[Dated outcomes](../phases/phase-01-foundation.md).
