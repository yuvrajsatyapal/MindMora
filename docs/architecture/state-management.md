# State ownership

**Status:** ✅ Phase 1 workspace ownership and Phase 2 editor implementation present;
complete Phase 2 validation remains in the [active plan](../../.agent/active/phase-02-editor.md).
PostgreSQL owns persistence; browser state is disposable. [Workspace](../features/notes-workspace.md)
and [editor](../features/editor.md) own detailed product flows; ADR-[025](../decisions/ADR-025-workspace-memory-and-contract-tooling.md)
and [027](../decisions/ADR-027-editor-autosave-and-safe-rendering.md) own decisions.

| Owner | Implemented responsibility | Reset / limit |
|---|---|---|
| PostgreSQL / server repositories | Authoritative notes, profiles, revisions and create keys | Owner-scoped transaction and effective RLS; confirmed commit is the saved boundary |
| Protected cookie | Server-owned session tuple and pending Google sign-in state | HttpOnly lifecycle; online provider verification establishes identity |
| Request-local auth SDK Map | PKCE/session protocol state | Disposed after each auth/identity request |
| Verified owner object | Evidence of identity verification at issuance | In-process identity, never a submitted user ID or durable session authority |
| TanStack Query | Fetched pages/details and acknowledged mutation records | Memory only; owner/generation keys; cancel/clear on logout/account transition |
| Autosave controller | Acknowledged base, live title/content draft, local sequence, active snapshot, unresolved operation and conflict candidate | One mounted editor lease; same-tab retention during failures; unmount/reload loses draft/recovery key |
| CodeMirror | Source document, selection and undo history | One mounted view; annotated external adoption avoids callback loops; destroy on lease unmount |
| Preview | Sanitized derived AST, rich block output and render generation | 250 ms debounce; source/AST/math/diagram caps; old output discarded on change/unmount |
| React editor mode | Edit/Preview/Split choice | Local temporary state; source view stays mounted across modes |
| Zustand | Sidebar visibility | No persistence middleware; reset on private cleanup |
| nuqs | UUID note selection in `?note=` | Shallow replace; no title/body/session tokens in URL |
| React showcase/theme state | Public samples and temporary theme choice | Reload resets; no browser persistence |
| Redis | Admission counters | Expiring coordination; never canonical notes or default session authority |

Private Storage/BullMQ remain later phases. No IndexedDB, localStorage/sessionStorage
knowledge persistence, query persister, durable replay queue or private service-worker
cache is introduced. Preview does not own save state or a persistent HTML cache.

## Identity lease and cleanup

[WorkspaceShell](../../src/components/workspace/WorkspaceShell.tsx) constructs one mounted
QueryClient, verifies a safe session projection and issues an owner/generation/AbortController
lease. Initial, focus, periodic and pre-operation checks reject older responses. Note API
helpers recheck the lease before/after verification and response parsing. Backend verification
and SQL owner controls remain independent authority; the UI lease only determines whether
an asynchronous completion may enter this screen.

Logout/account changes increment generation, abort/cancel/clear private queries, reset
sidebar/URL state and unmount editor/preview. Late saves/renders cannot repopulate a later
identity's UI. Sign-out clears private state before server revocation; failure is shown as
unconfirmed. Transient verification outage retains same-tab work but grants no offline
permission. This lifecycle is not forensic RAM erasure or rollback of a sent SQL operation.

## Acknowledged base versus live draft

Query data seeds the controller. Typing increments a local sequence, independent of server
revision. A captured operation contains normalized title/content and its sequence plus
create key or `{id,expectedRevision}`. One active promise serializes write/reconciliation.
Debounce waits 1,500 ms after edit/composition completion; automatic starts are spaced by
5,000 ms. Explicit save flushes delay, respects active cooldown and coalesces with an active
operation instead of overlapping. Invalid input waits for a new edit; failures pause.

A response advances the base/revision and committed cache record. Returned text replaces
current draft only if the local sequence still matches the captured sequence. Later typing
remains dirty and schedules a follow-up using the new revision. `onSaved` therefore means
acknowledged record, while `onDirty` alone governs draft guards. A first POST binds the new
ID/URL without changing the editor key. Genuine accepted selection changes replace the
editor lease; declining discard restores selection.

Clean newer refetch can adopt server text; dirty newer refetch retains draft and exposes
conflict. Older revisions do not roll the acknowledged base or detail cache backward.
“Keep draft with latest revision” adopts the base but stays paused for explicit save;
“Use server version” deliberately confirms discard. Confirmed missing/deleted records disable
writes while retaining dirty source for copying.

## Uncertain outcomes, admission and delete

Uncertain POST retains the exact original input/key separately from editable typing. Retry
uses that pair; a differing replay is a conflict. Uncertain PATCH retries a read first.
Matching snapshot plus newer revision acknowledges observed persistence while retaining newer
local edits; a different value requires review. Failed reconciliation stays paused. A 429
uses a monotonic Retry-After deadline; expiry does not automatically replay the failed write.

Delete cancels pending scheduling, awaits active save/reconciliation, then uses the latest
confirmed revision after confirmation. Uncertain deletion stores a reconciliation candidate
and reads before further mutations. Navigation and beforeunload guards include unresolved
operations; approved discard loses in-memory recovery. No unload-save promise exists.

## Disposable rich rendering

The preview debounces separately and immediately hides a prior source generation. Sanitized
HAST becomes controlled React output; links/images receive an additional URL check. Lazy
math output belongs to its expression lifecycle. Explicit Mermaid attempts share a serialized
renderer queue because its configuration is singleton, with generation checks before/after
async work. Disposable nonce-bearing measurement DOM is removed immediately on unmount;
late output is discarded. Sanitized SVG lives only in a scriptless sandbox frame. No global
private preview cache or background persistence worker is added.

```text
Verified session -> owner/generation lease -> scoped Query memory
PostgreSQL -> existing note API -> acknowledged base
                                      |
CodeMirror typing -> live draft + local sequence -> bounded preview generation
                                      |
                   debounce/spacing -> immutable operation
                                      |
                    existing verified API -> PostgreSQL commit
                                      |
              acknowledge base/cache -> retain any newer draft -> next snapshot
Conflict/uncertainty -> pause -> read/explicit decision -> deliberate save
Logout/switch -> invalidate lease -> cancel/clear queries -> unmount source/preview
```

[Auth](../integrations/supabase-auth.md), [database](../integrations/supabase-database.md)
and [security](security-architecture.md) distinguish local fixtures, effective RLS checks,
live-provider and production evidence. Exact runs belong to dated execution records.
