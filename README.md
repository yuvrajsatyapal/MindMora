# MindMora

> Your knowledge. Your files. Your control.

MindMora is a planned full-stack personal knowledge workspace: Markdown notes, linked ideas, graph/canvas, tasks, database views and optional AI, with authenticated server storage and portable import/export.

**Current status:** ✅ 1A runtime and 1B backend auth code/local verification; ✅ live Google sign-in/session/logout and refresh/replay acceptance verified. Shared design-system showcase preserved; database, notes, Storage, Redis, queues and interactive API docs remain planned.

## Proposed stack

Next.js/React/TypeScript/Tailwind + existing accessible design system; Supabase Auth (Google), PostgreSQL + Drizzle, private Supabase Storage; TanStack Query in memory, Zustand UI, nuqs URL state; Zod validation, Pino logs, Redis rate limits, BullMQ + separate worker, optional self-hosted Nginx, OpenAPI/Swagger/Postman. Preserve existing editor/graph/canvas/product and optional local/BYOK AI plans.

```text
Browser → HTTPS / Nginx or managed ingress → Next.js backend
    │                                        ├→ Supabase Auth
TanStack Query                               ├→ Zod / permissions / Redis limits
(memory only)                                ├→ Drizzle → PostgreSQL
                                             ├→ private Storage
                                             └→ BullMQ → Redis → Node worker
                                                   API/worker → redacted Pino logs
OpenAPI → Swagger UI / generated Postman collection
```

No persistent browser note DB/cache, no E2EE vault/passphrase/recovery key, no MinIO. HTTPS and infrastructure encryption at rest protect transport/storage; authorized server/provider can read content. Readable notes still appear in browser memory while editing. Free-tier quotas/pauses and worker hosting are constraints, not guaranteed free unlimited uptime. See [security](docs/architecture/security-architecture.md) and [budget](docs/integrations/hosting-and-costs.md).

## Start here

1. [Product specification](PRODUCT_SPEC.md) — v3 and revised 14-phase roadmap.
2. [Agent instructions](AGENTS.md) — small milestones, explanations, tests/docs and commit rules.
3. [Architecture](ARCHITECTURE.md) and [documentation index](docs/README.md).
4. [Plan standard](.agent/PLANS.md) and [Phase 1 ExecPlan](.agent/active/phase-01-foundation.md).
5. [File map](docs/FILE_MAP.md) and [learning notes](docs/LEARNING.md).

## Run the runtime showcase

Node 22.12+ (verified on 22.22.3; Next 16.3.8 requires Node 20.9+). No cloud credentials are needed for the public showcase.

```sh
npm ci
npm run dev
# http://localhost:3000/dev/design-system/
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:boundary
npx playwright install chromium
npm run test:e2e
npm run test:auth
npm run preview
# http://127.0.0.1:4173/dev/design-system/
```

`npm run build` creates a production Next build in `.next/`; `npm run preview` runs it on `127.0.0.1:4173`, and `npm run start -- --hostname 127.0.0.1 --port 3000` is the standard production-runtime command. Build before preview/start/E2E. Existing public pages are still prerendered, served by the Node server; no `out/` deployment is used. Playwright always starts its own preview to avoid checking a stale or differently configured server.

`src/server/config.ts` uses Zod and `server-only`. Calling `getServerConfig()` requires `APP_ORIGIN`; importing the module does not. Copy `.env.example` to `.env.local` when a server consumer needs configuration. Use `http://localhost:3000` for dev or `http://127.0.0.1:4173` for preview; non-loopback origins require HTTPS. Paths, credentials, query strings and fragments are rejected. Errors never echo input. Public pages do not consume auth config. Auth routes lazily require SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY; database/Redis credentials arrive in their own milestones. Never expose secrets using `NEXT_PUBLIC_` or Next's `env` config.

`npm run test:boundary` creates and removes a disposable Next app. It proves that client imports fail, server imports compile, and a test-only Node Route Handler reads request-time config. This fixture is not an application API. E2E checks the original showcase plus runtime 404 and marker-free public HTML/loaded JavaScript. CI supplies fake credential markers at build and preview time. For the same local build-time probe:

```sh
SUPABASE_SERVICE_ROLE_KEY=mindmora-private-service-key-marker DATABASE_URL=postgresql://mindmora-private-database-marker npm run build
npm run test:e2e
```

Theme remains session-only and samples do not save notes. See [design contract](docs/design/design-system.md), [component API](docs/design/component-api.md), [dependency record](docs/design/dependencies.md) and [Phase 1 outcomes](docs/phases/phase-01-foundation.md). Runtime/CI changes are local evidence; no hosted GitHub Actions run, production TLS, deployment or provider readiness is established. Docker/Nginx/workers remain planned; hosting is unselected.

## Backend auth — Milestone 1B

Fill the ignored `.env` with APP_ORIGIN, SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. The exact `sb_publishable_...` key is supported; no service-role key needed. Configure Google client ID/secret in Supabase's Google provider dashboard, and the callback allowlist described in [auth setup](docs/integrations/supabase-auth.md#configure-local-google-verification). The latest read-only settings check returned HTTP 200 with Google enabled. The live flow completed Google login/callback and returned a verified safe session. Logout returned 204 and a subsequent same-browser session check returned 401. Live refresh/rotation, immediate reuse, concurrent refresh, revoked credential replay and independent-session logout checks passed (13/13); natural JWT expiry was not awaited.

Current APIs: same-origin POST `/api/auth/start`, GET `/api/auth/callback`, GET `/api/auth/session` and same-origin POST `/api/auth/logout`. App cookies are HttpOnly, Secure/__Host on HTTPS (loopback HTTP exemption), and auth responses are no-store. Session returns only id/email/displayName. Homepage/showcase remain public; no sign-in/workspace screen or database is added. See [ADR-020](docs/decisions/ADR-020-backend-owned-auth-cookies.md) and the auth-only [OpenAPI contract](docs/api/openapi.json).

Build first, then `npm run test:auth`: it uses the official SDK with a disposable local provider and real Next/browser cookies. The script explicitly enables Node's TypeScript stripping for test-only fixtures, compatible with the project's Node 22.12+ baseline; no new transpiler dependency. This is application integration evidence, not real Google consent/provider evidence. Redis admission/Pino/general HTTP controls remain 1D; do not deploy these endpoints as production-ready yet.

## Working milestone-by-milestone

Request: “Implement only Milestone 1A from the active Phase 1 plan. Explain expected files before editing; after implementation report files, flow, concepts, verification and documentation updates. Do not start 1B.”

Plans are not permission to build the whole phase. Later phase plans arrive as their work starts. Git checkpoints only when requested; conventional messages without AI attribution. Keep specs/Markdown docs in version control.
