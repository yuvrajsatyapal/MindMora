# Note and Profile Model Contracts

**Implemented:** 1C schema/input/domain definitions. **Planned:** note services/HTTP CRUD,
profile creation and workspace/editor. This document owns field/bound rules. Runtime SQL
scope lives in the [database guide](../integrations/supabase-database.md), not here.

## Purpose and representation

Prepare owner-linked Markdown records in canonical PostgreSQL without inventing later
knowledge/entitlement tables. Supabase Auth already owns identity/password/provider lifecycle.
Application models hold only profile presentation fields and the initial note structure.
Drizzle returns Date objects; shared domain schemas require ISO UTC millisecond strings.
No automatic row-to-domain serializer exists yet.

| Model | Fields/defaults | Database checks / relationships |
|---|---|---|
| profiles | user_id primary UUID; nullable display_name; created_at/updated_at default now, timestamp precision3 with time zone | Auth-user FK/cascade; name ≤200 PostgreSQL characters; update time ≥ creation time |
| notes | generated UUID id; user_id; title/content; revision default1; creation/update defaults now; nullable deleted_at | Profile-owner FK/cascade; title1–200 characters and SQL space trim; content ≤1,048,576 bytes; positive INT revision; update/deletion not before creation |

The partial index orders user_id, updated_at descending, id descending for rows where
deleted_at is null. It supports future stable bounded list queries; no list repository
exists. Defaults apply at insertion, not on every update. There is no timestamp/revision
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
| noteSchema / profileSchema | Strict domain projections; output times are UTC ISO strings, note revision1–2,147,483,647, nullable deletedAt/profile name |

Schemas are strict: unknown submitted keys, including owner/plan/timestamps where not
allowed, are rejected. Empty content is valid; an update with content="" is a supplied
change. Max mutation revision leaves room for a future increment, but no increment occurs
just because parsing succeeds. Profile domain names reject NUL and use the installed Zod
Unicode-length behavior. Auth projection independently slices provider names in JS units.

These are exported definitions, not an HTTP note API. Input parsing validates shape/bounds,
not ownership or HTML safety. SQL title trim removes spaces, while JS trim also removes
other whitespace; SQL-valid rows need not satisfy the stricter domain validator. Domain
schemas do not check cross-field chronology; persisted SQL constraints do. NUL is rejected
by validation and PostgreSQL TEXT cannot store it.

## Ownership and future business rules

Policies use verified owner identity and grants disallow owner/creation-column updates or
hard DELETE. Own soft-deleted rows remain visible under RLS; active-row filtering belongs
to future repositories. First-request profile creation, automatic revision advancement,
expected-revision conflicts, normalized note response and uncertain-write handling are
planned 1E responsibilities. Neither successful login nor importing a schema writes a profile.

Read [validation.ts](../../src/features/notes/validation.ts), [types.ts](../../src/features/notes/types.ts),
[schema.ts](../../src/server/db/schema.ts), then [migration](../../supabase/migrations/0000_profiles_notes.sql)
and [validation tests](../../src/features/notes/validation.test.ts). The [phase record](../phases/phase-01-foundation.md)
contains historical actual-driver constraint evidence; this document review runs no new database tests.
