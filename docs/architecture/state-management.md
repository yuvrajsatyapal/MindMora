# State ownership

**Status:** ✅ Phase 1 workspace memory ownership implemented. PostgreSQL remains the
persistent authority; the browser owns disposable working state. This guide describes
actual ownership and failure boundaries. [Workspace behavior](../features/notes-workspace.md)
owns the product flow; [ADR-025](../decisions/ADR-025-workspace-memory-and-contract-tooling.md)
owns the engineering decisions.

| Owner | Implemented responsibility | Reset / limit |
|---|---|---|
| PostgreSQL / server repositories | Profiles and authoritative notes/revisions/create keys | Owner-scoped transaction and effective RLS; confirmed commit is the saved boundary |
| Protected cookie | Server-owned session tuple and pending Google sign-in state | HttpOnly lifecycle; online provider verification determines identity |
| Request-local auth SDK Map | PKCE/session protocol state | Disposed after each auth/identity request |
| Verified owner object | Evidence of identity verification at issuance | In-process identity, never a client-supplied user ID |
| TanStack Query | Fetched note pages/details and confirmed mutation results | Memory only; owner ID plus lease generation in keys; cancel/clear on account transition/logout |
| Editor component | Same-tab draft, base revision, unresolved create input/key, conflict feedback | Component unmount/reload loses unsaved state; network failure retains it while mounted |
| Zustand | Sidebar visibility | No persistence middleware; reset on private state cleanup |
| nuqs | UUID note selection in `?note=` | Shallow replace; no private title/body or credential in URL |
| React showcase/theme state | Public sample interactions and transient theme choice | Page reload resets; no browser persistence |
| Redis | Admission counters | Expiring coordination, never canonical note records/session authority |

Private Storage and BullMQ workers remain later-phase components. No IndexedDB,
localStorage/sessionStorage knowledge persistence, Query persister or durable mutation
queue is implemented. Account fetch helpers return values/errors and own no state store.

## Lease and cleanup

[WorkspaceShell](../../src/components/workspace/WorkspaceShell.tsx) creates one QueryClient
per mounted workspace. It reads a safe server session projection, then issues a lease
containing the owner, generation and AbortController. Session checks run on initial mount,
window focus, a 60-second timer and before each note operation. A sequence number rejects
older session-check responses. The cookie and backend verification remain authoritative;
the lease controls whether this component may accept asynchronous results.

Owner changes and sign-out increment the generation, abort the old lease, cancel and clear
queries, reset transient UI, clear selection and unmount the old editor. An initial session
check preserves a valid deep-link selection. Note API helpers assert that their lease is
still current before/after session verification and after the API response; query abort
signals are combined with lease cancellation. Therefore a late response cannot populate
the new owner's memory. Sign-out clears private state before asking the server to revoke
the session; a failed logout is visibly unconfirmed and requires verification before reuse.

A temporary verification/network failure reports an error. It does not invent a new session
or persist credentials in UI state. Every subsequent note operation still verifies identity.
Unsaved same-tab work can remain visible while retrying; changing identity clears it.

## Save, conflicts and uncertainty

Query data supplies an editor's initial snapshot. The editor then owns title/content and
base revision; background refetch never silently overwrites that draft. Explicit navigation
asks before discarding dirty work, and beforeunload requests the browser's native warning.
This is a warning, not durable recovery or a guarantee against every navigation source.

A successful mutation is parsed, checked against the active owner and committed response,
then updates detail memory and invalidates the list. “Saved” follows the response, never a
pending optimistic write. Revision conflicts/read-after-uncertain-update expose the current
server version. The owner explicitly chooses the server version or keeps the draft against
the refreshed revision, then saves again. Matching later revision/content can reconcile a
write whose response was lost. Ambiguous deletes read back the note to determine whether
it remains accessible; absent/deleted records are reported as removed for this owner.

Uncertain creation freezes the original input and idempotency UUID in component memory.
Retry sends exactly the same operation, allowing the server to replay the committed note
rather than creating a duplicate. Editing stays disabled during unresolved create recovery.
Closing the tab loses this in-memory recovery key; no offline queue is promised.

```text
Server session projection -> owner/generation lease
                                  |
PostgreSQL -> note API -> owner-scoped Query memory -> editor draft
                                                        |
                                         explicit save + expected revision
                                                        |
                                committed response -> cache update/invalidation

Logout / new owner -> abort lease -> cancel/clear cache -> unmount draft -> reset UI/URL
```

See [auth](../integrations/supabase-auth.md), [database](../integrations/supabase-database.md),
[security](security-architecture.md) and the [active plan](../../.agent/active/phase-01-foundation.md)
for verified-provider, RLS and complete acceptance evidence. Unit fixtures do not prove
production provider isolation or uptime.

A temporary editor-selection lease delays URL-driven remount while discard is confirmed;
nuqs remains canonical and declining restores that URL. Clean refetch adopts only newer
revisions; dirty drafts keep their baseline. Confirmed deletion disables writes but leaves
unsaved text recoverable. [Workspace safeguards](../features/notes-workspace.md#refresh-and-navigation-safeguards)
own the exact behavior.
