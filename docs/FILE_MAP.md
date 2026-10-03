# MindMora File Map

**Status:** UI foundation, 1A runtime and 1B auth code implemented; live Google sign-in/session/logout and refresh/replay acceptance verified. Updated 2026-10-04.
Only actual significant files belong here; proposed source paths live in the ExecPlan.

| Existing file | Responsibility |
|---|---|
| `PRODUCT_SPEC.md` | Authoritative full-stack v3 requirements and 14-phase scope |
| `AGENTS.md` | Milestone workflow, current architecture/security and clean commit rules |
| `README.md` | Setup and honest implementation versus target status |
| `ARCHITECTURE.md` | Overview of server storage, memory state, security and jobs |
| `.agent/PLANS.md` | Self-contained execution-plan standard |
| `.agent/active/phase-01-foundation.md` | Active full-stack migration milestones/proposed files/tests |
| `.agent/active/design-system.md` | Completed static UI milestone and historical validation evidence |
| `docs/README.md` | Document index and status conventions |
| `docs/LEARNING.md` | Implemented UI/runtime/auth concepts, reading workflow and clearly planned backend examples |
| `docs/architecture/full-stack-architecture.md` | API data models/save/conflict/file/job paths |
| `docs/architecture/state-management.md` | PostgreSQL vs memory query/UI/draft/URL ownership |
| `docs/architecture/security-architecture.md` | Current measurable SEC-01–10 and trust boundaries |
| `docs/integrations/supabase-auth.md` | Google/session and owner/RLS design |
| `docs/integrations/backend-services.md` | Redis/BullMQ/worker/Nginx/Pino responsibilities/failures |
| `docs/integrations/api-tooling.md` | Zod/OpenAPI/Swagger/Postman contract plan |
| `docs/integrations/hosting-and-costs.md` | Dated hosted quotas, selection constraints and cost controls |
| `docs/phases/README.md`, `docs/phases/phase-01-foundation.md` | Roadmap and actual Phase 1 outcomes |
| `docs/decisions/ADR-016-supabase-auth-and-server-data.md` | Supabase auth/server data decision |
| `docs/decisions/ADR-018-full-stack-server-storage.md` | New server storage/trust model replacing local vault |
| `docs/decisions/ADR-019-backend-services-and-api-tooling.md` | Accepted backend tools and staged rollout |
| `docs/decisions/ADR-001-static-export.md`, `ADR-002-indexeddb-source-of-truth.md`, `ADR-003-dexie.md`, `ADR-017-client-side-encryption.md` | Superseded historical choices, not active requirements |
| `docs/architecture/local-first-architecture.md` | Historical pointer to replacement architecture |

## Implemented UI foundation

| File | Responsibility |
|---|---|
| `src/design-system/tokens.css` | Brand primitives, light/dark semantics, typography, spacing, geometry and motion authority |
| `src/design-system/components.css` | Shared visual and interaction rules |
| `src/components/ui/index.ts` | Public core component entry point |
| `src/components/ui/primitives.tsx` | Typed native controls, labels/errors, loading/disabled contracts and basic feedback |
| `src/components/ui/overlays.tsx` | Radix-backed dialog, tabs, menu, tooltip and live notification wrapper |
| `src/components/ui/theme.tsx` | Session preference projected onto document theme, with system CSS fallback |
| `src/components/ui/brand.tsx`, `public/brand/` | Finalized Junction M and outlined wordmark assets |
| `src/components/mindmora/index.tsx` | Controlled note/link/task/canvas/property/save/sync presentation patterns |
| `src/app/layout.tsx`, `src/app/globals.css` | Prerendered public app document, theme provider and baseline styles |
| `src/app/dev/design-system/showcase.tsx` | Composed reference page with in-memory demo interactions |
| `scripts/check-styles.mjs` | Reject raw colors, inline style props and arbitrary utility escapes |
| `scripts/preview.mjs` | Loopback Next production runtime launcher, forwards shutdown signals |
| `tests/e2e/design-system.spec.ts` | Showcase accessibility, keyboard, responsive, theme and motion on the runtime preview |
| `.github/workflows/quality.yml` | Locked install, audit, checks, server-boundary fixtures, runtime build and browser verification; hosted run not observed |

## Implemented runtime boundary

| File | Responsibility |
|---|---|
| `next.config.ts`, `package.json`/lock | Node-compatible Next build, production start, exact Zod/server-only dependencies |
| `.env.example` | Optional public-showcase setup, APP_ORIGIN placeholder and secret visibility guidance |
| `src/server/config.ts` | Lazy validated origin, safe fixed error, server-only import restriction |
| `src/server/config.test.ts` | Origin validation, secret-safe failures, minimal projection and environment reads |
| `scripts/test-server-boundary.mjs` | Disposable real Next compiler rejection and Node Route Handler request-time probe; cleans fixture |
| `tests/e2e/runtime.spec.ts`, `playwright.config.ts` | Runtime 404/public output checks, fake secret markers and fresh loopback preview |

No database, note API/repository, query/UI/URL state library, queue or worker has been introduced. Auth modules below are implemented; live refresh/replay acceptance is verified.


## Implemented backend-owned auth — 1B

| File | Responsibility |
|---|---|
| `src/server/config.ts` | Lazy auth URL/publishable-key validation alongside 1A origin config |
| `src/server/auth/provider.ts` | Per-request official auth SDK, transient PKCE/session storage, exchange/refresh/getUser/local revoke, safe failure classification |
| `src/server/auth/session.ts` | Cookie names/limits, state/expiry, validated token payload and verified refresh result |
| `src/server/auth/routes.ts` | Auth methods/origins/query policy, fixed redirects, safe response and cookie lifecycle |
| `src/app/api/auth/{start,callback,session,logout}/route.ts` | Node force-dynamic adapters, including non-cacheable unsupported methods |
| `src/features/account/types.ts`, `api.ts` | Strict safe projection and memory-only browser session/logout calls; no auth SDK/provider dependency |
| `src/server/auth/config.test.ts`, `routes.test.ts`, `src/features/account/api.test.ts` | Meaningful config/SDK/HTTP-policy/client boundary tests |
| `src/tests/auth-provider-fixture.ts` | Test-only S256 provider transport, independent sessions and controlled error/revocation/refresh behavior |
| `scripts/test-auth-e2e.mjs`, `playwright.auth.config.ts`, `tests/e2e/auth.spec.ts` | Disposable loopback provider and real Next/browser auth cookie/projection/refresh/logout integration |
| `docs/api/openapi.json` | Auth-only contract; projection schema derived from implemented Zod type; no credential examples |
| `docs/decisions/ADR-020-backend-owned-auth-cookies.md` | Cookie design, alternatives, trade-offs and live acceptance evidence |

`.env` is an ignored local configuration file with user-supplied values; `.env.example` remains safe placeholders. Neither Google client secrets nor service-role credentials are needed by app auth.
