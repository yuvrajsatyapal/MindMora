# Phase 1 notes workspace

**Status:** ✅ Implemented at `/workspace/`. Complete-phase validation and provider versus
fixture evidence live in the [active ExecPlan](../../.agent/active/phase-01-foundation.md).
The [design handoff](../design/phase-01-foundation.md) records intended accessibility
and responsive behavior; the current source owns actual behavior.

## User flow

The workspace first verifies the server session. Signed-out users see Google sign-in;
credentials remain in protected server-owned cookies. Signed-in users can page through
owner-scoped notes, select a note via its UUID URL state, create, explicitly save, refresh
and soft-delete notes. A note's title/content stays in the mounted editor until a confirmed
save. Empty/loading/error states and save/sync feedback describe current requests.

No tree, attachment, AI, graph, Markdown rendering engine, durable offline editor or later
Phase 2 feature is included. The content field edits Markdown text; it never executes or
renders submitted HTML. Public showcase routes remain independent.

## Participating components

- [WorkspaceShell](../../src/components/workspace/WorkspaceShell.tsx) owns online session
  checks, owner leases, QueryClient lifecycle and sign-out cleanup.
- [NotesWorkspace](../../src/features/notes/components/NotesWorkspace.tsx) joins list/detail
  queries, URL selection, transient sidebar state and confirmed cache updates.
- [NoteEditor](../../src/features/notes/components/NoteEditor.tsx) owns draft/base revision,
  explicit saves, conflict decisions, uncertain create replay and deletion feedback.
- [API helper](../../src/features/notes/api.ts) verifies the active lease/session, validates
  requests/responses and checks returned owner/deletion/revision expectations.
- Existing [HTTP routes](../../src/server/notes/routes.ts),
  [service](../../src/server/notes/service.ts) and
  [repository](../../src/server/notes/repository.ts) own authoritative admission, session,
  Origin, validation and owner-scoped persistence. The browser is not an authorization layer.

## Failure behavior and safeguards

Session-generation keys plus cancellation prevent late results from crossing accounts.
Logout clears private UI first; failed revocation is shown as unconfirmed. Network/save
failure preserves the mounted draft. Refetch does not overwrite it. A revision conflict
shows server content as escaped text and asks the user to choose which draft to retain;
keeping local text still requires an explicit new save against the refreshed revision.

Create requests use one UUID idempotency key. An uncertain result retains that UUID and
original input for an exact retry, with editing disabled until resolved. Delete uses the
expected revision; a response must match owner, note ID, next revision and deletion marker.
Ambiguous saves/deletes read back before presenting a conclusion. Reload/close can lose
unsaved work and unresolved create recovery. Navigation warnings are best effort.

The editor focuses its title field on mount. Shared primitives supply labeled inputs,
button state and alerts; list buttons indicate the selected note, sidebar toggle exposes
expanded state/controlled list ID and responsive CSS stacks the panels on smaller screens.
Theme selection is temporary context and retains the draft. Neutral dark tokens and continuous
navigation/document framing are defined by the [visual design contract](../design/visual-refinement.md). Browser/axe checks
and remaining accessibility limitations belong in dated acceptance evidence; implementation
alone is not a claim of exhaustive assistive-technology verification.

```text
/workspace -> verify cookie session -> owner/generation lease
                                         |
                            URL selection -> Query list/detail
                                         |
                                    editor draft
                                         |
                 explicit mutation -> existing secured note API
                                         |
                        owner-scoped SQL + effective RLS
                                         |
                  committed response -> saved/cache invalidation
```

[State ownership](../architecture/state-management.md) explains memory cleanup and trade-offs.
[Note API](notes-api.md) owns protocol details; [API tooling](../integrations/api-tooling.md)
owns Swagger/Postman generation and safe interactive execution.

## Refresh and navigation safeguards

A clean, idle editor adopts a strictly newer committed revision. A dirty editor retains
its draft and old revision for explicit conflict resolution. Confirmed404 after refetch
shows an unavailable state for a clean note; a dirty draft remains editable/copyable with
Save/Delete disabled and no saved label. Sidebar/new-note navigation and external query
changes require discard confirmation; a temporary editor lease holds the existing draft
until URL selection is accepted or restored. The homepage uses native workspace navigation
so ordinary back/reload/close triggers the browser beforeunload warning for dirty drafts.
