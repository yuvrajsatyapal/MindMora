# ADR-025 — Workspace memory and contract tooling

**Decision:** Accepted and implemented for remaining Phase 1, 2026-10-05.
**Scope:** Workspace ownership/lifecycle and inspectable auth/note contracts. This decision
does not introduce durable browser knowledge, deployment, background jobs or Phase 2 scope.

## Context

The authoritative note APIs need a usable editor without duplicating PostgreSQL authority
or leaking previous account data into a new session. Network loss can hide a committed write;
revision conflicts must retain user work rather than silently overwrite another update.
Manual OpenAPI records also need shared payload schemas, drift checks and safe developer
execution without exported credentials or arbitrary destinations.

## Decision

Use TanStack Query in memory for fetched notes, keyed by verified owner and lease generation.
WorkspaceShell owns the QueryClient and session lease; cancellation, cleanup and acceptance
checks accompany account/logout transitions. Zustand owns only sidebar visibility; nuqs
owns UUID selection; the mounted editor owns drafts and base revision. Save explicitly and
update/invalidate caches only from confirmed responses. Preserve an uncertain create's
original input/idempotency UUID for exact replay and present conflicts for explicit resolution.

Generate OpenAPI schemas using installed Zod 4's native JSON Schema conversion. Keep reviewed
operation/status/header/security metadata in a separate editable manifest, then generate
OpenAPI and a credential-free Postman collection. Check byte drift, actual route inventory,
method admission and local references. Runtime tests remain necessary because generated
shapes and method sentinels do not prove every response behavior or refinement.

Use `swagger-ui-react` with client-only lazy loading. Interactive docs default to development;
production requires `API_DOCS_ENABLED=true`. Reject off-origin and non-API requests, embedded
URL credentials and Google redirect endpoints. Disable auth persistence and remote validation
in actual Swagger configuration. The app's Google navigation flow establishes cookie sessions.

## Alternatives considered

1. Put fetched records, drafts and selection into one Zustand store: fewer surface areas,
   but conflates authority, invalidation and in-progress text and complicates account cleanup.
2. Persist Query/drafts in browser storage: improves reload/offline continuity, but violates
   the accepted server-owned knowledge boundary and adds durable private cache risk.
3. Automatically overwrite/retry on conflict: convenient, but can destroy concurrent work
   or duplicate an ambiguous create. Revision checks and original-operation replay are safer.
4. Add a separate Zod-to-OpenAPI adapter: possible richer annotations, but adds version and
   compatibility overhead when installed Zod already produces standard JSON Schema.
5. Keep unrelated hand-written schemas or expose Swagger publicly by default: lower immediate
   setup cost, but schema drift and interactive production exposure remain easier to miss.

## Rationale

Separating working state preserves the database's authority while giving each UI concern one
owner. Lease checks add acceptance protection beyond cancellation alone. Exact create replay
uses existing server idempotency rather than a durable client mutation queue. Native generation
avoids an unnecessary schema dependency and makes payload shape changes reviewable. Reviewed
metadata acknowledges which HTTP semantics need human maintenance. Swagger's same-origin
lock preserves the application's existing cookie/Origin security controls.

## Trade-offs and consequences

- Memory-only drafts and unresolved keys are lost on reload/close. This is intentionally not
  an offline product; navigation warnings do not guarantee recovery.
- Verifying the session before every note operation adds an auth request and provider
  dependency. It makes account changes visible before accepting private note results.
- No automatic mutation retries/optimistic saved label: more explicit recovery interaction,
  with commit-confirmed success and fewer silent conflicts.
- JSON Schema cannot represent all Unicode/byte/refinement constraints; annotate them and
  enforce them in runtime Zod. Status/header metadata remains reviewed rather than inferred.
- Swagger adds a sizeable lazy-loaded dependency. Transitive React peer declarations lag
  React 19, so real browser evidence is required. No hosted deployment or paid account follows
  from the free local libraries.
- Node minimum increases to 22.15.0 because the generator uses `registerHooks` to resolve local
  bundler-style TypeScript imports. Installed Node 22.22.3 satisfies this requirement.

[State ownership](../architecture/state-management.md) · [Workspace](../features/notes-workspace.md) ·
[API tooling](../integrations/api-tooling.md) · [ADR-019](ADR-019-backend-services-and-api-tooling.md) ·
[Active acceptance evidence](../../.agent/active/phase-01-foundation.md).
