# ADR-028 — Transactional knowledge derivation and title resolution

**Status:** Accepted for Phase 3 implementation, 2026-10-07. Validation and completion evidence belong to the [active plan](../../.agent/active/phase-03-knowledge.md).

## Context

Phase 2 saves readable Markdown through revision-safe owned note APIs. Phase 3 requires complete-corpus search, tags and backlinks without browser persistence or Phase 4 queues. Note titles are not unique, and portable `[[Title]]` syntax has no permanent UUID binding. Canonical records and their derived associations must agree after a confirmed save, including partial updates, retries and two-device conflicts.

## Decision

Parse eligible Markdown prose using the installed remark AST and source positions. Store one aggregate per owned source/target key and source/tag key. Preserve source text. Maintain these associations, normalized title keys and knowledge revision in the same checked PostgreSQL transaction as canonical writes. Use a stored weighted `simple` tsvector and GIN for basic search, with exact tag membership queries. No queue, remote search service or client corpus persistence.

Resolve references at read time against the owner's active normalized titles: zero missing, one resolved, multiple ambiguous. Do not enforce unique titles, choose an arbitrary duplicate or rewrite referencing source on rename. Explicit missing-target creation reuses the existing create Idempotency-Key and reconciliation contract. A competing different operation can create the same title; show ambiguity after re-resolution.

Knowledge API reads are private. Search and title resolution use bounded same-origin POST bodies rather than placing private terms in URLs. The server derives ownership from online identity. Both repository filters and derived-table RLS/source checks apply. Browser caches use the existing owner/generation lease and die with that lease.

Full normalized strings can expand beyond B-tree tuple limits. Association primary/lookup indexes therefore use generated SHA-256 keys; title equality uses a hash expression plus full-string comparison. This never grants access or claims anonymization. Completion cursors carry the original bounded title, normalized on comparison. These changes preserve valid maximum-size Unicode titles/tags rather than silently limiting them.

Add schema changes and a rerunnable privileged backfill CLI. Keep the server-only read/UI gate disabled until migration/backfill verification. Backfill does not increment canonical revision or change content. Rolling back to older writers requires disabling knowledge reads and repairing the index before re-enabling it.

## Alternatives considered

- Async indexing now: shorter save work but requires durable coordination, stale-read behavior and a Phase 4 outbox/worker lifecycle.
- Reparse every note on each read: no association migration, but full-corpus work scales with every backlink/tag request and bypasses indexed retrieval.
- Persist resolved target UUIDs or impose title uniqueness: clearer permanent identity, but changes portable source meaning or rejects titles currently allowed.
- Browser full-text/fuzzy index: useful for optional loaded-data filtering, but incomplete corpus visibility or an extra private-cache lifecycle.
- Raw regex parsing: small initial code, but creates references/tags from code, math, HTML and escaped syntax.

## Rationale

The phase's user-visible result must reflect acknowledged saves and support the existing note identity/save contract. PostgreSQL transactions and source revisions supply that boundary without introducing another service. Shared syntax positions keep preview and persistence aligned without trusting rendered HTML.

## Trade-offs and consequences

Parsing and association replacement add work to each save; maximum accepted source sizes and dense markup must be measured. Title resolution makes rename breakage and duplicate ambiguity visible. Keyword search is not semantic/fuzzy retrieval, and live cursor pages are not snapshots across concurrent edits. Derived tables and role policies add migration/backfill and cleanup obligations. Default-off rollout needs an explicit operator verification step. POST bodies still need log hygiene and no-store; their method alone does not make them confidential.

[Knowledge behavior](../features/knowledge.md) · [Phase 3 design](../design/phase-03-knowledge.md) · [Source authority](ADR-018-full-stack-server-storage.md) · [Revision/idempotency](ADR-024-note-write-concurrency-and-reconciliation.md).

### Maximum-size keyword search

PostgreSQL limits a native tsvector's size. The generated `mindmora_search_vector` catches only `program_limit_exceeded` and returns NULL for those documents, preserving the canonical 1 MiB save contract. Search then calls `mindmora_query_vector`: it scans the full token stream but retains only query lexemes and native bounded positions. It does not truncate source content. Ordinary documents retain their stored weighted vector and GIN index; the current CASE/lateral query can limit GIN planner use. Oversized documents require more CPU per query and remain subject to the existing five-second SQL timeout. This is keyword retrieval, not a chunk/vector/semantic index.
