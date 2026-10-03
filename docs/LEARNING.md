# MindMora Learning Notes

**Status:** UI and runtime/config concepts below are implemented; other backend concepts are 📋 planned examples, not runtime evidence. Updated 2026-10-03.

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
