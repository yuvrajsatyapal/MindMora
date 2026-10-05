# MindMora File Map

**Inspected:** 2026-10-05, through Phase 2 source/editor/CSP implementation; full Phase 2 local acceptance passed.
Each row separates where code lives, why it exists, its exports, callers, dependencies
and the next runtime step. Only implemented files appear here. Some implemented libraries
have test callers but no product caller; those gaps are explicitly identified.
[LEARNING](LEARNING.md) explains concepts; [ARCHITECTURE](../ARCHITECTURE.md) owns boundaries.
Flows show control/data movement, not every function call. Test/CLI flows are labeled.

## Public UI and runtime

| File | Purpose | Important exports | Called by | Dependencies | Flow |
|---|---|---|---|---|---|
| [next.config.ts](../next.config.ts) | Configure the Node-compatible Next build. | default Next config | Next dev/build/start | Next.js | Next reads config → prerenders public pages and builds dynamic auth routes. |
| [scripts/preview.mjs](../scripts/preview.mjs) | Launch a loopback production preview. | None; CLI entry | npm preview; Playwright webServer | Node child process; Next start | Spawn Next start → forward shutdown → exit with child status. |
| [src/app/layout.tsx](../src/app/layout.tsx) | Provide the root document and theme context. | default RootLayout; metadata | Next App Router | ThemeProvider; globals.css | Wrap page content in theme context → render root document. |
| [src/app/page.tsx](../src/app/page.tsx) | Introduce the workspace with authored public note content. | default Home | Next / route | Logo; ThemeSelect; Lucide icons; semantic CSS | Prerender public content → temporary theme control or workspace/showcase navigation; no auth/SQL call. |
| [src/app/dev/design-system/page.tsx](../src/app/dev/design-system/page.tsx) | Expose the implemented showcase route. | default DesignSystemPage | Next /dev/design-system/ route | showcase.tsx; showcase.css | Route renders Showcase → client interactions use sample state. |
| [src/app/dev/design-system/showcase.tsx](../src/app/dev/design-system/showcase.tsx) | Demonstrate shared controls and product patterns. | Showcase | Design-system page | UI/product components; React state | Sample values → component props → callbacks update page-lifetime state. |
| [src/app/globals.css](../src/app/globals.css) | Load shared application styles. | None; stylesheet | Root layout | Design-system styles | CSS imports → browser cascade styles page/components. |
| [src/design-system/tokens.css](../src/design-system/tokens.css) | Define semantic theme values. | CSS custom properties | Shared styles through globals.css | CSS theme/media selectors | Theme attribute or OS preference → semantic values → component appearance. |
| [src/design-system/components.css](../src/design-system/components.css) | Style shared component interaction states. | CSS classes | Shared styles through globals.css | Semantic tokens | Classes/state selectors → browser renders themed controls. |
| [src/components/ui/index.ts](../src/components/ui/index.ts) | Expose the shared UI import surface. | Re-exported controls/overlays/theme/Logo | Homepage/showcase/workspace and UI consumers | primitives.tsx; overlays.tsx; theme.tsx; brand.tsx | Consumer import → implemented component → render. |
| [src/components/ui/primitives.tsx](../src/components/ui/primitives.tsx) | Provide reusable controlled basic controls. | Button; IconButton; TextField; Card; Alert; Tone | Pages/showcase; overlays; product patterns | React; lucide-react; semantic CSS | Props → accessible element → callback returns interaction to parent. |
| [src/components/ui/overlays.tsx](../src/components/ui/overlays.tsx) | Wrap accessible overlay and navigation primitives. | Dialog; Tabs; Menu; Tooltip; Toast | Showcase through UI exports | Radix; UI primitives; React | Parent props → Radix focus/keyboard behavior → callback to parent. |
| [src/components/ui/theme.tsx](../src/components/ui/theme.tsx) | Project temporary theme preference into the document. | ThemeProvider; ThemeSelect; ThemePreference | Layout; homepage/workspace/showcase | React context/state; Select | Selection → context state → document theme attribute → CSS. |
| [src/components/ui/brand.tsx](../src/components/ui/brand.tsx) | Render shared branding. | Logo | Homepage/showcase through UI exports | Public brand SVG assets | Component props → logo asset/markup → browser render. |
| [src/components/mindmora/index.tsx](../src/components/mindmora/index.tsx) | Present controlled knowledge-workspace patterns. | NoteRow; TaskRow; SaveStatus; SyncStatus; CanvasCard; PropertyRow | Showcase; notes workspace | UI primitives; lucide-react; React | Controlled props → presentation → callbacks; badges perform no persistence. |

```text
Browser -> Next page + layout.tsx
                      |
              ThemeProvider + CSS
                      |
            showcase.tsx (sample state)
                      |
           UI controls / product patterns
                      |
             callback -> sample state
```

There is no durable browser knowledge storage or real save action in the showcase.

## Startup connectivity

| File | Purpose | Important exports | Called by | Dependencies | Flow |
|---|---|---|---|---|---|
| [src/instrumentation.ts](../src/instrumentation.ts) | Connect Node startup to dependency health. | register | Next instrumentation lifecycle | startup/health.ts | Skip build/Edge → await health → production rejection exits process. |
| [src/server/startup/health.ts](../src/server/startup/health.ts) | Run and report probes once per process. | registerStartupHealth; StartupDependencies | instrumentation.ts; unit tests | probes.ts; Node styleText | Global promise → parallel probes → safe colored/plain logs → continue or reject. |
| [src/server/startup/probes.ts](../src/server/startup/probes.ts) | Check service connectivity with bounded dedicated clients. | probeRedis; probePostgreSQL; safeProbeMessage | health.ts; protocol/config tests | server/config.ts; db/config.ts; Redis/postgres clients | Validate config → PING/SELECT 1 → close clients → safe outcome to health.ts. |

```text
Next.js starts/restarts
          |
   instrumentation.ts
          |
      health.ts (once)
          |
       probes.ts
     /           \
Redis PING    PostgreSQL SELECT 1
     \           /
      close probe clients
          |
      health.ts -> safe terminal logs
          |
   success / dev warning: continue
   production failure: exit 1
```

No request handler calls startup probes. Connectivity does not verify schema/RLS/EVAL ACLs or later availability. [Exact behavior](integrations/backend-services.md#server-startup-health--implemented-follow-up-to-1d).

## Backend auth and browser projection

| File | Purpose | Important exports | Called by | Dependencies | Flow |
|---|---|---|---|---|---|
| [src/server/config.ts](../src/server/config.ts) | Validate selected server settings lazily. | getServerConfig; getAuthConfig; getRateLimitConfig; AuthConfig; RateLimitConfig | Auth handler; DB identity context; Redis client; startup probes | Zod; server-only | Selected environment → checked config or fixed error → caller; no DB loader. |
| [src/app/api/auth/start/route.ts](../src/app/api/auth/start/route.ts) | Adapt sign-in-start requests to backend policy. | HTTP handlers; runtime; dynamic | Next HTTP /api/auth/start | auth/routes.ts | Request → handleAuth(start) → pending cookie and provider redirect, or safe rejection. |
| [src/app/api/auth/callback/route.ts](../src/app/api/auth/callback/route.ts) | Adapt provider callbacks to backend policy. | HTTP handlers; runtime; dynamic | Next HTTP /api/auth/callback | auth/routes.ts | Callback → handleAuth(callback) → verified session cookie and redirect, or rejection. |
| [src/app/api/auth/session/route.ts](../src/app/api/auth/session/route.ts) | Expose verified browser-safe session data. | HTTP handlers; runtime; dynamic | Next HTTP /api/auth/session; readSession helper/tests | auth/routes.ts | Request → handleAuth(session) → safe projection and refreshed cookie if needed. |
| [src/app/api/auth/logout/route.ts](../src/app/api/auth/logout/route.ts) | Adapt logout requests to backend policy. | HTTP handlers; runtime; dynamic | Next HTTP /api/auth/logout; logout helper/tests | auth/routes.ts | Request → handleAuth(logout) → provider revocation/cookie clearing or rejection. |
| [src/server/auth/routes.ts](../src/server/auth/routes.ts) | Own HTTP, cookie and redirect policy for auth actions. | handleAuth; AuthAction | Four route adapters; tests | Config; HTTP guards/responses; limiter; logger; provider; session | Bound/check request → admission → provider/session action → response/cookies → safe metadata log. |
| [src/server/auth/provider.ts](../src/server/auth/provider.ts) | Isolate Supabase SDK protocol and transient state. | createAuthProvider; AuthFailure; tokenSchema; AuthTokens | Auth handler; DB identity context; session helpers | Supabase AuthClient; account projection schema; Zod | Start/exchange/verify/refresh/revoke → Supabase Auth → checked result or safe failure; dispose afterward. |
| [src/server/auth/session.ts](../src/server/auth/session.ts) | Validate cookie/state input and manage verified sessions. | pendingSchema; cookieName; readCookie; decodeCookie; writeCookie; clearSession; matchesState; verifySession | Auth handler; DB identity context | Provider; Zod; Node crypto; NextResponse | Untrusted cookie/state → validation/online verification → tokens/projection; cookie writer updates response. |
| [src/features/account/types.ts](../src/features/account/types.ts) | Define browser-safe session projection. | sessionProjectionSchema; SessionProjection | Provider; browser API helpers; tests | Zod | Provider fields or response JSON → schema → safe identity projection. |
| [src/features/account/api.ts](../src/features/account/api.ts) | Fetch session state and request logout without storing tokens. | readSession; logout | WorkspaceShell; unit tests | Browser fetch; account/types.ts; auth endpoints | Credentialed request → route → validated projection/null or fixed error; logout waits for success. |

```text
Browser POST -> start/route.ts -> auth/routes.ts
                   |
         guards -> limiter.ts -> Redis
                   |
        provider.ts -> Supabase Auth -> Google
                   |
Browser callback -> callback/route.ts -> auth/routes.ts
                   |
        auth/routes.ts + session.ts: pending state checks
                   |
        admission -> provider.ts: PKCE exchange + verify
                   |
        session.ts: protected session cookie
                   |
        no-store redirect -> Browser

Session GET / logout POST -> route -> same guards/admission
     -> session.ts + provider.ts -> projection / revoke + cookie update
```

Auth never creates profiles or saves notes. WorkspaceShell calls account helpers for session verification/logout. [Auth guide](integrations/supabase-auth.md) owns exact ordering and failure behavior.

## HTTP, admission and safe logging

| File | Purpose | Important exports | Called by | Dependencies | Flow |
|---|---|---|---|---|---|
| [src/server/http/errors.ts](../src/server/http/errors.ts) | Represent fixed public HTTP failures safely. | HttpFailure; ErrorCode; safeFailure | HTTP guards; limiter; auth/note handlers; service; responses | Static error definitions | Known failure or unknown exception → safe code/status/message → responses.ts. |
| [src/server/http/responses.ts](../src/server/http/responses.ts) | Build private responses with safe error metadata. | privateResponse; errorResponse; responseErrorCode | Auth/note handlers; HTTP tests | errors.ts; NextResponse; response-local WeakMap | Safe failure → no-store JSON/Retry-After/request ID → browser; code metadata → logger. |
| [src/server/http/csrf.ts](../src/server/http/csrf.ts) | Check request Origin against the configured application origin. | assertOrigin | Auth/note handlers; HTTP tests | HttpFailure | Request Origin → accept or throw → handler/provider gate. |
| [src/server/http/body.ts](../src/server/http/body.ts) | Bound request sizes/time and validate JSON input. | assertRequestBounds; readBoundedBody; readJson | Auth handler uses bounds/body; note handler uses JSON helper; unit tests | HttpFailure; Zod; request streams | Headers/URL/body → bounded read → optional JSON/schema parse → caller or safe failure. |
| [src/server/rate-limit/limiter.ts](../src/server/rate-limit/limiter.ts) | Apply scoped admission budgets and explicit outage policy. | createLimiter; limiter; publicIdentity; authBudgets | Auth handler; note handler uses basic; tests; expensive has no product caller | client.ts; verified-owner assertion; HttpFailure; Node crypto/net | Trusted/shared identity → hashed scoped key → counter → admit/429/503; basic helper can degrade locally. |
| [src/server/rate-limit/client.ts](../src/server/rate-limit/client.ts) | Provide lazy bounded atomic Redis counters. | Counter; createRedisCounter; redisCounter | limiter.ts; real counter tests | getRateLimitConfig; node-redis; Lua | Key/window → connect if needed → EVAL count/TTL → limiter; timeout destroys unsafe connection. |
| [src/server/logging/logger.ts](../src/server/logging/logger.ts) | Restrict structured request logs to validated metadata. | createRequestLogger; logRequest | Auth/note handlers; logger tests | Pino; Zod | Operation/status/duration/safe code/UUID → allowlist validation → structured log; no raw request/error. |

```text
auth/routes.ts receives request
          |
  bounds / Origin / body / callback state
          |
      limiter.ts
          |
      client.ts -> Redis count + TTL
          |
   admitted -> auth provider/session work
   rejected -> errors.ts -> responses.ts
          |
     private response -> Browser
          |
     logger.ts -> safe Pino metadata
```

Public auth fails closed on Redis outage. The implemented basic fallback requires an issued verified owner and is used by the note handler, which advertises degraded admission. [Services](integrations/backend-services.md) and [ADR-022](decisions/ADR-022-http-admission-and-safe-logging.md) own policy details.

## Note contracts and scoped database boundary

| File | Purpose | Important exports | Called by | Dependencies | Flow |
|---|---|---|---|---|---|
| [src/features/notes/validation.ts](../src/features/notes/validation.ts) | Define strict bounded note mutation/list inputs. | createNoteSchema; updateNoteSchema; deleteNoteSchema; listNotesSchema; noteCursorSchema | Note handler; notes/types.ts; validation tests | Zod; byte/revision limits | Candidate input → schema check → typed input or rejection; not a save operation. |
| [src/features/notes/types.ts](../src/features/notes/types.ts) | Define validated note/profile projections and shared types. | noteSchema; noteSummarySchema; notePageSchema; profileSchema; Note; NoteSummary; NotePage; Profile; input types | Note service/repository/handler; tests | Zod; notes/validation.ts | Row/input data → validated note/page projections → HTTP response. |
| [src/server/db/schema.ts](../src/server/db/schema.ts) | Describe implemented PostgreSQL tables and constraints. | profiles; notes | Note repository; DB client; Drizzle generator; integration tests | Drizzle pg-core; Auth table definition | Schema → typed query construction or migration generation → PostgreSQL structure. |
| [src/server/db/config.ts](../src/server/db/config.ts) | Separate checked runtime and privileged database settings. | getDatabaseConfig; getMigrationConfig; DatabaseConfig | DB client; CLI common module; startup probe; tests | Zod; Node fs; optional CA file | Selected URL/role/pool/CA → checked TLS config → dedicated client or pool. |
| [src/server/db/user-context.ts](../src/server/db/user-context.ts) | Issue and recognize actual verified owner objects. | verifyDatabaseSession; assertVerifiedOwner; VerifiedOwner | Note handler; integration tests; DB client/limiter assertions | Auth config; provider; session; WeakSet | Request cookie → verify/refresh identity → issued owner → dispose provider → SQL/fallback permission check. |
| [src/server/db/client.ts](../src/server/db/client.ts) | Scope SQL transactions to checked roles and verified ownership. | createDatabase; getDatabase; DatabaseFailure; returned run/close | Note repository uses singleton; integration tests use factory | DB config/schema/context; postgres-js; Drizzle | Issued owner → BEGIN/check role → LOCAL role/claims → callback query → commit/rollback → caller. |
| [drizzle.config.ts](../drizzle.config.ts) | Configure reviewed schema generation. | Default Drizzle config | npm db:generate / Drizzle Kit | db/schema.ts; supabase/migrations | Schema diff → generated migration/meta for review; does not apply SQL. |
| [supabase/migrations/0000_profiles_notes.sql](../supabase/migrations/0000_profiles_notes.sql) | Create profiles/notes and owner-enforced SQL policies. | None; versioned SQL migration | Drizzle migrator through CLI/test harness | PostgreSQL; Supabase auth schema/functions | Reviewed migration → tables/checks/grants/FORCE RLS → later scoped queries. |
| [supabase/migrations/meta/_journal.json](../supabase/migrations/meta/_journal.json) | Track generated migration order. | None; migration metadata | Drizzle generator/migrator | Versioned migration files | Journal ordering → migrator selects unapplied SQL. |
| [supabase/migrations/meta/0000_snapshot.json](../supabase/migrations/meta/0000_snapshot.json) | Record generated schema state for later diffs. | None; schema metadata | Drizzle Kit | Generated schema snapshot | Previous snapshot + current schema → next reviewed diff; no request runtime. |

```text
Implemented SQL boundary (called by note repository and tests):
Request fixture -> user-context.ts -> session.ts / provider.ts
                                   -> Supabase Auth or test transport
          |
      issued owner
          |
      client.ts <- config.ts + schema.ts
          |
  BEGIN -> checked role + LOCAL claims -> callback queries
          |
 PostgreSQL constraints + owner RLS
          |
  COMMIT / ROLLBACK -> result / safe DatabaseFailure

Note contract path:
Candidate note input -> validation.ts -> handler -> repository
Row -> service -> types.ts validation -> response
```

SELECT 1 startup probes do not enter this transaction path. Note repositories/CRUD are implemented; workspace callers now reach these APIs. [Database guide](integrations/supabase-database.md), [note model](features/note-model.md), [ADR-021](decisions/ADR-021-scoped-database-role.md).

## Authenticated note API

| File | Purpose | Important exports | Called by | Dependencies | Flow |
|---|---|---|---|---|---|
| [src/app/api/notes/route.ts](../src/app/api/notes/route.ts) | Adapt collection requests to note HTTP policy. | GET; POST; rejected-method adapters; runtime; dynamic | Next HTTP /api/notes | server/notes/routes.ts | Node request → handleNotes without id → list/create response. |
| [src/app/api/notes/[id]/route.ts](../src/app/api/notes/[id]/route.ts) | Adapt individual note requests with awaited dynamic params. | GET; PATCH; DELETE; rejected-method adapters; runtime; dynamic | Next HTTP /api/notes/{id} | server/notes/routes.ts | Await id → handleNotes → detail/update/soft-delete response. |
| [src/server/notes/routes.ts](../src/server/notes/routes.ts) | Compose authenticated HTTP policy for note operations. | handleNotes; NotesDependencies | Two Next adapters; unit/integration tests | Config; owner verification; HTTP guards/responses; limiter; logger; validation; service/repository | Bounds/Origin → verify → admit → parse → service → no-store/cookie/error/log response. |
| [src/server/notes/service.ts](../src/server/notes/service.ts) | Validate public projections and translate committed business outcomes. | createNoteService; normalizeNote; resolveNote; profileName | handleNotes | Repository; note/profile/page schemas; HttpFailure | Repository result after commit → safe outcome/date projection → validated response or fixed error. |
| [src/server/notes/repository.ts](../src/server/notes/repository.ts) | Persist owner-scoped notes with atomic revision/key rules. | createNoteRepository; NoteRepository; NoteDatabase; NoteRow; NoteOutcome | Note service/handler; integration tests | DB client/schema; verified owner; Drizzle; Node crypto | Checked transaction → missing profile insert → owner/active/revision/key query → commit outcome to service. |
| [supabase/migrations/0001_note_create_idempotency.sql](../supabase/migrations/0001_note_create_idempotency.sql) | Add immutable creation metadata and owner/key uniqueness. | None; versioned SQL | Drizzle migrator via CLI/local fixtures | PostgreSQL; notes table | Apply nullable columns/check/partial index → concurrent creates share one row/key. |
| [supabase/migrations/meta/0001_snapshot.json](../supabase/migrations/meta/0001_snapshot.json) | Record schema after creation metadata changes. | None; migration metadata | Drizzle Kit (no product request caller) | db/schema.ts; previous snapshot/journal | Prior/current schema → reviewed future diff; not request runtime. |

```text
Client cookie + input
        |
notes/route.ts or notes/[id]/route.ts
        |
server/notes/routes.ts
        |
user-context.ts -> session.ts / provider.ts -> Supabase Auth
        |
limiter.ts -> Redis (or bounded degraded fallback)
        |
notes/validation.ts -> service.ts -> repository.ts
        |
client.ts -> checked LOCAL owner/role transaction
        |
PostgreSQL: profile insert + owner/active/revision query + RLS
        |
COMMIT -> repository outcome -> service projection
        |
routes.ts -> safe no-store JSON / protected refreshed cookie
        |
Client       logger.ts -> safe Pino metadata
```

The protected workspace calls these endpoints through the lease-checked notes API adapter. Auth refresh/Redis/HTTP delivery do not share
PostgreSQL's transaction. [API behavior](features/notes-api.md) · [Learning summary](LEARNING.md#milestone-1e-code-understanding-summary).

## Privileged CLI and credential recovery

| File | Purpose | Important exports | Called by | Dependencies | Flow |
|---|---|---|---|---|---|
| [scripts/database-common.mjs](../scripts/database-common.mjs) | Share privileged connection and versioned migration operations. | adminConnection; applyMigrations | Migration/provision/local database scripts | getMigrationConfig; postgres-js; Drizzle migrator | Checked privileged config → admin connection → apply versioned SQL → CLI caller. |
| [scripts/migrate-database.mjs](../scripts/migrate-database.mjs) | Apply reviewed SQL and close its connection. | None; npm db:migrate entry | Node CLI invoked by npm | database-common.mjs; Node env-file loading | Load environment → connect → migrate → status/exit → close. |
| [scripts/provision-database.mjs](../scripts/provision-database.mjs) | Coordinate first-time runtime-login credential setup. | None; npm db:provision entry | Node CLI invoked by npm | Crypto; common module; provision-role.ts; provision-files.ts | Validate setup → stage private file → transactionally create role → publish credentials or retain recovery state. |
| [scripts/provision-role.ts](../scripts/provision-role.ts) | Create constrained login and grant membership transactionally. | provisionRuntimeRole | Provision CLI; local DB test harness | postgres transaction; trusted generated DDL | Generated password → role/membership transaction → success or rollback → coordinator. |
| [scripts/provision-files.ts](../scripts/provision-files.ts) | Stage and safely publish private local credentials. | stageCredentialFile; returned publish | Provision CLI; file tests | Node fs; original environment comparison | Private staging/fsync → compare original file → atomic publication; ambiguous state stays recoverable. |

```text
npm db:migrate -> migrate-database.mjs -> database-common.mjs
                                         |
                               reviewed migrations -> PostgreSQL

npm db:provision -> provision-database.mjs
                       |
            provision-files.ts: private staging
                       |
            provision-role.ts: SQL transaction
                       |
            publish credentials / retain pending recovery
```

Privileged credentials are CLI-only. SQL commit and filesystem publication cannot be one atomic transaction; recovery is explicit. No automatic runtime migration or password rotation.

## Verification and contract entry points

| File | Purpose | Important exports | Called by | Dependencies | Flow |
|---|---|---|---|---|---|
| [src/server/notes/routes.test.ts](../src/server/notes/routes.test.ts) | Verify note guards, refresh and safe availability failures. | None; test suite | Unit Vitest config (test-only) | handleNotes; real SDK controlled transport; injected admission/SQL | Requests → production handler → status/cookie/safe output assertions. |
| [src/server/db/user-context.test.ts](../src/server/db/user-context.test.ts) | Verify provider cleanup after identity success/failure. | None; test suite | Unit Vitest config (test-only) | user-context; real provider fixture; disposal spy | Verify session → success/revoked result → assert dispose once. |
| [tests/integration/notes-api.test.ts](../tests/integration/notes-api.test.ts) | Verify actual SQL note isolation, races and reconciliation. | None; test suite | vitest.notes.config.ts (test-only) | Handler/repository/DB; real local PostgreSQL/Redis; controlled Supabase transport | Scoped HTTP requests → concurrent real transactions → response/row assertions → cleanup. |
| [vitest.notes.config.ts](../vitest.notes.config.ts) | Select actual-driver note integration tests. | Default Vitest config | test-database --notes (test-only) | notes-api.test.ts | Fixture config → Node suite → pass/fail. |
| [scripts/test-notes-api.mjs](../scripts/test-notes-api.mjs) | Coordinate disposable Redis and notes SQL verification. | None; CLI entry | npm test:notes; CI (test-only) | local-test-redis; test-database --notes | Start Redis → migrated PostgreSQL + three-connection suite → cleanup/exit. |
| [vitest.config.ts](../vitest.config.ts) | Select unit/component tests and environment setup. | Default Vitest config | npm test | React Vite plugin; tests/setup.ts | Vitest loads setup → src test suites → pass/fail. |
| [src/tests/setup.ts](../src/tests/setup.ts) | Install shared test matchers and cleanup. | None; test setup | Vitest config | Testing Library matchers/cleanup | Test worker setup → assertions/render cleanup for suites. |
| [src/tests/auth-provider-fixture.ts](../src/tests/auth-provider-fixture.ts) | Provide controlled Supabase protocol responses. | authProviderFixture | Auth/account/owner tests; auth browser harness | Fetch-compatible fixture transport | SDK request → disposable fixture response → production provider verification logic. |
| [src/server/auth/routes.test.ts](../src/server/auth/routes.test.ts) | Exercise auth cookies, redirects, failures and admission. | None; test suite | Unit Vitest config | Auth handler; provider fixture; controlled requests | Requests → actual handler/SDK → cookie/header/status assertions. |
| [src/server/auth/config.test.ts](../src/server/auth/config.test.ts) | Check Supabase auth configuration validation. | None; test suite | Unit Vitest config | getAuthConfig; environment fixtures | Valid/invalid auth inputs → checked settings or safe rejection. |
| [src/server/config.test.ts](../src/server/config.test.ts) | Check lazy selected-env validation and safe output. | None; test suite | Unit Vitest config | getServerConfig; environment fixtures | Candidate app origin → selected config → secret-exclusion assertions. |
| [src/features/account/api.test.ts](../src/features/account/api.test.ts) | Check safe browser projection and logout outcomes. | None; test suite | Unit Vitest config | Account helpers; controlled fetch responses | Response fixtures → browser helpers → projection/error assertions. |
| [src/features/notes/validation.test.ts](../src/features/notes/validation.test.ts) | Check note/domain input bounds and strict shapes. | None; test suite | Unit Vitest config | Note validation/types schemas | Boundary inputs → schemas → acceptance/rejection assertions. |
| [src/server/db/config.test.ts](../src/server/db/config.test.ts) | Check runtime/migration URL and role restrictions. | None; test suite | Unit Vitest config | DB config loaders | Environment fixtures → checked config/safe errors. |
| [src/server/db/provision-files.test.ts](../src/server/db/provision-files.test.ts) | Check private staging and interrupted-publication recovery. | None; test suite | Unit Vitest config | provision-files.ts; temporary filesystem | Stage/publish fixtures → permissions/recovery assertions → cleanup. |
| [src/server/http/http.test.ts](../src/server/http/http.test.ts) | Check body/Origin/errors and private response behavior. | None; test suite | Unit Vitest config | HTTP guards/responses; streams; Zod | Malformed/bounded requests → helpers → status/header/safe-output assertions. |
| [src/server/rate-limit/limiter.test.ts](../src/server/rate-limit/limiter.test.ts) | Check identity trust, budgets and outage policy. | None; test suite | Unit Vitest config | Limiter; owner/auth modules; counter/provider fixtures | Scoped identities/counter outcomes → admission → failure/fallback assertions. |
| [src/server/logging/logger.test.ts](../src/server/logging/logger.test.ts) | Check structured logs exclude private markers. | None; test suite | Unit Vitest config | Logger facade; captured destination | Allowed/invalid metadata → real Pino → structured-output assertions. |
| [src/components/ui/primitives.test.tsx](../src/components/ui/primitives.test.tsx) | Check rendered control behavior and accessibility semantics. | None; test suite | Unit Vitest config | UI primitives; Testing Library | Render controls → user/DOM interactions → accessibility/behavior assertions. |
| [scripts/test-server-boundary.mjs](../scripts/test-server-boundary.mjs) | Exercise real Next server/client import boundaries. | None; CLI entry | npm test:boundary; CI | Disposable Next fixture; child processes; HTTP | Compile guarded imports / serve Node test route → assertions → cleanup. |
| [scripts/test-database.mjs](../scripts/test-database.mjs) | Bootstrap disposable PostgreSQL roles and RLS tests. | None; CLI entry | npm test:db; CI | Docker; postgres; role helper; migrator; Vitest config | Container → migrations/roles → RLS suite → close/remove fixture. |
| [vitest.database.config.ts](../vitest.database.config.ts) | Select database integration test execution. | Default Vitest config | Local DB harness; npm test:db:hosted | tests/integration/rls.test.ts | Configured test URLs → RLS suite → assertions/fixture cleanup. |
| [tests/integration/rls.test.ts](../tests/integration/rls.test.ts) | Test actual role, ownership, constraint and pool behavior. | None; test suite | Database Vitest config | DB/auth modules; real PostgreSQL; provider fixture | Disposable identities/rows → scoped SQL → isolation/constraint assertions → cleanup. |
| [scripts/local-test-redis.mjs](../scripts/local-test-redis.mjs) | Provide disposable pinned loopback Valkey. | withTestRedis | Rate-limit/startup/auth/showcase runners | Docker; Redis client; random fixture ID | Start/check service → pass URL to runner → close/remove fixture. |
| [scripts/test-rate-limit.mjs](../scripts/test-rate-limit.mjs) | Run real Redis admission integration tests. | None; CLI entry | npm test:rate-limit; CI | withTestRedis; Vitest rate-limit config | Temporary Redis URL → Vitest protocol/admission tests → cleanup. |
| [vitest.rate-limit.config.ts](../vitest.rate-limit.config.ts) | Select Redis integration tests. | Default Vitest config | Rate-limit runner | tests/integration/rate-limit.test.ts | Fixture environment → selected test suite → pass/fail. |
| [tests/integration/rate-limit.test.ts](../tests/integration/rate-limit.test.ts) | Exercise actual Lua, expiry, HTTP throttling and outages. | None; test suite | Rate-limit Vitest config | Redis counter/limiter; auth handler; socket fixtures | Real counters and failing sockets → policy assertions → cleanup. |
| [scripts/local-test-postgres.mjs](../scripts/local-test-postgres.mjs) | Provide disposable PostgreSQL with a constrained login. | withTestPostgres | Startup/auth/showcase runners (test-only) | Docker; postgres; Drizzle migrator; generated credentials | Start/check DB → login → optional reviewed schema/Auth fixture → pass URL → close/remove. |
| [scripts/test-startup-health.mjs](../scripts/test-startup-health.mjs) | Exercise actual Next starts, restarts and failure policy. | None; CLI entry | npm test:startup; CI | Redis/PG fixtures; Next; startup Vitest config | Fixtures → real probes → production/dev processes → logs/HTTP/exit assertions → cleanup. |
| [vitest.startup.config.ts](../vitest.startup.config.ts) | Select real connectivity/deadline tests. | Default Vitest config | Startup runner | tests/integration/startup-probes.test.ts | Fixture URLs → protocol suite → pass/fail. |
| [tests/integration/startup-probes.test.ts](../tests/integration/startup-probes.test.ts) | Test actual PING/SELECT 1, authentication errors and deadlines. | None; test suite | Startup Vitest config | startup/probes.ts; real services; socket fixtures | Healthy/bad/stalled connections → probe result/deadline assertions → cleanup. |
| [src/server/startup/health.test.ts](../src/server/startup/health.test.ts) | Verify once, policy and terminal formatting behavior. | None; test suite | Unit Vitest config | health.ts; controlled probes/output/environment | Register coordinator → capture logs/call counts → assert outcomes and color. |
| [src/server/startup/probes.test.ts](../src/server/startup/probes.test.ts) | Verify safe rejection of invalid probe configuration. | None; test suite | Unit Vitest config | probes.ts | Invalid marker inputs → fixed safe rejection; no cloud service call. |
| [scripts/test-showcase-e2e.mjs](../scripts/test-showcase-e2e.mjs) | Supply healthy local services to showcase browser checks. | None; CLI entry | npm test:e2e; CI | withTestRedis; withTestPostgres; Playwright | Fixture URLs → Playwright config → fresh preview/browser checks → cleanup. |
| [playwright.config.ts](../playwright.config.ts) | Configure production showcase/runtime browser execution. | Default Playwright config | Showcase runner / Playwright CLI | preview.mjs; tests/e2e/design-system.spec.ts; runtime.spec.ts | Start fresh configured preview → Chromium requests/assertions → stop preview. |
| [scripts/test-auth-e2e.mjs](../scripts/test-auth-e2e.mjs) | Coordinate disposable provider/services and auth/workspace/contract browser checks. | None; CLI entry | npm test:auth; CI | Provider fixture; Redis/PG fixtures; Playwright auth config | Start provider/Redis + migrated PG fixture → browser auth/workspace/Swagger/collection flow → assertions → cleanup. |
| [playwright.auth.config.ts](../playwright.auth.config.ts) | Select production auth browser execution. | Default Playwright config | Auth browser runner | Next preview; tests/e2e/auth.spec.ts | Configured provider/service environment → fresh Next → auth browser suite. |
| [tests/e2e/auth.spec.ts](../tests/e2e/auth.spec.ts) | Exercise production cookie auth, note CRUD and throttling in a browser. | None; test suite | Auth Playwright config | Real Next; disposable provider; browser requests | Browser sign-in → actual note CRUD/CSRF/revisions → refresh/logout/throttle → cookie/status assertions. |
| [tests/e2e/design-system.spec.ts](../tests/e2e/design-system.spec.ts) | Exercise showcase accessibility, themes and responsive layout. | None; test suite | Showcase Playwright config | Real Next showcase; Chromium; axe | Browser interactions/viewports → rendered UI → accessibility/layout assertions. |
| [tests/e2e/runtime.spec.ts](../tests/e2e/runtime.spec.ts) | Check runtime 404 and browser credential exclusion. | None; test suite | Showcase Playwright config | Next public pages/static scripts; disposable markers | Browser/network reads → status/content assertions → private marker exclusion. |
| [scripts/check-styles.mjs](../scripts/check-styles.mjs) | Enforce the shared style contract. | None; CLI entry | npm lint; CI | Source/style files; Node fs | Inspect styles → reject raw colors/arbitrary rules or report success. |
| [.github/workflows/quality.yml](../.github/workflows/quality.yml) | Define automated runtime and UI checks. | None; workflow definition | GitHub Actions on push/pull_request | npm checks; Docker; Chromium | Install/audit → lint/types/tests → build/startup → browser checks. |
| [docs/api/openapi.json](../docs/api/openapi.json) | Describe implemented auth/note endpoints without credentials. | Auth/note paths/schemas; OpenAPI document | Contract readers; documentation checks | Auth/note routes and response contracts | Endpoint definitions → human/API tooling reference; no Swagger/Postman generator exists. |

```text
Unit: npm test -> vitest.config.ts -> src test suites

Integration: npm test:db / test:notes / test:rate-limit / test:startup
                  |
             disposable fixtures
                  |
          Vitest / actual Next processes
                  |
          assertions -> fixture cleanup

Browser: npm test:e2e / test:auth -> services/provider fixtures
                  |
             Playwright config
                  |
          fresh Next preview -> Chromium
                  |
          assertions -> fixture cleanup
```

Tests/configuration define checks, not proof that hosted CI or production passed. [Phase record](phases/phase-01-foundation.md) owns dated outcomes; [startup execution record](../.agent/active/startup-health.md) owns its exact evidence.

[Documentation index](README.md) maps document responsibilities. The [active Phase 2 plan](../.agent/active/phase-02-editor.md) owns current live progress; Phase 1 evidence stays historical. No proposed repositories, caches, workers or routes are listed as implemented files.

## Protected workspace and API tooling — Phase 1F–1H

| File | Purpose | Important exports | Called by | Dependencies | Flow |
|---|---|---|---|---|---|
| [src/app/workspace/page.tsx](../src/app/workspace/page.tsx) | Compose the protected browser workspace with URL adaptation. | default WorkspacePage | Next `/workspace/` route | async headers; local KaTeX CSS; Suspense; NuqsAdapter; WorkspaceShell | Dynamic nonce-only shell → browser session check → private workspace; no server note fetch. |
| [src/components/workspace/WorkspaceShell.tsx](../src/components/workspace/WorkspaceShell.tsx) | Own verified identity leases and private cache lifetime. | WorkspaceShell | WorkspacePage; component tests | account API; QueryClient; NotesWorkspace; UI store; URL selection; Logo/ThemeSelect; nonce prop | Verify session → issue lease → mount workspace; logout/switch → abort/clear/unmount. |
| [src/features/account/components/SignInGate.tsx](../src/features/account/components/SignInGate.tsx) | Explain server storage and start native Google navigation. | SignInGate | WorkspaceShell | Shared Card/Button | User submits same-origin POST → auth start → Google callback → homepage. |
| [src/lib/api/client.ts](../src/lib/api/client.ts) | Validate fetched responses and project fixed public errors. | apiRequest; ApiError | notes API | fetch; Zod | no-store same-origin fetch → schema validation → result or safe typed error. |
| [src/features/notes/api.ts](../src/features/notes/api.ts) | Apply session leases and ownership to browser note operations. | createNotesApi; NoteScope; NotesApi | NotesWorkspace; API tests | API client; note schemas; AbortSignal | Verify active identity → request → reject expired lease/wrong owner → validated note. |
| [src/features/notes/hooks.ts](../src/features/notes/hooks.ts) | Fetch paginated list/detail into scoped memory query keys. | noteKeys; useNotes; useNote | NotesWorkspace | TanStack Query; NotesApi | owner/generation key → cancellable request → memory data; no write replay. |
| [src/features/notes/use-note-selection.ts](../src/features/notes/use-note-selection.ts) | Validate a note ID stored in the URL. | useNoteSelection | WorkspaceShell; NotesWorkspace | nuqs; Zod | `?note=` → UUID validation → selection or safe invalid state. |
| [src/stores/ui-store.ts](../src/stores/ui-store.ts) | Own transient sidebar visibility only. | useUiStore | WorkspaceShell; NotesWorkspace | Zustand create without persist | Toggle/reset → presentation; no note/session authority. |
| [src/features/notes/components/NotesWorkspace.tsx](../src/features/notes/components/NotesWorkspace.tsx) | Coordinate queries, stable editor identity, draft guards and committed cache updates. | NotesWorkspace | WorkspaceShell | note hooks/API; NoteList; NoteEditor; UI/URL state | Query snapshot → stable draft lease → acknowledged record cache; bind first ID without remount → invalidate list. |
| [src/features/notes/components/NoteList.tsx](../src/features/notes/components/NoteList.tsx) | Present bounded authorized summaries and accessible selection. | NoteList | NotesWorkspace | NoteSummary; shared Button/Icon/EmptyState; Lucide FileText | Summary data → selected button → guarded URL selection. |
| [src/features/notes/components/NoteEditor.tsx](../src/features/notes/components/NoteEditor.tsx) | Compose autosave, source, preview and deliberate recovery. | NoteEditor | NotesWorkspace; component tests | useNoteAutosave; CodeMirrorEditor; EditorToolbar; lazy MarkdownPreview; PreviewBoundary; shared controls/status | Draft typing → coordinator/derived preview → saved or paused/conflict UI; cache callbacks receive acknowledgements. |
| [src/app/dev/api-docs/page.tsx](../src/app/dev/api-docs/page.tsx) | Gate interactive API documentation by environment. | default ApiDocsPage; dynamic; runtime | Next `/dev/api-docs/` | notFound; docsEnabled; ApiDocs | Development/operator opt-in → console; default production →404. |
| [src/app/dev/api-docs/policy.ts](../src/app/dev/api-docs/policy.ts) | Constrain console exposure and outgoing API requests. | docsEnabled; sameOriginRequest; DocsRequest | API docs page/Swagger; policy tests | URL parsing | Reject foreign origin/non-API/OAuth redirect endpoint → same-origin cookie request. |
| [src/app/dev/api-docs/swagger.tsx](../src/app/dev/api-docs/swagger.tsx) | Lazy-load the interactive generated API console. | default ApiDocs | API docs page | Swagger UI; generated OpenAPI; console policy | Client-only console → no remote validator/auth persistence → guarded API. |
| [scripts/generate-api-docs.mjs](../scripts/generate-api-docs.mjs) | Generate contracts and fail on route/output drift. | validateContract; generateDocuments | api:generate/api:check; contract tests | shared Zod schemas; operation metadata; source route inventory | Read schemas/metadata/routes → OpenAPI/Postman → write or compare. |
| [docs/api/operation-metadata.json](api/operation-metadata.json) | Own reviewed HTTP semantics not derivable from shapes. | None; metadata | contract generator | Existing auth/note route policy | Reviewed methods/statuses/headers → generated contract. |
| [docs/api/openapi.json](api/openapi.json) | Publish the generated auth/note API contract. | None; contract | Swagger; collection executor; reviewers | generator output | Inspect schemas/operations → execute same guarded APIs. |
| [docs/api/mindmora.postman_collection.json](api/mindmora.postman_collection.json) | Provide credential-free executable API requests. | None; collection | Postman; collection smoke | generator output; placeholder variables | Local origin/IDs/revision placeholders → guarded API requests. |
| [scripts/test-api-contract.mjs](../scripts/test-api-contract.mjs) | Check negative drift and collection semantics. | None; test CLI | test:contract; CI | generator; collection executor; assertions | Mutate contract fixtures → demand rejection → check shared generated output. |
| [scripts/test-api-collection.mjs](../scripts/test-api-collection.mjs) | Execute generated requests against a disposable local runtime. | runCollectionSmoke | CLI; contracts browser tests; unit adapter | generated contracts/collection; fetch-compatible adapter | Run guards or authenticated create/read/update/delete using returned IDs/revisions. |
| [scripts/test-api-collection.d.mts](../scripts/test-api-collection.d.mts) | Type the JavaScript collection runner for tests. | CollectionRequestOptions; CollectionResponse; runCollectionSmoke signature | TypeScript E2E compiler only | Corresponding runner | Compile adapter types; no product runtime caller. |
| [src/components/workspace/WorkspaceShell.test.tsx](../src/components/workspace/WorkspaceShell.test.tsx) | Test identity, deep links and draft/cache lifetime. | None; tests | Vitest only | shell; Testing Library; nuqs testing adapter | Controlled session transitions → assert isolation/retained draft. |
| [src/features/notes/components/NoteEditor.test.tsx](../src/features/notes/components/NoteEditor.test.tsx) | Test editor composition, acknowledgement and preserved drafts. | None; tests | Vitest only | editor; typed API fixtures; Testing Library; CodeMirror | Edit/save/refetch/preview failure → verify retained draft and deliberate recovery. |
| [src/features/notes/api.test.ts](../src/features/notes/api.test.ts) | Test owner/lease/response contract boundaries. | None; tests | Vitest only | browser notes API; fetch fixtures | Foreign/wrong/late response → reject; deletion → validate acknowledgement. |
| [src/app/dev/api-docs/policy.test.ts](../src/app/dev/api-docs/policy.test.ts) | Test console opt-in and outgoing origin constraints. | None; tests | Vitest only | console policy | Unsafe endpoint/origin → reject; allowed API → same-origin. |
| [tests/e2e/foundation.spec.ts](../tests/e2e/foundation.spec.ts) | Exercise protected notes in the real browser and SQL runtime. | None; tests | auth browser harness only | Playwright; Axe; disposable Auth/DB/Redis | Sign in → CRUD/conflict/offline/response loss/owner/logout → UI and API assertions. |
| [tests/e2e/contracts.spec.ts](../tests/e2e/contracts.spec.ts) | Exercise Swagger and generated collection through real routes. | None; tests | auth browser harness only | Playwright; collection runner | Opt-in console/collection → same guarded HTTP → verify statuses/no remote requests. |

```text
WorkspacePage -> WorkspaceShell -> verified owner/generation
  -> NotesWorkspace -> query list/detail -> createNotesApi -> HTTP -> PostgreSQL
  -> NoteEditor -> autosave snapshot -> committed acknowledgement -> cache refresh
                  -> CodeMirror draft -> bounded sanitized preview
Logout/switch -> abort lease + queries -> clear memory -> unmount editor

Zod + operation metadata + real routes -> generator -> OpenAPI + Postman
  -> drift/collection tests + opt-in Swagger -> guarded HTTP routes
```


## Editor source, autosave and safe preview — Phase 2

Implementation exists; complete acceptance remains in the [active plan](../.agent/active/phase-02-editor.md).
Each row keeps six fields separate; test callers are identified rather than treated as product flow.

| File | Purpose | Important exports | Called by | Dependencies | Flow |
|---|---|---|---|---|---|
| [src/features/editor/save-machine.ts](../src/features/editor/save-machine.ts) | Separate live draft sequence from acknowledged server base. | EditorDraft; SavePhase; SaveOperation; SaveMachine; initialMachine; editMachine; acknowledge; sameDraft | useNoteAutosave; pure tests | Note type | Initialize base → local edit sequence → snapshot acknowledgement advances base and preserves newer typing. |
| [src/features/editor/use-note-autosave.ts](../src/features/editor/use-note-autosave.ts) | Coordinate bounded serialized writes, recovery and delete for one draft lease. | AutosaveOptions; useNoteAutosave | NoteEditor; hook tests | save-machine; NotesApi; shared createNoteSchema; ApiError; React refs/effects; monotonic clock | Edit → debounce/spacing → frozen operation → API acknowledgement/reconciliation → current draft/save phase and callbacks. |
| [src/features/editor/components/CodeMirrorEditor.tsx](../src/features/editor/components/CodeMirrorEditor.tsx) | Own source view, selection/history and Markdown transactions. | CodeMirrorEditor; EditorHandle; FormatAction | NoteEditor; EditorToolbar type imports; source tests | CodeMirror state/view/commands/Markdown/language; Lezer tags; React refs | Mount nonce-labelled view → edits/IME/save callback → controller; formatting/adoption transactions → same view; unmount destroys. |
| [src/features/editor/components/EditorToolbar.tsx](../src/features/editor/components/EditorToolbar.tsx) | Present source-formatting and Edit/Preview/Split actions. | EditorToolbar; EditorMode | NoteEditor | shared Button; EditorHandle/FormatAction types | Native control → editor transaction/focus or temporary mode; no persistence call. |
| [src/features/editor/components/PreviewBoundary.tsx](../src/features/editor/components/PreviewBoundary.tsx) | Isolate preview chunk/render failures from editable source and autosave. | PreviewBoundary | NoteEditor; boundary tests | React Component | Preview error → fixed fallback while source/controller stay mounted; mode unmount/reopen retries. |
| [src/features/editor/markdown.ts](../src/features/editor/markdown.ts) | Bound parse work and sanitize untrusted Markdown structure/URLs. | PREVIEW_BYTES; PreviewResult; parseMarkdown; safeMarkdownUrl | MarkdownPreview; parser tests | unified; remark parse/GFM/math/rehype; rehype-sanitize; HAST types | UTF-8/delimiter/line admission → bounded AST → sanitized HAST; URL checks → permitted navigation or inert text. |
| [src/features/editor/components/MarkdownPreview.tsx](../src/features/editor/components/MarkdownPreview.tsx) | Derive controlled rich output from the current draft generation. | MarkdownPreview | lazy NoteEditor preview; preview tests | markdown parser/URL policy; hast-util-to-jsx-runtime; React JSX runtime; MathBlock; MermaidBlock | Debounce → sanitized tree → semantic React/URL/image/task adapters → bounded lazy rich blocks; source change retires output. |
| [src/features/editor/components/MathBlock.tsx](../src/features/editor/components/MathBlock.tsx) | Render bounded local trusted math with safe fallback. | MathBlock | MarkdownPreview; math tests | lazy KaTeX; React lifecycle; locally imported workspace CSS/fonts | Expression cap → trust-disabled generated HTML/MathML → audited HTML sink or escaped source; stale completion discarded. |
| [src/features/editor/components/MermaidBlock.tsx](../src/features/editor/components/MermaidBlock.tsx) | Admit explicit fixed-config diagram work and isolate its SVG. | MermaidBlock | MarkdownPreview; diagram tests | lazy Mermaid; SVG helper; React ID/generation refs; serialized render queue | Render action → input/attempt admission → nonce measurement subtree → sanitized SVG/srcDoc → empty-permissions sandbox; cleanup/late-result rejection. |
| [src/features/editor/svg.ts](../src/features/editor/svg.ts) | Restrict diagram input, generated SVG and connected measurement styling. | allowedDiagram; sanitizeDiagramSvg; diagramDocument; createDiagramContainer | MermaidBlock; SVG tests | DOMPurify SVG profile; DOMParser/XMLSerializer; local DOM insertion hooks | Reject config/resource input → nonce generated style insertion → omit measurement styles before internal serialization reparse → strip SVG capabilities/preserve local markers → fixed restrictive frame document. |
| [src/server/http/content-security-policy.ts](../src/server/http/content-security-policy.ts) | Build workspace nonce resource/execution policy without granting API authority. | workspacePolicy | Proxy; policy tests | Trusted nonce/environment/optional configured OAuth origin; URL | Production nonce/strict-dynamic script and style rules → header policy; development-only eval; explicit OAuth form redirect origins. |
| [src/proxy.ts](../src/proxy.ts) | Issue fresh workspace nonce and no-store/CSP/referrer headers. | proxy; config | Next workspace request matching | Node randomBytes; NextResponse; workspacePolicy; configured Supabase origin | Workspace request → overwrite nonce/CSP input → request policy for Next and response CSP/no-store → dynamic page nonce propagation. |
| [src/features/editor/save-machine.test.ts](../src/features/editor/save-machine.test.ts) | Assert newer typing survives an older save acknowledgement. | None; tests | Vitest only | pure save-machine; Note fixtures | Captured operation + later edits → assert base advancement/current draft retention. |
| [src/features/editor/use-note-autosave.test.tsx](../src/features/editor/use-note-autosave.test.tsx) | Exercise scheduler, racing snapshots and deliberate recovery. | None; tests | Vitest only | hook; fake clocks; deferred typed API fixtures; Testing Library | Edit/time/network outcome → assert single-flight, revision/key, retained typing, cooldown/IME/conflict/delete and cleanup. |
| [src/features/editor/components/CodeMirrorEditor.test.tsx](../src/features/editor/components/CodeMirrorEditor.test.tsx) | Assert source transactions and lifecycle against an actual view. | None; tests | Vitest only | CodeMirrorEditor; Testing Library; DOM layout shims | Mount/type/adopt/format/history → verify callbacks, selection/text and cleanup. |
| [src/features/editor/markdown.test.ts](../src/features/editor/markdown.test.ts) | Test real parse/sanitize, preparse admission and URL rejection. | None; tests | Vitest only | markdown parser; hostile and bounded fixtures | Source/URL → assert semantic inert tree or safe limit/rejection. |
| [src/features/editor/svg.test.ts](../src/features/editor/svg.test.ts) | Test real SVG sanitation, local arrows and scoped nonce insertion. | None; tests | Vitest only | SVG helper; DOMPurify; actual DOM | Hostile generated SVG/subtree insertions → assert removed capabilities, preserved safe markers and local nonce-only effects. |
| [src/features/editor/components/MarkdownPreview.test.tsx](../src/features/editor/components/MarkdownPreview.test.tsx) | Test controlled DOM, limits, generation replacement and real math. | None; tests | Vitest only | MarkdownPreview; Testing Library; fake clocks; real KaTeX | Draft → debounced semantic/inert DOM; replacement removes old generation; permitted local math output. |
| [src/features/editor/components/MathBlock.test.tsx](../src/features/editor/components/MathBlock.test.tsx) | Assert real KaTeX MathML/trust and expression bounds. | None; tests | Vitest only | MathBlock; real KaTeX; Testing Library | Hostile/capped expression → no active navigation/resources or safe source fallback. |
| [src/features/editor/components/MermaidBlock.test.tsx](../src/features/editor/components/MermaidBlock.test.tsx) | Assert admission and stale async measurement/output cleanup. | None; tests | Vitest only | MermaidBlock; deferred Mermaid fixture; real SVG helper/DOM | Render/config/limit/unmount → fixed fallback or immediate subtree removal; late result discarded. |
| [src/features/editor/components/PreviewBoundary.test.tsx](../src/features/editor/components/PreviewBoundary.test.tsx) | Verify preview errors preserve source/control state. | None; tests | Vitest only | PreviewBoundary; failing child fixture; Testing Library | Render failure → fixed fallback; sibling source survives. |
| [src/features/notes/components/NotesWorkspace.test.tsx](../src/features/notes/components/NotesWorkspace.test.tsx) | Assert stable create identity, scoped cache and guard integration. | None; tests | Vitest only | NotesWorkspace; QueryClient; typed API/query fixtures; nuqs test adapter | POST acknowledgement/newer draft → bind ID without remount or false guard cleanup. |
| [src/server/http/content-security-policy.test.ts](../src/server/http/content-security-policy.test.ts) | Check production/development policy and configured OAuth forms. | None; tests | Vitest only | workspacePolicy | Trusted config → assert nonce/resource rules and absence of production script eval. |
| [tests/e2e/editor.spec.ts](../tests/e2e/editor.spec.ts) | Exercise editor/autosave/rich-content behavior in the production browser harness. | None; tests | Existing auth browser harness only | Playwright; Axe; controlled provider; disposable SQL/Redis; production Next | Actual source/typing/recovery/preview/CSP requests → browser/network/DOM assertions; results remain dated evidence. |

```text
Workspace Proxy -> fresh CSP nonce -> dynamic WorkspacePage -> WorkspaceShell lease
  -> NotesWorkspace -> NoteEditor -> CodeMirror source + toolbar
                                    |
                             useNoteAutosave -> existing NotesApi
                                    |               |
                       snapshot/base/sequence       -> server -> SQL commit
                                    ^                         |
                                    +----- acknowledgement ---+
                                    |
                              dirty/cache callbacks

Current draft -> MarkdownPreview -> admission/parser -> sanitize -> controlled React
  -> bounded local MathBlock -> trusted KaTeX HTML/MathML
  -> explicit MermaidBlock -> nonce measurement -> sanitized SVG -> scriptless sandbox
Source change/logout -> retire render generation -> remove measurement/output
```
