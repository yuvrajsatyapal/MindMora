# ADR-017 — Encryption Before Knowledge Persistence

**Decision status:** ❌ Superseded on 2026-10-03 by [ADR-018](ADR-018-full-stack-server-storage.md).
**Historical implementation:** This decision was never implemented in application code. Historical sections below describe the former v2 plan, not current instructions.
**Replacement:** Next.js runtime APIs, Supabase Auth/PostgreSQL/Storage, no persistent browser notes and no E2EE vault.

## Context

The original specification deferred optional vault encryption to later phases. Plaintext note
CRUD would establish storage/index contracts that then needed retrofitting. The user approved
moving encryption into the foundation and adding measurable security requirements.

## Decision

Introduce an encrypted vault before Phase 1 note persistence. Use Web Crypto AES-GCM,
versioned encrypted record envelopes and a random data key protected by passphrase and
independent recovery wrappers. The proposed Phase 1 KDF is native PBKDF2-HMAC-SHA-256;
parameter review and device benchmarks precede format implementation. Runtime secrets
and decrypted records remain in memory only while unlocked. No plaintext knowledge
persistence path in Phase 1. Wrapped keys may be stored locally; raw unlocking keys may not.

## Alternatives

Keep optional encryption until Phase 12/14; move notes to a server database; introduce
Aiven/backend key retrieval; use unencrypted local notes by default. These either defer the
requested protection or expand architecture beyond the authorized scope.

## Why

Protect persisted private content without replacing the local-first, frontend-only model.
Design storage, indexes, repository boundaries and recovery once around encrypted payloads.
The security design maps requirements to tests before claiming protection.

## Trade-offs

Vault unlock/recovery UX and ciphertext-aware repositories add early work. Search needs
unlocked decrypted projections; plaintext title indexes are forbidden. Wrapped keys expose
offline guessing to weak passphrases. Encryption does not eliminate XSS/device compromise,
metadata leakage, rollback, deletion, or loss of recovery material.

## Consequences

Add milestones 1C.1–1C.3 before 1D–1F. Note is an in-memory domain type, not a Dexie row;
persist EncryptedRecord instead. Phase 4 syncs encrypted payloads and a portable encrypted
vault header; portable plaintext exports require explicit unlocked user action. Later phases
extend coverage and hardening rather than introducing encryption for the first time.
Supabase stays optional/account-only; no Aiven/custom backend is added.

## References

[Security contract](../architecture/security-architecture.md) ·
[Phase 1 plan](../../.agent/active/phase-01-foundation.md) ·
[Product specification](../../PRODUCT_SPEC.md)
