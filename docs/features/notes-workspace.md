# Protected notes workspace

**Status:** ✅ Phase 1 workspace and Phase 2 editor implementation present at `/workspace/`.
Complete Phase 2 local acceptance is recorded in its [active ExecPlan](../../.agent/active/phase-02-editor.md).
Historical Phase 1 evidence remains [dated separately](../phases/phase-01-foundation.md).
[Editor behavior](editor.md) owns rich preview/autosave details; [design](../design/phase-02-editor.md)
records intended keyboard, responsive and accessibility behavior.

## User flow

The workspace verifies the server session before showing private notes. Signed-out users
see Google sign-in; credentials stay in protected server cookies. Signed-in users page
through owner-scoped summaries, select a UUID in URL state and create/edit/refresh/soft-delete
notes. The dynamic workspace shell receives a fresh CSP nonce; it does not fetch private
note bodies on the server. Public showcase routes remain independent.

Title and CodeMirror Markdown source form a same-tab draft. Valid changed drafts autosave
through the existing note API; explicit Save note and primary-modifier+S use the same
coordinator. Edit/Preview/Split and formatting derive from current typing. No attachment,
AI, graph, wiki-link resolution or durable offline editor is included. Images are inert
placeholders; rich rendering never authorizes a write or supplies persistence status.

## Participating components

- [WorkspaceShell](../../src/components/workspace/WorkspaceShell.tsx) owns session checks,
  owner/generation leases, memory QueryClient, nonce propagation and sign-out cleanup.
- [NotesWorkspace](../../src/features/notes/components/NotesWorkspace.tsx) joins list/detail,
  URL selection, sidebar state, guarded editor leases and committed cache updates.
- [NoteEditor](../../src/features/notes/components/NoteEditor.tsx) composes the
  [autosave hook](../../src/features/editor/use-note-autosave.ts), source/toolbar/preview,
  shared save feedback and deliberate recovery controls.
- [API helper](../../src/features/notes/api.ts) rechecks active lease/session, validates
  requests/responses and rejects wrong owner/record/deletion/revision results.
- Existing [routes](../../src/server/notes/routes.ts), [service](../../src/server/notes/service.ts)
  and [repository](../../src/server/notes/repository.ts) own admission, online identity,
  Origin, validation, owner-scoped revision transactions and effective RLS.

## Acknowledgement, failure and identity safeguards

A commit response confirms its captured snapshot. Newer local typing stays dirty; cache
updates do not clear the navigation guard. New-note POST binds its ID/URL without remounting
that draft. A genuinely accepted selection starts a new editor lease. Per-owner/generation
keys and post-await checks reject old-account responses.

Failures preserve the mounted draft and pause scheduling. 429 blocks deliberate retry
until Retry-After expires. A newer dirty refetch or revision conflict shows the authorized
server candidate as escaped text. Keeping the draft adopts the latest base but requires
explicit save; using the server version confirms discard. An uncertain PATCH reconciles
by reading; an uncertain POST retries its original frozen UUID/input separately from newer
typing. A differing create replay requires review. Source remains editable during ordinary
writes and recovery; no offline permission or replay queue is introduced.

Delete cancels pending autosave, awaits/reconciles active work and confirms against the
latest acknowledged revision. Ambiguous deletion reads before another mutation. Refresh/
close can lose unsaved source and the in-memory create recovery key. An already sent write
can commit after navigation. Logout clears private UI first; failed revocation is shown as
unconfirmed. Confirmed identity changes remove source, preview and pending rich render DOM.

## Refresh and navigation safeguards

A clean idle editor adopts only a strictly newer committed record. Dirty drafts retain
text and expose a newer server candidate; older responses cannot roll back the acknowledged
base/detail cache. Confirmed 404 disables writes and leaves a dirty draft copyable; a clean
unavailable note shows the safe error. Sidebar/new-note/external URL changes confirm discard.
Declining restores accepted selection without clearing conflict/cooldown state.

The title receives initial focus. CodeMirror has a labelled multiline textbox; formatting
uses source transactions and returns focus to source. Presentation controls are pressed
native buttons; task boxes are read-only and diagram frames are titled. Long content scrolls
inside panes, with stacked Split on narrow screens. Temporary theme changes retain the draft.
Browser/Axe/IME and CSP evidence belongs in the active plan; source presence alone is not
exhaustive assistive-technology or production acceptance.

```text
/workspace -> nonce shell -> verify cookie session -> owner/generation lease
                                                        |
                           guarded URL selection -> query list/detail
                                                        |
                          CodeMirror/controller draft -> safe preview
                                                        |
                         captured autosave -> secured existing note API
                                                        |
                            owner revision SQL + effective RLS -> commit
                                                        |
                      acknowledged base/cache + retain newer local typing
Logout/switch -> invalidate lease -> abort/clear/unmount source and preview
```

[State ownership](../architecture/state-management.md) explains memory and lease lifetimes;
[note API](notes-api.md) owns protocol; [API tooling](../integrations/api-tooling.md) owns
Swagger/Postman generation. Server-readable notes, same-tab failure retention and refresh
loss remain explicit product limits.
