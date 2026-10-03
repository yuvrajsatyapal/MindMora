# ADR-018 — Full-Stack Server Storage Without a Browser Vault

**Decision status:** Accepted by user, 2026-10-03. **Implementation:** ✅ Runtime migration/server boundary (1A); 📋 auth/storage/CRUD pending.

## Context

The user replaced the proposed Dexie/IndexedDB/Drive architecture with server-managed knowledge storage and explicitly removed end-to-end vault encryption, passphrases and recovery keys. Documentation was held unchanged during discussion and updated only after authorization.

## Decision

Runtime Next.js backend APIs mediate Supabase PostgreSQL knowledge and private Storage. Drizzle repositories transact owner-scoped revisions. Google sign-in through Supabase Auth precedes private workspace access. Use transport/provider encryption at rest and access controls, not user-held E2EE. TanStack Query keeps API records in browser memory only; no persistent browser knowledge cache/database or offline write queue.

## Alternatives

The former encrypted local-first vault; server-stored E2EE with device key unlock; unencrypted browser knowledge persistence; a second backend database for auth.

## Rationale

Follow the user's chosen hosted workspace model, simplify device access/key recovery and use one server-authoritative data model. This is a trust-model change, not proof that server storage eliminates browser-memory or XSS risks.

## Trade-offs

Server/provider can read notes, backend compromise can expose data and network outages block durable saves. Browser memory is necessary to view/edit and can be exposed by XSS/compromised devices. Free-tier quota/pause and backup limits must be checked. No durable offline workspace. Losing session access is solved through managed identity, not vault recovery.

## Consequences

Supersede ADR-001/002/003/017 as current requirements while retaining their history. Next config/preview/CI migrated during Milestone 1A; existing public pages remain prerendered and UI source unchanged. Redesign Phase 1 for auth/server CRUD/security and Phase 4 for jobs/files; public-only PWA in Phase 8. Automatic Drive sync is removed from active scope, but Markdown/JSON portability and the 14-phase feature roadmap remain. Existing UI components/tokens and historical tests are preserved.

[Architecture](../../ARCHITECTURE.md) · [Security](../architecture/security-architecture.md) · [State](../architecture/state-management.md) · [Phase 1](../../.agent/active/phase-01-foundation.md)
