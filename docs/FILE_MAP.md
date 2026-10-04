# MindMora File Map

**Inspected:** 2026-10-04, through 1C. This is navigation: responsibility, public entry points
and connections. Study [LEARNING](LEARNING.md) for concepts and [ARCHITECTURE](../ARCHITECTURE.md)
for system structure. Proposed paths belong in the active plan, not this map.

## Public UI and runtime

| File | Responsibility / why it exists | Important exports | Called by / dependencies / related files |
|---|---|---|---|
| [layout.tsx](../src/app/layout.tsx) | Root document, CSS and shared theme context | default `RootLayout`, `metadata` | Next App Router; `ThemeProvider`, globals CSS |
| [page.tsx](../src/app/page.tsx) | Public entry linking to showcase | default `Home` | Next; Logo/Card/Link; no auth or DB |
| [showcase.tsx](../src/app/dev/design-system/showcase.tsx) | Composed interactive reference using sample state | `Showcase` | Design-system page; core/product components; page-lifetime React state |
| [tokens.css](../src/design-system/tokens.css), [components.css](../src/design-system/components.css) | Shared semantic values and interaction/visual rules | CSS variables/classes | Globals/UI/product components; [design contract](design/design-system.md) |
| [ui/index.ts](../src/components/ui/index.ts), [primitives.tsx](../src/components/ui/primitives.tsx), [overlays.tsx](../src/components/ui/overlays.tsx) | Reusable typed controls and Radix-backed accessible patterns | Core controls; `Dialog`, `Tabs`, `Menu`, `Tooltip`, `Toast` | Pages/showcase; Radix and semantic CSS; [component API](design/component-api.md) |
| [theme.tsx](../src/components/ui/theme.tsx), [brand.tsx](../src/components/ui/brand.tsx) | Document theme projection and shared branding | `ThemeProvider`, `ThemeSelect`, `Logo` | Layout/showcase; React state, public brand SVGs |
| [mindmora/index.tsx](../src/components/mindmora/index.tsx) | Controlled product presentation without persistence | `NoteRow`, `TaskRow`, `SaveStatus`, `SyncStatus`, canvas/link/property patterns | Showcase; callback props/core UI; labels do not imply backend actions |
| [next.config.ts](../next.config.ts), [preview.mjs](../scripts/preview.mjs) | Node-compatible build and loopback production launcher | default Next config; CLI script | npm dev/build/start/preview; Next runtime and shutdown forwarding |

## Backend auth and browser projection

| File | Responsibility / why it exists | Important exports | Called by / dependencies / related files |
|---|---|---|---|
| [server/config.ts](../src/server/config.ts) | Lazy selected-env validation keeps public pages independent of setup | `getServerConfig`, `getAuthConfig`, `AuthConfig` | Auth routes/context; Zod + server-only; no DB loader here |
| [api/auth](../src/app/api/auth/) route adapters | Node/dynamic entry points including explicit unsupported methods | HTTP handlers, `runtime`, `dynamic` | Next HTTP → `handleAuth`; start/callback/session/logout files |
| [auth/routes.ts](../src/server/auth/routes.ts) | One HTTP/cookie/redirect policy for four actions | `handleAuth`, `AuthAction` | Route adapters/tests; config/provider/session; provider disposal in finally |
| [auth/provider.ts](../src/server/auth/provider.ts) | Isolate SDK protocol and transient storage from HTTP policy | `createAuthProvider`, `AuthFailure`, `tokenSchema`, `AuthTokens` | Auth routes, DB context, session helper; official AuthClient and safe projection |
| [auth/session.ts](../src/server/auth/session.ts) | Parse protected-cookie input, verify state and manage refresh result | Cookie/state helpers, `pendingSchema`, `verifySession` | Auth routes/DB context; provider methods, crypto, NextResponse |
| [account/types.ts](../src/features/account/types.ts) | Shared browser-safe session shape | `sessionProjectionSchema`, `SessionProjection` | Provider/browser helper/tests; Zod; no server imports |
| [account/api.ts](../src/features/account/api.ts) | Validate fetched session data; expose logout without retaining tokens | `readSession`, `logout` | Unit tests; no current page caller; browser fetch → auth routes |

Detailed behavior/setup: [auth guide](integrations/supabase-auth.md). Decision: [ADR-020](decisions/ADR-020-backend-owned-auth-cookies.md).

## Note contracts and database boundary

| File | Responsibility / why it exists | Important exports | Called by / dependencies / related files |
|---|---|---|---|
| [notes/validation.ts](../src/features/notes/validation.ts) | Define strict bounded mutation/list inputs before note APIs arrive | Title/body/revision constants; create/update/delete/list/cursor schemas | `types.ts`, validation tests; Zod; no HTTP caller |
| [notes/types.ts](../src/features/notes/types.ts) | Validate domain projections and infer shared types | `noteSchema`, `profileSchema`, Note/Profile/input types | Tests/type definitions; validation; no current row serializer |
| [db/schema.ts](../src/server/db/schema.ts) | Describe tables/checks/index/policies and Auth/profile integrity | `profiles`, `notes` | Client, Drizzle generator, integration tests; Drizzle/Auth table definition |
| [db/config.ts](../src/server/db/config.ts) | Distinguish runtime and privileged config; validate URL/pool/CA safely | `getDatabaseConfig`, `getMigrationConfig`, `DatabaseConfig` | Lazy pool, CLI common module/tests; Zod/node fs; no eager env read |
| [db/user-context.ts](../src/server/db/user-context.ts) | Admit only the actual issued verified owner object | `verifyDatabaseSession`, `assertVerifiedOwner`, `VerifiedOwner` | Integration tests / client assertion; auth config/provider/session; no HTTP caller |
| [db/client.ts](../src/server/db/client.ts) | Contain connections, role checks, LOCAL identity and safe transaction errors | `createDatabase`, `getDatabase`, `DatabaseFailure`; returned `run`, `close` | Integration tests use factory; singleton has no current app caller; postgres-js/Drizzle/schema/context |
| [drizzle.config.ts](../drizzle.config.ts), [0000_profiles_notes.sql](../supabase/migrations/0000_profiles_notes.sql), [meta](../supabase/migrations/meta/) | Generate/version reviewed schema changes; preserve manual role/grant/FORCE clauses | Generator config; SQL; journal/snapshot | `db:generate` / migrator; no startup reset or auto migration |

Detailed operation/setup: [database guide](integrations/supabase-database.md).
Field contract: [note model](features/note-model.md). Decision: [ADR-021](decisions/ADR-021-scoped-database-role.md).

## Privileged CLI and credential recovery

| File | Responsibility / why it exists | Entry points | Calls / dependencies |
|---|---|---|---|
| [database-common.mjs](../scripts/database-common.mjs) | Shared privileged connection and versioned migrator | `adminConnection`, `applyMigrations` | Migration/provision/local test scripts; DB config, postgres-js, Drizzle migrator |
| [migrate-database.mjs](../scripts/migrate-database.mjs) | Apply reviewed SQL with safe failure output and connection cleanup | `db:migrate` script | Common module; `.env` through Node CLI |
| [provision-database.mjs](../scripts/provision-database.mjs) | First-time constrained login/URL setup; refuse existing role/nonempty env | `db:provision` script | Crypto, common module, role/file helpers; writes ignored local files |
| [provision-role.ts](../scripts/provision-role.ts) | Keep CREATE ROLE and membership GRANT transactional | `provisionRuntimeRole` | Provision/local DB scripts; postgres transaction; trusted server-formatted DDL |
| [provision-files.ts](../scripts/provision-files.ts) | Stage/fsync private credentials, compare original env and atomically publish | `stageCredentialFile`; returned `publish` | Provision script/file tests; node fs; pending recovery file |

## Verification entry points

| Files | Purpose / connections |
|---|---|
| [vitest.config.ts](../vitest.config.ts), [src/tests/setup.ts](../src/tests/setup.ts) | Unit/component environment for `src/**/*.test.ts/tsx` |
| [auth-provider-fixture.ts](../src/tests/auth-provider-fixture.ts), auth route/config/account tests | Actual SDK with controlled transport; independent provider-session/error/refresh fixtures |
| [validation.test.ts](../src/features/notes/validation.test.ts), [DB config test](../src/server/db/config.test.ts), [provision file test](../src/server/db/provision-files.test.ts) | Contract/config/credential staging regressions |
| [test-server-boundary.mjs](../scripts/test-server-boundary.mjs) | Actual Next client import rejection and disposable request-time Node route |
| [test-database.mjs](../scripts/test-database.mjs), [vitest.database.config.ts](../vitest.database.config.ts), [rls.test.ts](../tests/integration/rls.test.ts) | Real SQL roles/RLS/constraints/reuse; Docker bootstrap or hosted dev fixture mutations |
| [playwright.config.ts](../playwright.config.ts), [tests/e2e](../tests/e2e/) | Production showcase/runtime browser checks; starts fresh preview |
| [test-auth-e2e.mjs](../scripts/test-auth-e2e.mjs), [playwright.auth.config.ts](../playwright.auth.config.ts) | Disposable provider + real Next/browser auth; caller of test-only SDK fixture |
| [check-styles.mjs](../scripts/check-styles.mjs), [quality.yml](../.github/workflows/quality.yml) | Style rules and automated check configuration; not proof of an observed hosted CI run |
| [openapi.json](api/openapi.json) | Existing auth-only contract; broader generation/Swagger/Postman absent |

The [docs index](README.md) maps document responsibilities; the [active Phase 1 plan](../.agent/active/phase-01-foundation.md)
owns live progress. Actual paths above are implemented. Repository/service/cache/worker
paths in later milestones are proposals, not missing parts of this file map.
