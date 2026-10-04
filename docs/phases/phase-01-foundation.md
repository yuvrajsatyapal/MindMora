# Phase 01 — Full-Stack Foundation Record

**Status:** ✅ UI/runtime and 1B auth code/local verification; ✅ live Google/session/refresh/replay acceptance verified; ✅ 1C minimal schema/database/RLS; 📋 note CRUD and later milestones. Updated 2026-10-04.

## Goal and scope

Preserve the shared design system; migrate to runtime Next.js; implement Google sign-in, verified backend session, scoped PostgreSQL/Drizzle CRUD, Zod/Pino/Redis admission limits, in-memory TanStack Query, Zustand/nuqs boundaries, API docs and security tests. Detailed work/progress lives in the [Phase 1 ExecPlan](../../.agent/active/phase-01-foundation.md); do not duplicate the checklist.

## Target data flow

Editor draft → API hook → authenticated validated backend → scoped Drizzle transaction → PostgreSQL commit → response/cache invalidation → saved feedback. Notes are server records, not encrypted vault envelopes. Files/jobs are Phase 4; initial CRUD makes no BullMQ call. No IndexedDB, Drive sync or E2EE foundation.

## Acceptance

Applicable SEC-01–08 in the [security contract](../architecture/security-architecture.md): auth/CSRF, actual owner/RLS isolation, validation, no private persistent browser cache, log/credential redaction, transport/rest evidence, rate limits and revision-safe writes. Session expiry/outage/conflicts are visible; failed/uncertain writes preserve draft without claiming saved. Runtime build/browser checks and API/DB integration pass. Production readiness requires deployment/provider evidence separately.

## Actual outcomes

A separate design-system milestone implemented static Next.js, strict TypeScript, Tailwind tokens, shared accessible UI and controlled sample patterns, with test/CI tooling. Historical reported verification: lint/typecheck, six component tests, static build, nine Chromium E2E tests and dependency audit. Those checks were not rerun by this docs update and establish no auth/storage security. See [design-system plan](../../.agent/active/design-system.md).

On 2026-10-03 the user approved replacing local-first/encrypted-vault plans with full-stack server storage and the agreed backend tools. At that docs-only checkpoint, specs/plans/docs were updated; source/config/dependencies were not migrated. No auth, database, real note CRUD, Redis, worker, Swagger/Postman runtime, Storage, Nginx, Docker or hosted deployment existed then. Subsequent 1A/1B outcomes are recorded below. UI historical evidence remains intact. Existing device-save/local-sync specimen labels are scheduled for Phase 1G adaptation; they are not already server-save behavior.

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


## Milestone 1B outcome — 2026-10-04

Implemented backend-owned Google/Supabase start, callback, session and logout handlers using
exact MIT `@supabase/auth-js` 2.117.2 on Node >=22. The SDK runs per request with transient
server storage. PKCE/app state binds the callback to a ten-minute pending cookie; app access/
refresh credentials stay in a host-only HttpOnly cookie. HTTPS adds Secure and __Host names.
Exact configured Origin protects start/logout; fixed redirects accept no return URL. Online
getUser verifies every session projection after any needed refresh. Local-scope logout preserves
other sessions; unavailable revocation clears local cookies but reports 503. All outcomes are
private/no-store; fixed errors exclude provider payloads. Provider tokens are discarded.

Flow: same-origin POST → provider/Google → fixed callback → SDK code exchange + verified
identity → protected session cookie → safe user JSON; near expiry refresh rotates credentials;
logout revokes the current provider session. Typed browser helpers never receive/store tokens.
No new screens, note/profile database, RLS, Redis, Pino, cache library or later milestone work.
Existing design system/showcase/spec/instructions match the pre-edit SHA-256 baseline.

Responsibilities and concepts: [FILE_MAP](../FILE_MAP.md), [LEARNING](../LEARNING.md),
[auth setup/contract](../integrations/supabase-auth.md), [ADR-020](../decisions/ADR-020-backend-owned-auth-cookies.md)
and [auth OpenAPI](../api/openapi.json). Local ignored `.env` has user-supplied URL/key;
tracked `.env.example` has placeholders. Google client credentials belong in Supabase settings.

Read-only live settings accepted URL/key (HTTP 200), but Google was disabled. Live consent,
callback, refresh-token reuse timing and revocation remain unproven. Fixture tests use the real
SDK and real Next/browser cookies, but simulate the provider. Therefore the active 1B live
acceptance checkbox stays open. Admission/rate-limit/logging controls are 1D; current endpoints
are for development verification. Cookie payloads are bounded, one pending flow is supported,
and SDK retries mean a ten-second per-fetch timeout is not a whole-operation deadline.
No paid resource, deployment or commit. Stop for review; 1C not started.


Fresh final local verification on 2026-10-04:

| Command/check | Observed result |
|---|---|
| `npm run lint` | Exit 0; ESLint and semantic style contract passed |
| `npm run typecheck` | Exit 0 |
| `npm run test` | Exit 0; 54/54 tests across 5 files (6.58s) |
| `npm run build` | Exit 0; public routes prerendered, four auth routes dynamic Node handlers |
| `npm run test:e2e` | Exit 0; 11/11 Chromium showcase/runtime tests (5.2s) |
| `npm run test:auth` | Exit 0; 2/2 Chromium/real Next auth tests with disposable provider (3.2s) |
| `npm run test:boundary` | Exit 0; real Next client import rejection and request-time server-config probes |
| `npm audit --audit-level=high --fetch-retries=0 --fetch-timeout=15000` | Exit 0; 0 vulnerabilities |
| Final client configuration scan | 26 `.next/static` files; both configured Supabase values checked; 0 leaks |
| SHA-256 baseline | Existing UI/design/spec/AGENTS unchanged; only existing `src/server/config.ts` changed as expected |
| `git diff --check` / `git check-ignore .env` | Exit 0 / `.env` confirmed ignored |
| Documentation validation | 31 Markdown documents, 148 local file links, 0 missing targets/unbalanced fences; OpenAPI JSON parses as 3.1.0 with four auth paths |

Boundary/audit checks ran during this milestone before the final formatting-only pass;
application checks above were rerun after formatting. CI was updated but no hosted run observed.
Browser FORCE_COLOR/NO_COLOR warnings were cosmetic. Live Google/provider tests remain pending;
this is local application evidence, not production SEC-01/05 or database/RLS acceptance.

Live-provider follow-up — 2026-10-04: after user setup, `/auth/v1/settings` returned
HTTP 200 with Google enabled. Fresh `npm run test:auth` exited 0: 2/2 fixture browser
tests passed (3.9s). Started local Next dev at APP_ORIGIN and used a disposable native
POST form; start → live Supabase → Google account sign-in page succeeded. No Google
credentials entered by the agent. User sign-in/consent and subsequent callback/session/
refresh/logout checks remain pending. Temporary form route removed after starting the
flow; local dev remains running for the callback. No application code change, commit,
deployment or 1C work. This supersedes the earlier disabled-provider status, not the
historical evidence. 1B live acceptance remains open.


Documentation follow-up — 2026-10-04: current integration/architecture/learning/ADR
statuses updated to the enabled-provider/live-entry evidence above. `docs/LEARNING.md`
now includes the implemented auth reading workflow. The live dev run appended Next's
version-specific instructions to AGENTS.md; retained this generated block. Earlier
unchanged-AGENTS verification describes the pre-dev checkpoint. No 1C, commit or deploy.

Documentation-pass validation: 31 Markdown documents, 148 local file links, 0 missing
targets/unbalanced fences; source/config/dependency/env SHA-256 baseline unchanged;
`git diff --check` passed and `.env` remains ignored. Application checks were not rerun
for this docs-only pass; implementation and live-entry results above retain their dates.

Live callback/session/logout follow-up — 2026-10-04: user completed Google sign-in.
The same in-app browser displayed `/api/auth/session/` with only user id/email/displayName
(no token fields). A disposable same-origin form called POST `/api/auth/logout`: observed
HTTP 204. GET `/api/auth/session` from the same browser afterward returned HTTP 401,
error code `unauthenticated`. JSON-page navigation was blocked by the in-app browser after
logout; a native page button calling the same API confirmed the 401 safely. The temporary
verification route was removed. No personal profile values/tokens copied into tracked docs.

Live sign-in/callback/session and current-cookie logout are now verified. Live refresh/reuse,
expired access, revoked-token replay and independent-session provider checks remain pending;
fixture tests cover those application paths but do not replace live evidence. Keep 1B live
acceptance open for those checks; no 1C, commit or deployment. No lasting runtime code change.

Follow-up validation: 31 Markdown documents/148 local file links, 0 missing targets or
unbalanced fences; existing source/config/dependency/env hashes unchanged; temporary route
absent; `git diff --check` passed, `.env` ignored. No application suite rerun for this
removed-harness/evidence-only follow-up; live HTTP results are recorded above.

Live 1B acceptance completed — 2026-10-04

Two Google logins in the same browser created distinct Supabase session IDs. The temporary
local harness retained A/B app credentials only in server memory and called the real Next
HTTP auth endpoints, which used the real Supabase provider. Browser UI displayed only
status/pass-fail, no personal values or tokens. Observed results: 13/13 PASS.

| Live check | Observed result |
|---|---|
| Distinct A/B provider session IDs | PASS; separate sessions of the same test user |
| Initial A session | 200 |
| Forced expiry hint → real provider refresh | 200; refreshed protected-cookie payload returned |
| Refresh rotation | Refresh credential changed |
| Immediate parent refresh reuse | 200 |
| Concurrent refresh from the same parent | Both requests 200 |
| Initial B session | 200 |
| Current-session logout A | 204 |
| Replay original A cookie after logout | 401 |
| Replay refreshed A cookie after logout | 401 |
| Revoked refresh attempt | 401 |
| B survives logout A | 200 |
| Cleanup logout B | 204 |

Captured credentials were cleared; browser app cookies cleared after cleanup; temporary
`src/app/auth-check/route.ts` removed. No lasting runtime code or credentials were added.
Natural access JWT expiry was not awaited: changing only the app expiry hint triggered the
actual provider refresh path. Immediate reuse/two concurrent calls prove these bounded
cases, not every reuse interval/load/provider configuration. Independent sessions used
one Google account, not a two-user database/RLS test. HTTPS/production ingress/admission/
logging evidence remains later milestones. Test-only canonical paths included trailing
slashes to avoid redirect normalization. The first native sign-in form was Origin-rejected
in the in-app browser; same-origin fetch-based temporary adapter preserved Origin checks
and forwarded the app's pending cookie/authorize URL. No auth protection was relaxed.

Milestone 1B code/local/live acceptance is complete. Earlier pending/disabled observations
above are historical checkpoints, superseded by this evidence. Stop for review; no 1C,
commit, deployment or paid resource. Updated current plan/README/architecture/security/auth/
ADR/file-map/learning statuses to match these observations.

Final live-check cleanup validation: `npm run typecheck` passed during the harness and
after removal. Initial post-removal typecheck found only a stale Next-generated type
import for the removed route; removed that specific generated cache file, rerun exited 0.
31 Markdown documents, 148 local file links, 0 missing targets/unbalanced fences;
existing source/config/dependency/env hashes unchanged; temporary route absent;
`git diff --check` passed and `.env` remains ignored. No full application suite rerun:
production source was unchanged; earlier implementation-suite results retain their dates.

## Milestone 1C outcome — 2026-10-04

✅ Implemented only minimal profiles/notes schema, strict shared contracts, reviewed Drizzle
migration and the verified-owner transaction boundary. The user authorized the existing
Supabase development project; migration and constrained login were provisioned there.
Hosted Session pooler (5432) uses verified TLS with the user-downloaded CA. PostgreSQL
version observed: 17.11. Versioned migration re-run succeeded; hosted profiles/notes counts
were both zero after disposable test cleanup. Existing Auth account was preserved.

Important responsibilities: validation/types own bounded contracts; schema/migration own
FKs/defaults/checks/index/owner RLS; user-context issues request-scoped online-verified
identity; client checks actual roles/grants and applies LOCAL claims in bounded transactions;
config owns lazy server URL/pool/CA; CLI scripts alone use privileged credentials. The
[model](../features/note-model.md), [ADR-021](../decisions/ADR-021-scoped-database-role.md),
[file map](../FILE_MAP.md) and [learning flow](../LEARNING.md) explain the code and concepts.

### Fresh verification

| Command/check | Observed result |
|---|---|
| `npm run lint` | Exit 0; ESLint/style contract passed |
| `npm run typecheck` | Exit 0; strict TypeScript passed |
| `npm run test` | Exit 0; 66/66 tests, 8 files |
| `npm run build` | Exit 0; public pages prerendered, four auth routes dynamic; no note routes |
| `npm run test:boundary` | Exit 0; 3 checks: client config rejection, client DB config rejection, Node request-time route |
| `npm run test:db` | Exit 0; 7/7 actual PostgreSQL/Drizzle tests; failed-GRANT rollback and fresh/repeated migration probes also passed |
| `npm run test:db:hosted` | Exit 0; same 7/7 against real Supabase Session pooler, two disposable Auth identities |
| `npm run test:e2e` | Exit 0; 11/11 showcase/runtime/secret-marker browser tests against final build |
| `npm run test:auth` | Exit 0; 2/2 real Next/browser auth tests with controlled provider transport |
| `npm run db:generate -- --name=drift_check` | Exit 0; no schema changes, nothing to migrate |
| `npm audit --audit-level=high` | Exit 0; 0 vulnerabilities |
| Hosted migration journal/re-run/cleanup probe | PASS; no repeat DDL; profiles/notes both 0 after cleanup |
| Actual credential scan | 26 `.next/static` files; 0 credential matches; no credential values printed |
| Original source/AGENTS/PRODUCT_SPEC SHA-256 comparison | 0 changes; design system, showcase and existing auth source preserved |
| Markdown file targets/fences + `git diff --check` | 33 Markdown files, 172 local links; 0 missing targets/unbalanced fences; diff clean |
| Fresh review + follow-up | Two provisioning P2s fixed with RED/GREEN regressions; follow-up clean |

TDD failures were behavioral: forged fields, empty/oversized/NUL text, empty update,
boolean list limit, malformed credential error, missing RLS claims, privileged runtime
role and credential truncation. Tests preceded fixes. Setup issues were recorded as
infrastructure failures, not meaningful RED. Initial sandbox loopback/network/Docker
checks failed; authorized retries completed. Browser output includes only benign
NO_COLOR/FORCE_COLOR warnings. No hosted GitHub Actions run was observed.

### Limitations and scope boundary

No note CRUD service/repository/HTTP route, first-request profile creation, atomic expected-
revision operations, editor/save UI, cache/state library, Redis/Pino, Storage or worker.
RLS allows only the verified owner's rows, including own soft-deleted records; future
repositories must explicitly filter active rows, owner and expected revision. 1E owns
revision conflicts/reconciliation. Titles validate JS whitespace more strictly than SQL
space trim. Domain timestamps are ISO strings; Drizzle rows contain Date instances and
future services must normalize them. Auth response projection remains unchanged.

Database integration uses the official SDK with a controlled Auth transport to issue
capabilities for actual disposable auth.users rows. Hosted policies/function/driver/pooler
are real; these tests do not repeat Google consent. Direct `auth.uid()` probing was denied
by hosted Auth schema privileges; reading LOCAL claim settings fixed the probe, while
unchanged two-user RLS queries proved stored auth.uid policies. Transaction pooler mode
is configured-compatible (`prepare:false`) but not live-tested; observed mode is Session.

Privileged operators/server credential holders remain trusted and can impersonate claims;
FORCE RLS does not restrain a superuser/BYPASSRLS role. Database development TLS is verified,
not production ingress/at-rest/backup/restore readiness. Local Docker explicitly uses
non-TLS loopback TCP and a test-only minimal auth schema. Default runtime pool is 3, maximum
10; each app instance has its own pool. SQL setup incurs round trips; load testing is pending.

Provisioning now stages fsynced private recovery credentials before transactional role/
membership creation and atomically publishes env if unchanged. SQL/filesystem cannot
commit together; interrupted/ambiguous setup leaves ignored `.env.database-pending` for
verified operator recovery. Existing role/URL is never automatically rotated/overwritten.
The initial successful hosted setup was not rerun or rotated after review; the corrected
same role helper was exercised on fresh local PostgreSQL, including forced-GRANT rollback.
.env was restricted to 0600. Env/cert/pending files remain ignored; no secrets committed.

Updated active plan, README/architecture/index, FILE_MAP/LEARNING, full-stack/state/security,
Supabase/dependency docs; added note-model and ADR-021. No historical docs deleted and no
PRODUCT_SPEC change. Milestone 1C is ready for user review. 1D remains planned; no commit,
deployment, paid resource or later milestone implementation.


## Current-implementation documentation review — 2026-10-04

This is a documentation-only review after 1C; it does not implement 1D or repeat the
application/provider checks recorded above. [Review plan](../../.agent/active/documentation-current-implementation.md)
owns its completed checklist; [authoring standard](../DOCUMENTATION.md) defines future updates.

README now owns setup, ARCHITECTURE current boundaries, LEARNING concept-first study and
FILE_MAP concise file connections. Auth/database guides own protocol/SQL details, including
trust, failures, provisioning recovery and limitations. ADR-016/018/019/020/021 include
alternatives and trade-offs. Planned save/cache/file/job flows remain separately labeled.
The auth OpenAPI documentation description no longer says live acceptance is pending;
its endpoint/schema contract is unchanged. Superseded documents and prior test outcomes
remain historical; PRODUCT_SPEC was not changed.

Source inspection established important limits: no current app caller of the database
boundary or account fetch helpers; no automatic revision/update timestamp advancement;
owner contexts have no expiry/reverification; database session verification lacks explicit
provider disposal. Runtime catalog checks do not audit every policy/membership. No explanation
for that cleanup difference is established by source; future adapters must address lifecycle
and refresh propagation. No production hosting, backup/restore or transaction-pooler proof
can be inferred from the development checks.

### Verification for this documentation pass

Results below are documentation checks, not application test runs. Temporary validators
live outside the repository and are not new project commands.

| Command/check | Result |
|---|---|
| `python3 /tmp/mindmora-docs-check.py` | Exit 0; 36 Markdown files, 306 local links, 15 npm script references; 0 missing targets/anchors/unbalanced fences. 81 baseline artifacts checked: 80 unchanged plus description-only OpenAPI documentation edit; 0 implementation changes |
| `node /tmp/mindmora-docs-exports.mjs` | Exit 0; 45 named exports across 20 files and 9 environment placeholders checked; 0 errors |
| Mermaid/source review | 17 diagrams reviewed: 13 refreshed current/planned diagrams plus 4 unchanged spec/plan diagrams; fences balanced. No Mermaid parser/render tool installed; automated syntax/render verification was not run |
| `git diff --check` | Exit 0; no whitespace errors |

No fresh lint, typecheck, unit, build, database, browser, audit or live Google checks ran.
No application/config/package/migration changes, deployment or commit were performed.
The single non-Markdown documentation edit is OpenAPI info.description; all other JSON
contract fields are compared against the task baseline.
