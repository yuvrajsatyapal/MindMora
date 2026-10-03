# Full-Stack Data Architecture

**Status:** ✅ 1A Node runtime/config boundary; 📋 data/auth/storage flows planned; accepted 2026-10-03. See [system overview](../../ARCHITECTURE.md).

## Responsibilities and flow

```text
Google sign-in → Supabase Auth → backend session → verified owner

Editor draft → TanStack Query mutation → HTTPS API
→ Zod + authentication + CSRF + ownership + rate admission
→ server service → Drizzle repository → PostgreSQL commit
→ normalized response → in-memory cache update/invalidation → saved indicator
```

Identity comes from a validated backend session, never request `userId`. Routes handle HTTP/contracts; services domain rules; repositories transaction/query scope. Database/Redis/privileged Storage clients remain server-only. A verified authenticated request does not automatically authorize another user's record. Server roles/transaction-local claims must enforce RLS and be tested through the actual connection path.

## Proposed data model

Phase 1 `profiles` references Auth users; `notes` stores UUID ID, user ID, title, Markdown body, UTC timestamps, revision and nullable deleted timestamp. Owner/updated-time/ID index supports bounded cursor pagination. Use optimistic concurrency: update/delete `WHERE id = ... AND user_id = verified_owner AND revision = expected_revision`; zero matches are resolved into safe not-found/conflict behavior without leaking another user's existence. Mutations advance revision atomically. Do not recreate everything on startup or pre-create later feature schemas.

## Save failure and conflicts

Show saved only after confirmed commit. When request fails before commit, keep the draft in the same tab. If response is lost after commit, re-fetch/idempotency reconciliation resolves the uncertain outcome before retry. Revision conflicts preserve both user draft and fetched version with compare/retry flow. Drafts aren't durable: browser refresh/close can lose unsaved text. Offline is a connectivity state, not a persisted browser queue.

## Files — Phase 4

Private Storage holds files; metadata in PostgreSQL links owner/note/object key/size/type/status. Backend authorizes short-lived upload/download URLs, validates referenced record ownership, restricts content and records completion. Staged upload failure must be cleaned; database and object store do not share one atomic transaction. Deletion/retention reconciles dangling objects. Signed URLs are credentials, excluded from logs.

## Jobs — Phase 4

```text
Authorized request → PostgreSQL job/outbox → BullMQ / Redis → Node worker
→ validate owner + current record state → export/index/process
→ private result + PostgreSQL status → authorized status/download API
```

Outbox/reconciliation recovers missed enqueue after a database commit. Worker processing is at-least-once: idempotent writes/deduplication are mandatory. Record expected revision and recheck cancellation/deletion; retries must not resurrect removed data or publish stale indexes. Jobs contain references, not note text/secrets. Queue and file features need their own detailed execution plan.

## Deployment and limitations

Runtime Next.js is implemented in Phase 1A; public pages remain prerendered, while preview runs the Node server. The real Node Route Handler verification is a disposable test fixture, not an application endpoint. Separate worker runs with explicit shutdown/restart/timeout/concurrency policy. Self-hosted Nginx is optional; managed ingress can replace it. Public assets may cache, private API responses never do. Hosted quotas, pause/worker sleep and backup guarantees are verified before deployment. No E2EE, browser note DB, automatic Drive sync, MinIO or second production database.

[Security](security-architecture.md) · [State](state-management.md) · [Services](../integrations/backend-services.md) · [ADR-018](../decisions/ADR-018-full-stack-server-storage.md)
