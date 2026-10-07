# Knowledge features — Phase 3

**Status:** ✅ Implemented and locally validated, 2026-10-07. The [active ExecPlan](../../.agent/active/phase-03-knowledge.md) owns acceptance and exact evidence. [ADR-028](../decisions/ADR-028-knowledge-derivation-and-title-resolution.md) owns the architectural decision; [UI design](../design/phase-03-knowledge.md) owns placement and accessibility.

## Purpose and scope

Connect portable Markdown notes without changing the canonical save contract. Phase 3 supplies wiki links/autocomplete, explicit missing-note creation, committed backlinks, inline tags and complete-corpus basic search. Attachments/jobs, graph/canvas, frontmatter/tasks, advanced query syntax and AI remain later phases.

## Syntax and identity

Eligible Markdown prose recognizes `[[Title]]` and `[[Title|Label]]`. Original Markdown stays unchanged. Source-position-aware remark parsing excludes fenced/indented/inline code, HTML, existing links/images, math, diagram source, escaped delimiters and unsupported `![[embed]]` syntax. Malformed references stay text. Labels render as plain text through the sanitized preview's internal controls; they are never arbitrary executable URLs.

Title resolution is owner-scoped and live: zero active title matches means missing, one means resolved, multiple mean ambiguous. A note keeps its UUID even if renamed, but portable title references are not permanent UUID bindings. Renaming does not rewrite incoming source; deleting/recreating a unique matching title makes references missing/resolved. Duplicate titles remain permitted and are never selected arbitrarily. Backlinks count distinct active source notes and expose repeated occurrences plus one plain context; self-links count. Ambiguous targets have no claimed incoming count.

Inline tags use `#tag` in prose, Unicode letters/numbers and `_`/`-`, containing a letter or number, excluding purely numeric tokens, and at most 64 source code points. Headings, numeric fragments, escapes, URL fragments, wiki targets and excluded regions are not tags. Identity is normalized/case-insensitive; each note contributes at most one membership per key. Tags are flat, with no frontmatter/hierarchy model. Draft preview/chips and server counts are separate: counts/search/backlinks represent committed revisions.

## Persistence and transactions

`src/features/knowledge/syntax.ts` owns extraction and normalization. `src/server/knowledge/derivation.ts` supplies trusted association replacement. The note repository derives from the final merged content, not an omitted PATCH field. Expected-revision compare-and-swap protects the pre-read used to parse outside SQL locks. Canonical note mutation, title key, knowledge revision and association replacement share one PostgreSQL transaction. Failed replacement rolls back the save; a lost HTTP response still requires existing mutation reconciliation.

`note_links` aggregates one source/target identity with count/context; `note_tags` aggregates one source/tag. Generated weighted `simple` search vectors use canonical title/content; tag membership is a separate scoped query. Read queries exclude soft-deleted sources and stale association revisions. Normalized keys preserve NFKC expansions. Bounded generated hashes keep association/index tuples safe; equality still checks full strings. Tag source spelling stays bounded at 64 code points, while an expanded normalized key can use 1,152. Completion cursors carry the original title (maximum 200), so normalization expansion cannot overflow their request body. Hashes do not anonymize private data.

These are regenerable data, not a second knowledge authority or history database. Derived rows may be physically replaced; canonical notes remain soft-deleted with no request hard-delete grant.

## Private API contract

| Route | Method and behavior |
|---|---|
| `/api/knowledge/wiki-targets` | POST: discriminated completion or batched resolution; default 20/max 50 completion rows, at most 50 resolution targets |
| `/api/notes/{id}/backlinks` | GET: private target, source counts/contexts and source-ID cursor |
| `/api/tags` | GET: owned tag catalog/counts and tag-key cursor |
| `/api/search` | POST: plain text query, optional exact tag, bounded summaries/snippets and query-bound cursor |

GET pages default 20/max 100. POST bodies are capped at 8KiB; strict Zod rejects unknown fields/forged ownership, overlong inputs, malformed cursors and duplicate GET parameters. Search queries max 256 source code points; plain snippets max 240. The [OpenAPI](../api/openapi.json) and [Postman collection](../api/mindmora.postman_collection.json) are generated from shared schemas plus reviewed operation metadata. POST keeps private terms out of URL/history/access-log paths; bodies must still be excluded from logs.

Each handler applies existing bounds, same-origin request policy, online session verification, basic Redis admission, rollout gate and schema validation before SQL. Refreshed cookies propagate even on later failures. Private success/errors use no-store, correlation IDs, safe errors and appropriate Allow/Retry-After. Repository ownership and effective derived-table RLS independently restrict title existence, source contexts, tag counts and search results. Browser-supplied owner IDs are never accepted.

## Workspace flow and recovery

Search/debounce and tag selection live in React memory. TanStack Query owns lease-scoped read pages; UUID selection stays in nuqs. CodeMirror completion inserts through editor transactions, respects composition/abort and retains undo/save behavior. Wiki navigation re-resolves at click and delegates to existing dirty-draft discard guards. Search/backlink rows use the same guard.

Missing targets offer a separate explicit create action. It re-resolves, confirms, captures one original title/empty-content payload plus UUID create key, and retries uncertain creates with that same pair. Another device can create a duplicate between check and write; re-resolution then shows ambiguity. Creation acknowledgement invalidates knowledge caches without marking a dirty source clean. Declining navigation keeps both the source draft and committed new target. No create occurs on hover/render/autocomplete.

Save/delete acknowledgements invalidate the owner's knowledge queries. Session/account changes abort/cancel/clear private reads and unmount drafts/create state. Aborts prevent stale UI insertion, not server rollback. Dependency/rate-limit failures surface as failures, not authoritative empty counts; source remains available in the same tab. Refresh may lose unsaved draft and transient filters. No persisted browser cache, offline queue or background poller is added.

```text
Edit Markdown -> admitted note API -> parse final snapshot
 -> checked owner transaction [note + links + tags + search vector]
 -> COMMIT -> acknowledge revision -> invalidate knowledge queries

Search/tag/backlink/wiki request -> session + limits + schema
 -> owned SQL/RLS read -> safe projection -> lease-scoped memory
 -> guarded UUID selection -> existing note editor
```

## Rollout, backfill and limitations

The additive migration is `supabase/migrations/0002_knowledge_features.sql`. `KNOWLEDGE_FEATURES_ENABLED` defaults false: new writers maintain indexes, but reads/UI stay disabled until migration/backfill verification. The privileged `scripts/backfill-knowledge.mjs` scans UUID pages of 50, rechecks revisions under locks, retries bounded passes and repairs associations without changing canonical content/revision/timestamps. It prints counts, never private content or credentials, and is not invoked from HTTP/startup. No new association FKs exist; privileged cleanup/backfill removes orphan rows explicitly. Normal soft deletion removes associations transactionally.

Run local/disposable verification first. An operator must separately authorize and apply hosted migration/backfill, verify all active records have current knowledge_revision/title_key, then enable the flag. Disable reads when rolling back to older writers and repair before re-enabling. Never reset a database or silently report an incomplete backfill as complete. Exact CLI commands are in [database setup](../integrations/supabase-database.md).

Keyword/token search is not fuzzy/semantic search; the `simple` configuration is not a full multilingual segmentation promise. Live cursor pages can shift under concurrent writes. Server/provider administrators can read canonical and derived content. Hosted transport/at-rest/backups/ingress verification remains separate from local fixture tests. No queue/worker/file/AI/graph capability is implied by these indexes.

### Maximum-size keyword search

PostgreSQL limits a native tsvector's size. The generated `mindmora_search_vector` catches only `program_limit_exceeded` and returns NULL for those documents, preserving the canonical 1 MiB save contract. Search then calls `mindmora_query_vector`: it scans the full token stream but retains only query lexemes and native bounded positions. It does not truncate source content. Ordinary documents retain their stored weighted vector and GIN index; the current CASE/lateral query can limit GIN planner use. Oversized documents require more CPU per query and remain subject to the existing five-second SQL timeout. This is keyword retrieval, not a chunk/vector/semantic index.
