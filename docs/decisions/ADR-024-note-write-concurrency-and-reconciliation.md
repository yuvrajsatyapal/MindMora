# ADR-024 — Note Write Concurrency and Create Reconciliation

**Status:** Accepted and implemented in 1E, 2026-10-05; locally verified. Hosted migration
and production topology remain unverified. [API guide](../features/notes-api.md) owns behavior.

## Context

Two clients can write the same private note revision. A database commit can succeed even
when its HTTP response is lost. Repeating an unkeyed create would duplicate a record;
blindly repeating an update can overwrite someone else's change. Auth is already independent
of knowledge SQL, and existing transactions sanitize exceptions rather than preserving
business-error classes.

## Decision

Use atomic owner/id/active/expectedRevision UPDATE predicates with revision+1 for change/
soft-delete. Treat zero matches as owned-active revision conflict or safe not-found. Return
business outcomes through the transaction and translate them after commit.

Require UUID Idempotency-Key for create. Store immutable owner-scoped key and SHA-256 of
normalized title/content on the note. A partial unique index reserves the key, including
soft-deleted notes. Matching active replay returns the current record200; changed input409;
deleted replay404. Nullable metadata keeps existing rows compatible. No automatic mutation
retry; uncertain updates/deletes refetch before deliberate retry.

Seed a missing profile during the first validated/admitted note operation using ON CONFLICT
DO NOTHING. Preserve existing profile data and keep auth callback free of SQL writes.

## Alternatives considered

- Read revision then unconditional UPDATE: straightforward, but a race can overwrite.
- Serializable transactions alone: can abort races but still need public conflicts/retries
  and do not reconcile HTTP response loss without an operation identity.
- Client-selected note UUID only: prevents duplicate IDs but cannot distinguish changed
  original input or reliably reconcile an existing edited/deleted record without metadata.
- Separate expiring idempotency receipt table: supports independent retention/saved responses,
  but adds storage/expiry semantics and another transactional structure for this initial API.
- Profile write at auth callback: earlier initialization, but makes login depend on SQL and
  expands the existing auth boundary before knowledge is accessed.

## Rationale

Atomic predicates use the existing SQL/RLS boundary and expose explicit stale-write outcomes.
A single unique owner/key index makes create races safe without a new service or queue.
Immutable original metadata preserves retry identity across subsequent edits/deletion.
Profiles only exist when knowledge is accessed; this preserves the established auth contract.

## Trade-offs and consequences

Clients must retain the create key and original normalized input during uncertain retries;
matching replay returns the current note rather than a frozen original response. Key retention
is tied to record lifetime; no expiry/purge API is added. Digests are not anonymization or
credentials. Cursor pages are bounded, not snapshots across edits. First reads may create
profiles. Service normalization after commit can fail without undoing persistence. Privileged
cleanup can remove keys, so permanent exactly-once delivery is not promised. Apply migration
0001 before hosted note access; 1F/1G UI and 1H tooling remain separate authorized milestones.
