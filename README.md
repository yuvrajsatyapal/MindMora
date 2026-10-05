# MindMora

MindMora is a personal knowledge workspace in development. The product roadmap includes
Markdown notes, linked ideas, graph/canvas, tasks and optional AI with server-authoritative
storage. Today the protected workspace supports Google sign-in, explicit note saves,
revision conflicts and server persistence. The shared UI showcase remains sample-only.

**Current:** ✅ Phase 1 foundation code: Node runtime, backend Google sessions,
owner-scoped PostgreSQL/RLS note APIs, Redis admission/Pino, protected `/workspace/`,
memory-only state, explicit Save/conflict recovery and generated API tooling.
Production hosting/security evidence is separate; see the [Phase 1 record](docs/phases/phase-01-foundation.md).

## Run locally

Prerequisites: Node **22.15+**, npm, and a terminal supporting the scripts' POSIX environment
assignment syntax. Locked dependency versions are in `package-lock.json`. Cloud credentials
and Docker are unnecessary for the public homepage/showcase in development. Missing backend
settings produce startup warnings there; production startup requires Redis and PostgreSQL.

```sh
npm ci
npm run dev
# http://localhost:3000/dev/design-system/
```

The homepage introduces MindMora and links to the protected workspace and design showcase.
Its authored example note is static public content. Showcase note/task/save/sync states are
presentation demos, not real persistence. Theme controls appear on the homepage, workspace
and showcase; preference is React state and resets on reload. Dark mode uses neutral charcoal;
the light palette is unchanged.

```sh
npm run build
npm run preview
# http://127.0.0.1:4173/dev/design-system/
```

Build needs no live services. Before production preview/start, configure the Redis and runtime
PostgreSQL settings below and make both reachable. Startup logs one safe result per service;
failure exits with code 1. Successful ticks are green and failed ticks red in color-enabled
terminals; ordinary redirected logs remain plain. Development warns and continues when
settings/services are unavailable. Checks run once per server process, not on requests.
See [startup behavior and limits](docs/integrations/backend-services.md#server-startup-health--implemented-follow-up-to-1d).
Build writes `.next/`; preview uses `next start` on loopback port 4173. Standard runtime:
`npm run start -- --hostname 127.0.0.1 --port 3000`. Public pages are prerendered and served
by Node; auth and note Route Handlers are dynamic. This is not the former static `out/` deployment.

## Backend configuration

For auth/database work or production startup, copy `.env.example` to ignored `.env` **only if `.env` does not
already exist**, then fill the relevant values. Next reads its environment files; database
CLI scripts explicitly load `.env`. Avoid conflicting shell or `.env.local` overrides.
Never commit credentials or expose them through `NEXT_PUBLIC_`/Next `env` configuration.

| Variables | Used by | Setup guide |
|---|---|---|
| `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Server auth configuration; publishable `sb_publishable_...` format | [Google/Supabase auth](docs/integrations/supabase-auth.md#setup-and-manual-verification) |
| `REDIS_URL`, `TRUSTED_CLIENT_IP_HEADER` | Startup Redis check and auth/note admission; remote verified TLS, forwarded headers ignored by default | [HTTP/Redis setup](docs/integrations/backend-services.md#implemented-redis-admission) |
| `MIGRATION_DATABASE_URL` | Privileged migration/provision CLI only | [Database setup](docs/integrations/supabase-database.md#development-setup) |
| `DATABASE_URL`, `DATABASE_POOL_MAX`, `DATABASE_CA_CERT_PATH` | Startup PostgreSQL check, constrained runtime database pool and TLS | [Database configuration](docs/integrations/supabase-database.md#configuration-and-pooling) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional setup references; **not read by app code** | Configure Google credentials in Supabase provider settings |

For local auth admission, run this disposable Redis-compatible server in a separate terminal,
set `REDIS_URL=redis://127.0.0.1:6379` in ignored `.env`, and restart Next:

```sh
docker run --rm --publish 127.0.0.1:6379:6379 \
  valkey/valkey:8.1.10-alpine@sha256:081c2f5cb575efc901aa80ff9cdbd1ec6a301682fd35e1ebb4b0990a4a4a8507 \
  valkey-server --save "" --appendonly no
```

This is local counter state with no persistent volume. Hosted Redis requires `rediss://`
and verified service/ingress settings. Without Redis admission, auth returns 503.

The development project was migrated/provisioned through 1C. Milestone 1E adds
`0001_note_create_idempotency.sql`; it was applied to the configured development Supabase
on 2026-10-05 after diagnosing a note-save failure. For a fresh environment, review it and
run `npm run db:migrate` with the privileged development URL. Existing runtime credentials
remain usable; do not reprovision them. [Note API contract](docs/features/notes-api.md)
describes required operation keys, revisions and cursors.

The current development project has already been provisioned. `db:provision` is
first-time setup, not a password-rotation command. A pending recovery file requires state
verification; follow the [provisioning guide](docs/integrations/supabase-database.md#migration-and-provisioning-flow).

## Development commands

| Command | Purpose / prerequisites |
|---|---|
| `npm run lint` | ESLint and design-style contract |
| `npm run typecheck` | Strict TypeScript |
| `npm run test` | Unit/component tests; controlled provider transport |
| `npm run build` | Production Node build |
| `npm run test:startup` | Actual Node startup/restart/failure/dev tests plus real probes; build and Docker required |
| `npm run test:boundary` | Disposable Next compiler/server fixtures; needs loopback sockets |
| `npm run test:e2e` | Showcase/runtime browser checks with disposable Redis/PostgreSQL; Docker and build required, install Chromium with `npx playwright install chromium` |
| `npm run test:auth` | Production Next/browser auth and note CRUD against disposable provider/Valkey/PostgreSQL; build first, Chromium and Docker required |
| `npm run db:generate` | Generate schema diff; review generated and custom SQL |
| `npm run db:migrate` | Apply reviewed versioned migrations; requires privileged dev URL/verified TLS |
| `npm run db:provision` | First setup: constrained login and private credential-file staging |
| `npm run test:rate-limit` | Disposable loopback Valkey tests; running Docker/image access required |
| `npm run test:notes` | Real note HTTP-handler/SQL/Redis behavior, including concurrent writes; Docker required |
| `npm run test:db` | Disposable local PostgreSQL tests; running Docker daemon/image access required |
| `npm run test:db:hosted` | Mutates/cleans disposable fixture IDs in configured development Supabase; not a read-only production check |
| `npm audit --audit-level=high` | Dependency advisory check; network required |

Playwright starts a fresh preview and refuses to reuse an existing one; free port 4173
before running browser tests. CI runs local Docker/fixture checks, not hosted Supabase tests.
Historical success and remaining deployment limitations live in the phase record, not in
this command list. Tests do not establish production readiness.

## Understand the project

- [ARCHITECTURE](ARCHITECTURE.md): current components, boundaries and flows.
- [LEARNING](docs/LEARNING.md): concepts, mental models and progressive source-reading order.
- [FILE_MAP](docs/FILE_MAP.md): important exports, callers and dependencies.
- [Documentation index](docs/README.md): subsystem guides, decisions and records.
- [PRODUCT_SPEC](PRODUCT_SPEC.md): authoritative target requirements and roadmap.

Knowledge is intended to be server-readable, with access controls and verified transport;
there is no E2EE vault or durable offline browser workspace. Storage/backup/production
transport guarantees remain unverified. See [security](docs/architecture/security-architecture.md)
and the dated [hosting constraints](docs/integrations/hosting-and-costs.md).

## Using the notes workspace

Open `/workspace/` after configuring Auth, Redis and the constrained database login above.
Continue with Google, then follow the homepage workspace link. Create a note, edit its title
and Markdown text, and press **Save note**. Only server-confirmed writes show saved.
Drafts live in this tab; reload/closing can lose unsaved work. Conflicts keep your draft
and require an explicit choice of server version or saving against the newer revision.
Normal note writes use PostgreSQL directly.

The configured development Supabase project now includes the additive 1E migration.
Applying that schema does not establish live browser acceptance or production deployment.

`npm run api:generate` regenerates OpenAPI and Postman from shared Zod schemas and reviewed
operation metadata. `npm run api:check` checks drift; `npm run test:contract` checks route
and contract boundaries. `/dev/api-docs/` loads Swagger in development; production returns
404 unless `API_DOCS_ENABLED=true`. Use app Google sign-in for cookies. The console permits
only same-origin API calls. Import `docs/api/mindmora.postman_collection.json` with a disposable
local runtime; credentials are never included. See [API tooling](docs/integrations/api-tooling.md).

`npm run test:auth` now includes protected workspace, two-user isolation, conflict, offline/
response-loss, logout, accessibility, Swagger and generated-collection browser checks.
It uses disposable Docker PostgreSQL/Redis and controlled Auth transport; it does not prove
a fresh live Google or production deployment acceptance.
