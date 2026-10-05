# Phase 1 protected notes workspace

✅ Implemented design contract for milestones 1F/1G. The public design system remains a sample-only specimen. This screen reuses semantic tokens and existing Button, TextField, TextArea, Alert, EmptyState and status components. The [visual refinement](visual-refinement.md) replaces nested Cards with continuous navigation/document surfaces and updates dark colors; fonts remain local system fonts.

## Screen and states

`/workspace/` first shows session verification, then Google sign-in or the authenticated workspace. Session errors provide Retry. The compact header identifies the safe display name and offers Theme, Refresh session and Sign out. Notes load as a bounded, paginated sidebar. Empty, loading, unavailable and inaccessible URL states have explicit text and recovery controls. A note ID in `?note=` is navigation input, never authorization.

A blank editor creates a note; a selected note fetches its body separately. Title and Markdown body use labeled fields; explicit Save commits both title and content. Saved means an acknowledged server commit or a successful read confirming the exact attempted content/revision. Delete requires confirmation. Conflicts retain the draft, show the current server version separately and offer an explicit use-server or keep-draft-and-rebase decision. Response loss preserves the draft; create retry retains the same operation key and frozen input. There is no autosave, Markdown HTML preview or durable offline state.

## Keyboard, focus and accessibility

Native buttons and fields support keyboard activation. Note selection focuses the editor heading/field once loaded. Status regions announce loading/save failures and success; destructive confirmations use the browser's accessible native confirmation UI. Dirty navigation and sign out require explicit discard confirmation; tab close/reload receives a beforeunload warning. Conflict actions clearly say which version is retained. Inputs remain editable after failure and are disabled only during their mutation or frozen uncertain create operation.

## Responsive and reduced motion

Wide screens display sidebar and editor in two columns. Narrow screens stack both without horizontal overflow; sidebar visibility is transient Zustand state. No new motion is introduced, so existing reduced-motion tokens apply. Header actions wrap and fields use the available width.

## Ownership and lifecycle

Safe session projection owns identity. TanStack Query owns fetched notes in memory, keyed by owner and session generation. nuqs owns selected URL ID; Zustand owns sidebar visibility only; component state owns drafts and pending create operation. Account change/logout invalidates leases, aborts work, clears cache/layout/selection and unmounts the editor. Late responses cannot restore an invalidated scope. Requests reverify session and validate returned owner. Errors cannot expose raw backend/network messages.

## Validation and limits

Component behavior checks cover dirty drafts, revision conflicts, confirmed saved feedback, uncertain create replay, session cleanup and response owner rejection. Real browser acceptance and exact results live in the active Phase 1 ExecPlan. Native discard dialogs require browser automation acceptance; a reload deliberately destroys memory-only drafts after user confirmation. Auth cookie changes in another tab are detected on focus/periodic verification or before private requests, not through browser token storage.

## Implemented components and composition

| Component | Inputs / owned state | Responsibility |
|---|---|---|
| WorkspaceShell | Session lease/generation, memory QueryClient, verification/error/logout state | Verify safe identity; protect/unmount workspace; cancel cache and stale work on confirmed identity change |
| SignInGate | No private state | Native POST Google sign-in; server-readable and draft-lifetime disclosure |
| NotesWorkspace | Verified scope; dirty indicator; remount generation | Compose query list/detail, nuqs selection and transient layout; explicit discard before selection |
| NoteList | Summaries, selected URL ID, selection callback | Accessible native buttons and empty state |
| NoteEditor | Server base revision; same-tab title/body; create operation; conflict/error/save states | Explicit commit/reconcile/delete; preserve failed drafts; show exact server conflict version |
| SaveStatus / SyncStatus | Controlled status enum | Server-confirmed save and server-refresh feedback; specimens remain controlled samples |

```text
Session verification / sign-in gate
                 |
Header: identity + session refresh + sign out
                 |
New note / refresh notes / toggle list / refresh status
                 |
+----------------------+----------------------------------+
| Your notes           | New/Edit note                    |
| bounded summaries    | Title                            |
| selected URL button  | Markdown content                 |
| load more            | Save status + Save + Delete      |
|                      | error / server conflict actions  |
+----------------------+----------------------------------+
```

On narrow screens the two sections stack. Shared `--content-width`, `--nav-width`, spacing
and font tokens determine dimensions; status/actions wrap. Browser viewport evidence belongs
to the phase acceptance record rather than a speculative screenshot claim here.

The new semantic `--note-conflict-max-height` token bounds the comparison panel to 20rem, keeping conflict actions reachable without making the entire screen an unbounded document. It changes no brand styling.

## Navigation and stale-record recovery

nuqs remains the canonical selection. NotesWorkspace holds a temporary editor-render lease
while external query changes are awaiting discard confirmation. A declined change restores
the URL and keeps the original editor mounted; accepted changes transfer the lease to the
URL selection. This guard covers invalid URL selections too, without adding a selected-ID
Zustand field. Internal note changes still use explicit confirmation and native unload
warnings cover full page navigation.

A clean editor adopts monotonically newer refetched commits. A dirty editor retains its
original baseline until explicit conflict resolution. A confirmed detail 404 replaces a
clean editor with the unavailable state; a dirty editor keeps its fields for copying,
announces unavailability and disables Save/Delete. Transient request errors retain the
editable draft. No cached record is represented as currently saved after confirmed removal.
