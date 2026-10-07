# Phase 3 — Knowledge features

**Status:** ✅ Implemented and locally accepted, 2026-10-07. The [active ExecPlan](../../.agent/active/phase-03-knowledge.md) owns the sole acceptance checklist and the full execution ledger. This record reports observed local outcomes; it does not certify hosted rollout.

## Outcome

The existing protected editor now supports portable wiki links/completion, explicit idempotent missing-note creation, committed backlinks/counts/context, inline tags/exact filters and full-server-corpus keyword search. Draft guards and revision/conflict recovery remain intact. Canonical writes and derived records commit together. Effective owner/source RLS secures both new tables. A privileged revision-safe CLI repairs old records without changing canonical revisions/timestamps. Read/UI rollout remains default-off until verified.

[Knowledge behavior and failure cases](../features/knowledge.md), [architecture](../../ARCHITECTURE.md), [design](../design/phase-03-knowledge.md) and [ADR-028](../decisions/ADR-028-knowledge-derivation-and-title-resolution.md) own details.

## Observed validation — 2026-10-07

| Command | Result | Evidence boundary |
|---|---|---|
| `npm run lint` | PASS | ESLint and semantic style contract |
| `npm run typecheck` | PASS | Strict TypeScript |
| `npm run test` | PASS: 220 tests / 41 files | Unit/component fixtures |
| `npm run test:db` | PASS: 17 tests / 2 files | Disposable PostgreSQL17, constrained role, RLS, atomicity/backfill and size bounds |
| `npm run test:notes` | PASS: 17 tests / 2 files | Real disposable PostgreSQL/Redis API fixtures |
| `npm run api:generate`, `npm run api:check`, `npm run test:contract` | PASS | Ten paths, thirteen operations, schema/adapter drift and secret-free collection |
| `API_SMOKE_BASE_URL=http://127.0.0.1:4173 npm run test:api-collection` | PASS | All thirteen unauthenticated admissions; authenticated collection operations exercised by auth browser fixture |
| `npm run test:rate-limit` | PASS: 5 tests | Local Redis admission/failure fixtures |
| `npm run test:boundary` | PASS: 3 checks | Client import rejection and request-time server configuration |
| `npm run build` | PASS | Production webpack build; ten API paths dynamic |
| `npm run test:auth` | PASS: 24 scenarios | Fake OAuth/Supabase provider, real local database/Redis, production CSP/runtime |
| `npm run test:e2e` | PASS: 14 scenarios | Public pages, theme/reflow/reduced motion/accessibility and credential bundle markers |
| `npm run test:startup` | PASS: 4 tests plus live-process checks | Connectivity, one-time startup logging, unavailable dependencies prevent readiness |
| `npm audit --audit-level=high` | PASS threshold; 4 low / 4 moderate findings remain | Existing locked dependency tree; no high/critical findings |

Maximum-byte unique-token save/search and dense wiki/tag commits pass. An isolated full-source parser measurement processed 1,048,576 bytes/29,959 occurrences in 314 ms; this is not a production benchmark. Disposable EXPLAIN selected title/hash and exact tag/hash indexes; native search selected an owner index on this small RLS corpus. No GIN-selection or production-latency guarantee is claimed. Scoped independent review accepted the fixes without unresolved findings.

Intermediate failures are preserved in the active plan: RLS replacement, Unicode index bounds, parser cost/HTML boundaries, native vector overflow, accessibility hierarchy, browser timing, overlapping Playwright output/port and a too-specific EXPLAIN assertion. All were corrected or honestly reinterpreted and relevant checks rerun.

## Limits and stop boundary

At initial local acceptance, hosted migration/backfill were not run; subsequent authorized application is recorded below. Live Google/transport/storage/ingress and production verification remain separate. Keyword search is configuration-dependent, live pages are not snapshots, and oversized vectors use a slower full-token query fallback under SQL timeouts. Server/provider administrators can read notes; no E2EE claim is made. Browser knowledge remains memory-only and unsaved text can be lost on reload. Inherited low/moderate audit findings remain. Attachments, workers/jobs, graph/canvas, advanced search and AI are deferred. Phase 4 was not begun; no commit or deployment occurred.

## Authorized hosted migration/backfill follow-up — 2026-10-07

After the user authorized application, `npm run db:migrate` applied the pending Phase 3 migration and `npm run db:backfill:knowledge` verified 4 records with 0 concurrent-change retries in the configured development Supabase. Subsequent read-only checks confirmed the migration ledger/new schema, zero active stale knowledge revisions, zero invalid associations, preserved constrained runtime grants and a successful owned note-list query under request role/claim. This repairs the missing-schema cause of `/api/notes/` 503; browser HTTP recovery was not directly exercised by these checks. Feature flag remains unchanged/default off. The separately diagnosed APP_ORIGIN 3000 versus actual port 3001 still needs alignment for writes; no origin/port/provider configuration was changed under database-only authorization. No reset, provisioning, credential rotation, deployment or Phase 4 work occurred.

### Local Origin follow-up — 2026-10-07

The subsequent save 403 was independently caused by APP_ORIGIN 3000 with MindMora actually on 3001. Local ignored `.env` now specifies `http://localhost:3001`. Live dev HTTP verification admits that origin through to 401 without a cookie, while 3000/foreign origins remain 403. No Origin validation was relaxed; the user's draft need not be reloaded. Browser authenticated save and Supabase callback-allowlist verification remain separate from these probes.
