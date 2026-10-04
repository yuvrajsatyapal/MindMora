# MindMora

MindMora is a personal knowledge workspace in development. The product roadmap includes
Markdown notes, linked ideas, graph/canvas, tasks and optional AI with server-authoritative
storage. Today you can run the shared UI showcase and backend Google authentication.
The profiles/notes database foundation exists, but no note API or workspace consumes it.

**Current:** ✅ Node runtime (1A), backend auth (1B), schema/database boundary (1C), HTTP/Redis admission and Pino (1D), plus once-per-process Redis/PostgreSQL startup health.
**Planned:** note CRUD/editor, protected workspace, query/UI/URL state libraries,
Storage/jobs and interactive API tooling. [Exact progress and dated validation](docs/phases/phase-01-foundation.md).

## Run locally

Prerequisites: Node **22.12+**, npm, and a terminal supporting the scripts' POSIX environment
assignment syntax. Locked dependency versions are in `package-lock.json`. Cloud credentials
and Docker are unnecessary for the public homepage/showcase in development. Missing backend
settings produce startup warnings there; production startup requires Redis and PostgreSQL.

```sh
npm ci
npm run dev
# http://localhost:3000/dev/design-system/
```

The homepage links to the showcase. Its sample note/task/save/sync states are presentation
demos, not real persistence. Theme preference is React state and resets on reload.

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
by Node; auth Route Handlers are dynamic. This is not the former static `out/` deployment.

## Backend configuration

For auth/database work or production startup, copy `.env.example` to ignored `.env` **only if `.env` does not
already exist**, then fill the relevant values. Next reads its environment files; database
CLI scripts explicitly load `.env`. Avoid conflicting shell or `.env.local` overrides.
Never commit credentials or expose them through `NEXT_PUBLIC_`/Next `env` configuration.

| Variables | Used by | Setup guide |
|---|---|---|
| `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Server auth configuration; publishable `sb_publishable_...` format | [Google/Supabase auth](docs/integrations/supabase-auth.md#setup-and-manual-verification) |
| `REDIS_URL`, `TRUSTED_CLIENT_IP_HEADER` | Startup Redis check and auth admission; remote verified TLS, forwarded headers ignored by default | [HTTP/Redis setup](docs/integrations/backend-services.md#implemented-redis-admission) |
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

The current development project has already been migrated/provisioned. `db:provision` is
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
| `npm run test:auth` | Production Next/browser auth against disposable provider/Valkey/PostgreSQL; build first, Chromium and Docker required |
| `npm run db:generate` | Generate schema diff; review generated and custom SQL |
| `npm run db:migrate` | Apply reviewed versioned migrations; requires privileged dev URL/verified TLS |
| `npm run db:provision` | First setup: constrained login and private credential-file staging |
| `npm run test:rate-limit` | Disposable loopback Valkey tests; running Docker/image access required |
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
