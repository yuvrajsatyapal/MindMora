# Note and Profile Model Contracts

**Implemented:** 1C schema/input/domain definitions and 1E note services/HTTP CRUD,
profile creation and response projections. **Planned:** workspace/editor. This document owns field/bound rules. Runtime SQL
scope lives in the [database guide](../integrations/supabase-database.md), not here.

## Purpose and representation

Prepare owner-linked Markdown records in canonical PostgreSQL without inventing later
knowledge/entitlement tables. Supabase Auth already owns identity/password/provider lifecycle.
Application models hold only profile presentation fields and the initial note structure.
Drizzle returns Date objects; shared domain schemas require ISO UTC millisecond strings.
The note service explicitly serializes dates and excludes internal creation metadata.

| Model | Fields/defaults | Database checks / relationships |
|---|---|---|
| profiles | user_id primary UUID; nullable display_name; created_at/updated_at default now, timestamp precision3 with time zone | Auth-user FK/cascade; name ≤200 PostgreSQL characters; update time ≥ creation time |
| notes | generated UUID id; user_id; title/content; revision default1; creation/update defaults now; nullable deleted_at | Profile-owner FK/cascade; title1–200 characters and SQL space trim; content ≤1,048,576 bytes; positive INT revision; update/deletion not before creation |

The partial index orders user_id, updated_at descending, id descending for rows where
deleted_at is null. It supports implemented bounded list queries with updatedAt/id descending cursors.
Pages are not snapshots across concurrent edits. Defaults apply at insertion, not on every update. There is no timestamp/revision
trigger or check requiring revision to increase. SQL INT bounds the maximum stored revision.
The schema's time-zone representation does not require a database session's display timezone
be UTC; domain output is explicitly UTC ISO and needs normalization.

## Shared runtime inputs

| Schema/export | Required behavior |
|---|---|
| createNoteSchema | Required trimmed nonempty title ≤200 Unicode code points; required content ≤1,048,576 UTF-8 bytes; neither contains NUL |
| updateNoteSchema | Optional title/content, at least one actually supplied; expectedRevision1–2,147,483,646 |
| deleteNoteSchema | expectedRevision1–2,147,483,646 only |
| listNotesSchema | limit default20, integer1–100; accepts number or 1–3 decimal digits; optional validated cursor |
| noteCursorSchema | updatedAt UTC ISO with exactly millisecond precision plus UUID id |
| noteSummarySchema / notePageSchema | Summary omits content; page has items (≤100) and nullable nextCursor |
| noteSchema / profileSchema | Strict domain projections; output times are UTC ISO strings, note revision1–2,147,483,647, nullable deletedAt/profile name |

Schemas are strict: unknown submitted keys, including owner/plan/timestamps where not
allowed, are rejected. Empty content is valid; an update with content="" is a supplied
change. Max mutation revision leaves room for the repository increment; parsing alone still does
not advance revision. Profile domain names reject NUL and use the installed Zod
Unicode-length behavior. Auth projection independently slices provider names in JS units.

The note handler parses these inputs and the service validates its public projections. Input parsing validates shape/bounds,
not ownership or HTML safety. SQL title trim removes spaces, while JS trim also removes
other whitespace; SQL-valid rows need not satisfy the stricter domain validator. Domain
schemas do not check cross-field chronology; persisted SQL constraints do. NUL is rejected
by validation and PostgreSQL TEXT cannot store it.

## Ownership and implemented business rules

Policies use verified owner identity and grants disallow owner/creation-column updates or
hard DELETE. Own soft-deleted rows remain visible under RLS; active-row filtering belongs
to the implemented repository. First admitted/validated note access inserts a missing
profile; existing data is preserved. Atomic expected-revision writes, normalized responses
and key-based create reconciliation are implemented in 1E. Neither successful login nor importing a schema writes a profile.

Read [validation.ts](../../src/features/notes/validation.ts), [types.ts](../../src/features/notes/types.ts),
[schema.ts](../../src/server/db/schema.ts), then [migration](../../supabase/migrations/0000_profiles_notes.sql)
and [validation tests](../../src/features/notes/validation.test.ts). The [phase record](../phases/phase-01-foundation.md)
records dated actual-driver and note-route evidence; it distinguishes local fixtures from hosted validation.

## Internal creation metadata — 1E

`create_operation_id` (UUID) and `create_request_hash` (64-character SHA-256 digest) are
both null for legacy rows or both present for keyed creates. A partial unique owner/key
index includes soft-deleted rows. The request role cannot update these columns. They are
never returned in note JSON or list summaries and are not authentication credentials.
The unsalted digest is internal data, not an anonymity guarantee.
See [migration](../../supabase/migrations/0001_note_create_idempotency.sql),
[API](notes-api.md) and [ADR-024](../decisions/ADR-024-note-write-concurrency-and-reconciliation.md).
