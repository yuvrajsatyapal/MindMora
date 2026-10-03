# State Management

**Status:** 📋 Target revised 2026-10-03. Existing UI uses controlled React specimen state and session theme only; state libraries are not installed yet.

| Owner | MindMora example | Must not own |
|---|---|---|
| PostgreSQL / Drizzle server repository | Notes, folders, settings, versions, profiles, entitlements | Browser-only modal state |
| Private Storage | Attachment/export bytes | Record/session authority |
| TanStack Query (memory) | Fetch note/list; mutation result; invalidate/refetch; API jobs/profile | Durable/offline knowledge, raw auth/BYOK tokens |
| Editor/component state | Unsaved text and save/conflict feedback | Confirmed durable saved status before commit |
| Zustand | Sidebar/pane/modal UI | Duplicate note body, URL selected ID or credentials |
| nuqs | `?note=`, `?view=`, `?filter=`, `?q=` | Private bodies, keys or tokens |
| Backend auth lifecycle | Verified user/session and secure cookies | User-supplied identity or Redis cache as authority |
| Redis | Expiring rate counters and queue coordination | Canonical notes or plaintext knowledge cache |

## Notes and saves

```text
PostgreSQL → API → TanStack Query cache → editor starts draft
Editor draft → API mutation → database commit → cache invalidation/update
```

Scope query keys by verified account/session generation. Keep editor drafts separate from refetches; do not overwrite unsaved text after focus/refetch. Cancel pending work and clear queries/drafts on logout/account switch before new account data renders. A cancelled fetch alone is insufficient if completion callbacks can still update state; guard the session generation. Never duplicate API data in a Zustand persistence store.

Private responses use `Cache-Control: no-store` and bypass server/edge/Nginx/service-worker caches. No TanStack Query persister, IndexedDB, localStorage/sessionStorage knowledge, or offline mutation replay. In-memory cache disappears on reload; drafts can be lost. Same-tab network outage preserves unsaved draft for explicit retry, not a saved promise.

## Preferences and URLs

Theme is currently session-only. Later durable preferences belong in PostgreSQL behind authenticated APIs; React theme context reflects returned preference. Resolve active note from nuqs URL, not mirrored Zustand state. Unknown/deleted/inaccessible note IDs show safe states; URLs do not authorize access.

## Planned tests

One owner per state; mutation confirmation/invalidation; refetch doesn't clobber a draft; two-account query separation; expired session clears private rendering; late result cannot render after logout; no private browser/cache storage entries. See [security SEC-04](security-architecture.md).
