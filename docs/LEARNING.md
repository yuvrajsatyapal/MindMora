# MindMora Learning Notes

**Status:** UI/runtime and 1B auth concepts below are implemented; live Google sign-in/session/logout and refresh/replay acceptance verified. Other backend concepts are 📋 planned examples. Updated 2026-10-04.

## Planned full-stack concepts

### Why PostgreSQL is authoritative

When a note is saved, the backend commits a scoped Drizzle transaction before returning success. Two devices read the same record. Unlike the superseded browser database, server access needs connectivity; an unsaved browser draft can be lost on refresh.

### TanStack Query cache versus database

Query holds fetched notes temporarily in browser memory and refetches/invalidate after API writes. It is not durable storage. User/session-scoped query keys and logout cancellation/cleanup prevent one account's cached notes appearing under another. Zustand controls UI; nuqs controls selected ID/view in the URL.

### Zod versus TypeScript

TypeScript helps while writing code. A browser request can still contain malformed JSON, wrong lengths or forged ownership fields; Zod checks runtime data. A valid schema does not mean the user owns the requested note: authorization is a separate backend check.

### Repository and RLS layers

The backend repository owns owner filters, revisions and transaction rules. RLS is another database protection, but privileged Drizzle connections can bypass policies. The real role/claim configuration must be tested with two users, including pooled connection reuse.

### Redis, BullMQ and workers

Redis stores expiring counters and reference jobs; BullMQ coordinates delivery/retries; a separate Node worker performs exports/indexing. A duplicate retry must not create duplicate side effects. An outbox/status record recovers work when the database commits but enqueue fails. Browser Web Workers are a different kind of worker for tab-local computation.

### Server encryption and browser memory

HTTPS protects transport; infrastructure encryption protects stored disks/files/backups. Authorized server/provider can still read notes. No vault passphrase/recovery key is involved. The browser needs readable temporary content to display/edit; XSS/device compromise remains a risk even without persistent browser storage.

### Logs and contracts

Pino creates safe operation/status/duration/correlation metadata, not note/body/token logs. OpenAPI describes endpoints; Swagger lets developers inspect/try them; Postman runs requests from the same generated contract. Tracked examples contain placeholders/disposable fixtures only.

### Nginx and hosting

Nginx can handle HTTPS and routing on our own server. A managed host may already perform ingress. Naming Redis/worker/Nginx libraries doesn't supply free server capacity; monitor actual quotas and choose hosting before deployment.

## Evidence to add during milestones

Record actual source file, concrete action/data flow, why this approach helps MindMora, one trade-off and verification. Don't label hypothetical failures as encountered bugs. No backend examples here imply implementation.

## Implemented design-system concepts

### Semantic tokens keep meaning stable

`src/design-system/tokens.css` maps `--accent` to teal on light surfaces and mint on dark ones. A button consumes `--accent` and `--on-accent`, so a feature does not choose its own color pair. CSS system preference works before React hydration; `ThemeSelect` later sets an explicit document attribute. The trade-off is a theme that resets on refresh until authenticated server preferences are implemented.

### Controlled patterns separate UI from persistence

`TaskRow` emits `onCheckedChange` and renders its `checked` prop. The showcase updates component state; a future feature hook must commit or preserve its draft according to repository behavior. `SaveStatus` cannot know whether a write succeeded, so its contract requires callers to pass saved only after a successful commit. Unit tests verify the callback and failure wording.

### Accessibility belongs to the shared contract

`TextField` connects its label and description using generated IDs. `Button` retains its name while busy and blocks duplicate clicks. Radix supplies dialog focus trapping, Escape and focus restoration. The benefit is consistent behavior across future screens; the cost is maintaining the wrapper contract and testing it whenever composition changes.

## Implemented runtime concepts — Milestone 1A

### A Node server can serve prerendered pages

`next.config.ts` no longer selects static export. `npm run build` creates `.next/`; `scripts/preview.mjs` runs Next's production server on loopback. Next still prerenders public HTML and React hydrates controls. This preserves fast public pages while allowing request-time Route Handlers later. It requires a running Node process instead of only a file host. There is still no knowledge API or database.

### Server-only is an import boundary

`src/server/config.ts` imports `server-only`, so Next rejects a Client Component that imports it, including through another module. `scripts/test-server-boundary.mjs` proves this with the actual Next compiler; the unit-test mock is only necessary to run pure validation outside Next's RSC compiler. This guard does not stop a developer from copying a secret into a server response/React prop; output still needs review and leakage tests.

### Lazy configuration and runtime validation

`getServerConfig()` selects only APP_ORIGIN, validates it with Zod, and returns a frozen normalized origin. Missing config throws a fixed message with no raw value or Zod cause. Import does not read env, so public pages work before backend setup. The disposable Node route proves an origin changed after build is read on the request. TypeScript cannot validate strings arriving from the process environment. Service-specific validators must be added with their consumers; 1A has no secret/service credential loader.

Zod validation is piped: URL parsing must succeed before URL-based refinements run. The initial implementation let invalid strings reach `new URL`; two tests exposed that unsafe exception path. The pipe now yields the intended fixed error. Loopback HTTP is a local test exception; it is not deployment TLS evidence.


## Implemented auth concepts — Milestone 1B

### PKCE ties the callback to its initiating browser

`provider.ts` asks the official SDK for an S256 challenge and carries its verifier storage in a short-lived protected pending cookie. The callback gets a one-use code plus random app state; `routes.ts` compares state/expiry and exchanges with the original verifier. A code from another browser cannot establish an app session. Supabase separately owns Google OAuth state. Callback redirects are fixed; accepting a user-supplied return URL would add an unnecessary redirect boundary.

### Identity is verified online, never read from cookie user data

`session.ts` validates only token/expiry shapes; `provider.verify` calls getUser against Auth before returning id/email/displayName. A locally parsed JWT or SDK getSession is not online verification. The expiry hint decides when to refresh, but provider verification decides whether access is allowed. This adds network latency and fails closed during provider outage. Note ownership/RLS remain separate 1C/1E controls.

### HttpOnly cookies require a server-owned lifecycle

Standard browser auth refresh needs JS-readable tokens. MindMora uses request-local server SDK storage and manually projects only app access/refresh credentials into an HttpOnly cookie; Google provider tokens are discarded. HTTPS __Host cookies disallow a Domain attribute and require Secure/Path=/. SameSite=Lax permits the Google top-level callback; exact Origin protects start/logout POSTs. HttpOnly blocks JS reads, but XSS could still issue authenticated requests.

### Refresh and logout are provider operations

A session near expiry refreshes on the server, verifies the new access token and rotates the cookie. Logout calls supported current-session (`scope=local`) revocation and clears cookies. A second device remains signed in. On remote failure, 503 means local cleanup happened but provider revocation was not confirmed. Online verification prevents a late refreshed cookie from authorizing an already-revoked session; UI late-response/cache cleanup arrives later.

### Tests distinguish application behavior from provider evidence

`routes.test.ts` uses the real auth SDK with a controlled provider transport. `test:auth` uses real Next HTTP and browser cookies with a disposable loopback provider. Neither proves real Google consent/redirect settings or Supabase refresh/revocation timing. The latest live settings check returned HTTP 200 with Google enabled; live start reached Google’s sign-in page. Google consent/callback/session now succeeded live; logout returned 204 and subsequent session check returned 401. Live Supabase refresh/reuse, concurrent refresh, revoked replay and independent-session logout checks subsequently passed (13/13); natural JWT expiry was not awaited. The fixture models independent sessions and controlled refresh-token reuse so global logout and stale response tests are meaningful.

A malformed non-ASCII state test exposed a byte-length exception in timingSafeEqual: equal JS string lengths need not mean equal byte lengths. State is now restricted to the generated base64url alphabet before constant-time comparison. A method-error test exposed missing Allow headers, now returned safely with no-store. Cookie size limits reject duplicate/corrupt/oversized input rather than guessing an identity.

### Contracts and user projection

`features/account/types.ts` is a strict shared Zod projection. Browser helpers validate successful JSON and never store tokens; server-only code is excluded from client imports. The initial auth OpenAPI schema is derived from that projection. Full Swagger/Postman generation/drift tooling is scheduled for 1H; no note contract exists yet.


### Reading workflow for the implemented auth boundary

Start with `features/account/types.ts` to see the only successful session shape the browser
receives. Next read the four `app/api/auth/*/route.ts` adapters and `server/auth/routes.ts`
for methods, Origin/query checks and redirects. Read `session.ts` for cookie limits/state/
expiry and `provider.ts` for actual Supabase calls. `server/config.ts` shows which env
values the runtime reads. Finally, read `routes.test.ts` for misuse/failure scenarios and
`tests/e2e/auth.spec.ts` for browser cookie behavior. `features/account/api.ts` validates
browser responses; it does not hold session authority.

Two redirects have different owners: Google returns to Supabase `/auth/v1/callback`,
then Supabase returns to MindMora `/api/auth/callback?state=...`. Google OAuth client
ID/secret are configured in Supabase's provider settings. The optional `.env` Google
placeholders are setup references only, whereas APP_ORIGIN/SUPABASE_URL/
SUPABASE_PUBLISHABLE_KEY are read by the server.

For current implementation/verification status read the active Phase 1 ExecPlan; for the
actual outcome record read `docs/phases/phase-01-foundation.md`. Future note/RLS/cache
examples remain planned. A successful redirect to Google proves the entry path only;
it cannot prove the return callback, committed app session, refresh or revocation.
