# MindMora — Codex Instructions

MindMora is a full-stack personal knowledge workspace and learning project.
Respond in the user's language. Work in small milestones the user can understand and review.

## Read first

- `PRODUCT_SPEC.md`: authoritative v3 requirements; change only when explicitly authorized.
- `ARCHITECTURE.md`: current implementation versus target boundaries.
- `.agent/PLANS.md` and `.agent/active/phase-01-foundation.md`: planning standard and active phase.
- `docs/README.md`: documentation index.
- Before backend/persistence work, read `docs/architecture/full-stack-architecture.md`, `docs/architecture/security-architecture.md`, and ADR-016/018/019.
- Read relevant feature/design docs before changing their architecture. Historical superseded ADRs are not active requirements.

## Architectural boundaries

1. Next.js App Router runs a Node backend with Route Handlers. Milestone 1A implemented the Node runtime; public pages remain prerendered. Distinguish implemented auth/database boundaries from remaining milestone work.
2. Supabase PostgreSQL is authoritative for notes and all persistent knowledge/profile/entitlement data. Drizzle schemas/migrations and server repositories own access. Components never import database clients/tables or credentials.
3. Supabase Auth provides Google sign-in. Backend verifies each private request and derives owner from the session; never trust submitted user IDs or plans. Use tested server-owned protected cookies, refresh/logout and CSRF/origin controls.
4. Owner filters and effective RLS are required. Direct Drizzle connections/privileged roles may bypass RLS; verify actual role/claim behavior with two-user integration tests. Privileged workers must still recheck owner/revision/deletion.
5. Private Supabase Storage owns attachments/exports. Database owns metadata; authorize upload/download/delete and short-lived URLs. No MinIO.
6. No Dexie/IndexedDB, localStorage/sessionStorage knowledge persistence, query-cache persisters, durable browser mutation queues or private service-worker caches. No E2EE vault/passphrase/recovery-key implementation. Use transport and infrastructure encryption at rest; disclose server-readable data.
7. TanStack Query caches fetched server data in memory only; scope keys by user/session, invalidate on confirmed writes, clear/cancel on logout/account switch. Zustand owns transient UI; nuqs owns URL state; editor state owns drafts. No duplicated authoritative data or session tokens in UI stores.
8. Zod validates form/API/job/config input. Pino produces structured backend/worker logs without note bodies/titles, tokens, cookies, keys, signed URLs or request/response payloads.
9. Redis provides rate-limit counters and BullMQ coordination, not canonical notes or default session authority. Regular note saves go directly to PostgreSQL. Public auth/expensive jobs fail closed on limiter outage; basic APIs require a documented conservative fallback and unchanged auth checks.
10. BullMQ jobs run in a separate Node worker, with small IDs/references, ownership checks, idempotency, bounded retries/concurrency, durable reconciliation and cleanup. Never enqueue secrets or note bodies. Browser Web Workers remain distinct for optional client computation.
11. Nginx is the optional self-hosted HTTPS/reverse proxy. Managed ingress may replace it. Do not cache private responses. No hosting provider/always-on worker/free uptime promise is authorized by naming these tools.
12. Maintain OpenAPI contracts, Swagger UI and generated Postman collections as APIs arrive. Use placeholders/disposable data; no embedded credentials. No Aiven/Neon/second production database or Drive-authoritative sync.

## Workflow

- Inspect before planning; distinguish real source files from proposed paths.
- Significant work requires a self-contained ExecPlan under `.agent/active/` following `.agent/PLANS.md`. This is MindMora's canonical location; avoid competing `.planning/` copies.
- Explain requested milestone and files before editing. Use test-first behavior: red → minimal green → refactor; missing tooling is not a meaningful behavior failure.
- Implement only the authorized milestone. Validate, update docs/progress, explain, then stop for user review. Advance only when requested or explicitly authorized.
- New screens require a design doc covering keyboard, focus, responsive and accessibility behavior. Reuse `src/components/ui`, `src/components/mindmora` and semantic tokens; record any new brand decision.
- Existing Spartan workflows apply when explicitly invoked; ordinary questions/small tasks need no command ceremony.
- Commit only when requested; use small Conventional Commits such as `feat: add authenticated note API` or `docs: revise full-stack architecture`. No generated-by text, AI attribution or co-author trailers. Keep Markdown docs tracked, not gitignored. Follow existing branch conventions without invented ticket IDs; no force-push/secrets.
- User Git preference: future work should be on `main` for the user to review and commit; do not create a branch unless requested. If an explicitly requested temporary branch is used, safely return uncommitted work to `main` before handoff, preserving existing changes. Git merges commits, not uncommitted edits; do not create a commit merely to merge. This preference does not authorize merging the current `feature/phase-01-1c` commit or changing its branch now.

## Code quality and security

- Strict TypeScript; no `any`. Use `unknown` and validated narrowing at external boundaries.
- Small modules, separate business logic/UI, no premature abstractions. Keep server dependencies out of client bundles.
- Verify current versions, licenses, runtime compatibility, free-tier caps and credit-card requirements before adding dependencies/services. Lock exact versions. No paid resources/deployment without explicit approval.
- Never report saved until PostgreSQL commits. Preserve same-tab drafts on failure; no durable offline save promise. Reconcile uncertain writes; return typed revision conflicts, never silent overwrite.
- No `eval()`/`new Function()` or unsanitized Markdown/HTML. Apply relevant controls as features begin, not only Phase 14.
- Never log or persist raw provider/BYOK credentials in application knowledge tables/browser caches/jobs. Optional ephemeral BYOK is request-only; saved keys need a separate approved secret-management plan.
- Follow current SEC-01–SEC-10. Foundation SEC-01–08 precede note CRUD completion; file/job/rendering gates activate with those features. No absolute security claim or default RLS assumption.
- Respect accessibility, keyboard navigation and reduced motion. Lazy-load heavy optional graph/AI; use browser workers for expensive client computation.

## Verification

For application milestones run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, plus applicable database/RLS/auth/queue integration and Playwright checks. Update scripts/CI when runtime capabilities actually arrive; existing preview/E2E tooling still serves the static UI.
For documentation-only work validate internal links, scope and status accuracy and verify source/config remain untouched; don't claim application tests ran. Fix failures before completion. Record exact commands/results/limitations; prior tests are historical evidence, not a fresh run.

## Documentation and learning

Read and follow `docs/DOCUMENTATION.md` for every documentation update. Its primary-home, teaching, diagram, evidence and final-check rules apply to future milestones as well as documentation-only reviews. README is for practical project setup; never add agent milestone request templates or agent permission/workflow instructions there.

At every milestone handoff, review `README.md`, `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `docs/LEARNING.md` and `docs/FILE_MAP.md` against current source. Update each affected document and record any unchanged document with its reason in the execution plan. Keep PRODUCT_SPEC implementation status accurate; change its requirements or scope only with explicit authorization. Include follow-up behavior changes in this review before reporting completion.

For every important implemented file in `docs/FILE_MAP.md`, keep six separate fields: linked file path, one-sentence purpose, important exports, called by, important dependencies and high-level runtime flow to the next file. Add a small ASCII flow after each major subsystem, including request flows where applicable. Identify test-only callers and helpers without product callers; include only existing implemented files, never proposed/future paths. Update this map after every milestone.

Maintain `docs/FILE_MAP.md` for significant existing models/repos/services/stores/workers/hooks/integrations; skip trivial components. Maintain MindMora-specific `docs/LEARNING.md` and distinguish planned examples from implementation. Significant decisions require ADR context, decision, alternatives, rationale, trade-offs and consequences. Keep superseded ADRs clearly historical. Status: ✅ Implemented, 🚧 In progress, 📋 Planned, ❌ Removed. Phase records report observed outcomes; active plans own live checklists. Follow spec §19.3 for feature docs.

## Explain after each implementation

Report what changed and why; important files and responsibilities; runtime/data flow; non-obvious logic; new libraries/concepts; exact verification; limitations; next milestone without starting it unless authorized.

After every milestone, provide a **Code Understanding Summary** for each important created or modified file: file path, one-sentence purpose, important exports, 3–7 short flow steps, important project/service dependencies, security and trust-boundary logic, 2–5 specific snippets or lines the user should read, and only the concepts needed to understand the implementation. Focus on architecture, data flow, decisions and security; skip line-by-line explanations and basic language syntax. End with a small ASCII diagram of the overall milestone flow.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
