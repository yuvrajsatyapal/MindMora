# Server startup dependency health

**Status:** ✅ Implemented, awaiting user review, 2026-10-04. User-authorized follow-up to 1D; 1E remains unstarted.
**Goal:** Each Next Node server process probes Redis and runtime PostgreSQL once before ready,
prints credential-free terminal results, refuses unhealthy production startup and preserves
friendly development startup. No health endpoint, polling, note operation or deployment.
**Authority:** AGENTS.md, PRODUCT_SPEC security/server boundaries, Phase 1 1D, ADR-019/021/022.

## Inspected state and architecture

No instrumentation/startup probe exists. Redis has lazy bounded counter clients; PostgreSQL
has lazy scoped request pools and verified TLS config. Next 16.3.8's installed instrumentation
guide says async register runs before readiness. Existing production browser previews require
new disposable PostgreSQL/Redis fixtures once production fail-fast is enforced. Existing
uncommitted 1D changes and AGENTS.md edit must be preserved; work on main, no commit.

## Scope, files and flow

- `src/instrumentation.ts`: Node-only dynamic import; exclude production-build workers.
- `src/server/startup/health.ts`, tests: once-per-process orchestration, PING/SELECT 1 probes,
  finite network deadlines, close dedicated probe clients, safe fixed failure classifications.
- `scripts/local-test-postgres.mjs`, `test-showcase-e2e.mjs`: disposable pinned PostgreSQL
  login for connectivity; combine existing disposable Redis fixture for production previews.
- Existing auth test runner/Playwright config/package scripts/CI: use those fixtures and run
  actual startup success/failure/restart integration tests without cloud credentials.
- Dedicated startup test script: production/Next processes, two healthy restarts, unavailable
  services/credential markers, no duplicated checks on requests; dev startup remains usable.
- README, ARCHITECTURE, services/database/security guides, FILE_MAP/LEARNING, phase record
  and active plan: source-matched behavior/evidence. No PRODUCT_SPEC/schema/migration edits.

Next register → process-global promise → parallel config/probes → close probe sockets → fixed
terminal result for each → continue in development or throw a fixed production failure.
No note tables/owner claims are queried. SELECT 1 checks connectivity, not RLS/schema readiness.
Redis PING does not validate EVAL ACL/admission counters; those keep separate 1D evidence.
Build/Edge contexts must not probe. Production requires both services, including public preview.

## Test-first implementation and verification

1. Write observable tests for safe logs, missing/malformed settings, failures, deadlines,
   concurrent register calls, production rejection and development continuation. Observe red.
2. Implement minimal orchestration/probes. Pass unit tests; refactor only while green.
3. Build and exercise actual Next register with healthy local services, restarts, failing
   Redis/PostgreSQL and development warnings. Browser fixtures use healthy local services.
4. Run lint, typecheck, test, build, relevant Redis/DB/boundary/startup and browser checks.
5. Update docs with exact commands/counts, retained limits and stop for review.

## Decisions and limits

Production startup now requires both services; no production bypass flag. Local dev warns
and stays available. Builds skip dependency probes. Dedicated short-lived connections avoid
retaining privileged resources or coupling startup to request pools. Only static service names
and allowlisted failure messages may reach stdout/errors. Unknown exceptions are never logged.
Use a global promise rather than only module state to survive HMR/module duplication.
No new library or paid service. Hosted provider/ingress/retention settings remain independent.

## Progress and evidence

- [x] Inspect framework/current clients and explain expected changes.
- [x] Observe behavior-test red; implement and pass targeted tests.
- [x] Actual Next startup/restart/failure and development verification.
- [x] Required regression checks; documentation/final diff review.


### Implementation / debugging evidence — 2026-10-04

Initial six behavior tests failed against empty bootstrap signatures (no logs/once guard,
production did not reject, invalid configuration resolved). Minimal probes/orchestration
then passed six tests. Build succeeded with no dependency probes during static generation.
Real protocol tests verify PING/SELECT 1, safe auth failures and bounded stalled handshakes.

Actual process tests exposed two Next 16.3.8 behaviors: its Ready banner is printed before
configuration/instrumentation, and rejecting instrumentation can leave the listening process
alive. The test's banner-based assertion was corrected after source inspection; a second
red process run confirmed failure logs but no process exit. Production instrumentation now
explicitly terminates with code 1 after safe health results; development still continues.

The local Valkey default user is nopass, so a fabricated password alone did not fail auth;
changed the authentication fixture to a nonexistent ACL user. Both rejection expectations
are awaited together to avoid a test-owned unhandled rejection. No product auth weakening.

Development integration initially returned HTTP 500 despite both warning logs. A focused
review found Edge compilation trying to resolve Node `stream` through the Redis import.
The compound early-return runtime guard did not prune this import graph. Changed to the
installed Next guide's explicit `NEXT_RUNTIME === "nodejs"` branch; the same actual dev
process check then served HTTP 200 with one warning per service. No auth bypass was added.

An attempted formatter invocation could not reach the npm registry in the sandbox; used the
already cached Prettier binary instead. A premature process-test run overlapped a build and
failed its healthy-start assertion; final build/process checks are rerun sequentially.

### Final verification — 2026-10-04

- `npm run lint`, `npm run typecheck`: exit 0; style contract passes.
- `npm run test`: 94 tests / 13 files pass, including seven startup behavior tests.
- `npm run build`: exit 0; static pages remain prerendered; no connectivity probes run
  during build. Final build was completed before process/browser tests.
- `npm run test:startup`: exit 0; four real protocol/auth/deadline tests pass; two separate
  production starts log each success once across requests; each unavailable service exits
  production nonzero; missing dev configuration logs each warning once and serves HTTP 200.
- `npm run test:rate-limit`: five real local Valkey counter/outage tests pass.
- `npm run test:db`: seven local PostgreSQL/RLS tests pass, with role provisioning/migration.
- `npm run test:auth`: three browser auth tests pass using local provider/Redis/PostgreSQL.
- `npm run test:e2e`: eleven showcase/runtime/accessibility browser tests pass.
- Configured hosted Redis/PostgreSQL probes: temporary `live-check.test.ts` run with
  `node --env-file=.env node_modules/vitest/vitest.mjs run src/server/startup/live-check.test.ts`
  passed 1/1 using PING/SELECT 1 only. Temporary source removed; no `.env` change or output
  of credentials. This is connectivity from this machine, not a hosted Next deployment test.
- Focused independent review: ACCEPT; its development import-boundary finding was fixed
  and verified by the same real process check.

No new dependency, schema, note operation, queue, production deployment, commit or paid
resource. PING/SELECT 1 do not establish quotas, Redis EVAL permissions or SQL schema/RLS;
startup does not monitor later outages. Both services are required for production/public
preview. Safe classifications deliberately omit provider causes. 1E remains unstarted.

- `npm run test:boundary`: three compiler/Node runtime boundary checks pass.
- `python3 /tmp/mindmora-1d-docs-check.py`: 39 Markdown files, 346 local links,
  19 Mermaid blocks and 17 npm script references checked; zero errors. Diagram arrows
  reviewed against source; no external Mermaid renderer/parser was run.
- `git diff --check`: exit 0. Documentation/source scope reviewed; PRODUCT_SPEC,
  schemas/migrations and ignored `.env` remain unchanged by this follow-up.

**Handoff:** all authorized startup work complete; stop for user review, do not begin 1E.


### Green success tick follow-up — 2026-10-04

User requested green success ticks. Scope: `health.ts` uses Node's built-in `styleText`
only on the success glyph; `health.test.ts` verifies colored and disabled-color output.
No new library or probe/policy changes. Use Node's terminal/environment color detection
so ordinary redirected output remains plain and FORCE_COLOR can explicitly enable color.
Observe red before implementation, then run lint/typecheck/unit/build and update the
primary services documentation. Stop for review; 1E remains unstarted.

✅ Green-tick follow-up complete. The new color-enabled behavior test first failed because
both ticks were plain (1 failure / 7 passes); after the minimal `styleText` change, all eight
health tests pass, including NO_COLOR plain-output coverage. Fresh commands: `npm run lint`,
`npm run typecheck`, `npm run test` (96 tests / 13 files), `npm run build` all exit 0.
`FORCE_COLOR=0 npm run test:startup` exits 0: four real probe tests plus healthy production
restarts, both production failures and development warnings/public page checks pass.
Colors are asserted through real Node styling in unit tests; the process harness intentionally
uses plain output. No fresh browser/RLS/hosted checks were needed for this glyph-only change.
Documentation checker: 39 Markdown files, 347 links, 19 Mermaid blocks, 17 script references,
zero errors. `git diff --check` passes. No probe/auth/security policy changes or new libraries.
