# Phase 01 — Full-Stack Foundation Record

**Status:** ✅ UI foundation and Milestone 1A runtime/config boundary; 📋 auth/persistence planned. Updated 2026-10-03.

## Goal and scope

Preserve the shared design system; migrate to runtime Next.js; implement Google sign-in, verified backend session, scoped PostgreSQL/Drizzle CRUD, Zod/Pino/Redis admission limits, in-memory TanStack Query, Zustand/nuqs boundaries, API docs and security tests. Detailed work/progress lives in the [Phase 1 ExecPlan](../../.agent/active/phase-01-foundation.md); do not duplicate the checklist.

## Target data flow

Editor draft → API hook → authenticated validated backend → scoped Drizzle transaction → PostgreSQL commit → response/cache invalidation → saved feedback. Notes are server records, not encrypted vault envelopes. Files/jobs are Phase 4; initial CRUD makes no BullMQ call. No IndexedDB, Drive sync or E2EE foundation.

## Acceptance

Applicable SEC-01–08 in the [security contract](../architecture/security-architecture.md): auth/CSRF, actual owner/RLS isolation, validation, no private persistent browser cache, log/credential redaction, transport/rest evidence, rate limits and revision-safe writes. Session expiry/outage/conflicts are visible; failed/uncertain writes preserve draft without claiming saved. Runtime build/browser checks and API/DB integration pass. Production readiness requires deployment/provider evidence separately.

## Actual outcomes

A separate design-system milestone implemented static Next.js, strict TypeScript, Tailwind tokens, shared accessible UI and controlled sample patterns, with test/CI tooling. Historical reported verification: lint/typecheck, six component tests, static build, nine Chromium E2E tests and dependency audit. Those checks were not rerun by this docs update and establish no auth/storage security. See [design-system plan](../../.agent/active/design-system.md).

On 2026-10-03 the user approved replacing local-first/encrypted-vault plans with full-stack server storage and the agreed backend tools. Specs/plans/docs were updated; source/config/dependencies were not migrated. No auth, database, real note CRUD, Redis, worker, Swagger/Postman runtime, Storage, Nginx, Docker or hosted deployment has been added. UI historical evidence remains intact. Existing device-save/local-sync specimen labels are scheduled for Phase 1G adaptation; they are not already server-save behavior.

## Decisions and learning

[ADR-016](../decisions/ADR-016-supabase-auth-and-server-data.md), [ADR-018](../decisions/ADR-018-full-stack-server-storage.md), [ADR-019](../decisions/ADR-019-backend-services-and-api-tooling.md) are accepted targets. ADR-001/002/003/017 are superseded history. [Learning](../LEARNING.md) separates planned backend concepts from existing UI behavior.

## Next phase

After Phase 1 is actually implemented/reviewed, Phase 2 introduces CodeMirror, sanitized Markdown preview and server-confirmed revision-safe autosave. Do not start implementation from this record alone.

### Documentation revision verification — 2026-10-03

Checked 30 Markdown documents and 124 local links: no missing targets or unbalanced fences. Product specification retains 22 numbered sections and a 14-phase roadmap; agreed stack/features and exclusions were checked. Non-Markdown files matched the pre-edit SHA-256 baseline, with no added non-Markdown files. No application lint/typecheck/unit/E2E/build ran for this docs-only revision; source, dependency lockfile, static runtime config and CI remain unchanged. No Git checkpoint created because the directory is not a Git repository.


## Milestone 1A outcome — 2026-10-03

Next.js 16.3.8 now builds for the Node runtime and preview runs `next start` on loopback.
Public pages are still prerendered; UI source, tokens and showcase are unchanged (SHA-256
baseline verified). There is no application API yet. Exact Zod 4.6.5 and server-only 0.0.1
(MIT) provide lazy APP_ORIGIN validation, fixed input-free errors and compiler-enforced
client import rejection. `.env.example` contains only local setup guidance.

Flow now: browser → local Next production server → prerendered public HTML/JS → React
hydrates controlled sample state. Future server consumers can call validated config; only
a disposable test-only Node Route Handler currently exercises it, including after-build config changes.
No service credentials are required by public routes/build; auth and persistence are still planned.

Fresh checks: `npm run lint` and `npm run typecheck` exit 0; `npm run test` passes 22 tests
(16 config + original six component). `npm run build` with fake server credential markers
exits 0; client scan finds 0 marker leaks across 22 `.next/static` files.
`npm run test:boundary` exits 0 for real Next rejection and request-time Node HTTP probes,
now with actual project Next config. `npm audit --audit-level=high --fetch-retries=0 --fetch-timeout=15000`
exits 0 with 0 vulnerabilities. `npm run test:e2e` on the final marker-injected build exits 0: 11/11 Chromium tests passed (7.7s), including original nine showcase tests. Python Markdown validation checks 30 documents and 125 local file links: 0 missing targets, 0 unbalanced fences. RED/GREEN details are in the
[active plan](../../.agent/active/phase-01-foundation.md#milestone-1a-execution--2026-10-03).

Independent read-only review found no correctness blockers. Deferred tooling minor: isolated
boundary script builds/route-fetch/shutdown lack per-operation deadlines. Browser color-env
warnings are cosmetic. CI workflow updated but no hosted run observed; no production TLS,
provider encryption, auth/RLS/Redis or private-note behavior proven. Stop at 1A for user review;
1B not started. No Git repository, commit or deployment.
