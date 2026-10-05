# Phase Roadmap

**Status:** ✅ Phase 1 foundation and Phase 2 editor locally accepted 2026-10-05; Phase 3 onward remain planned. Production readiness is separately gated.

The [product spec §17](../../PRODUCT_SPEC.md) owns phase scope. The [Phase 1 plan](../../.agent/active/phase-01-foundation.md) preserves the completed foundation execution and evidence. The [Phase 2 ExecPlan](../../.agent/active/phase-02-editor.md) records the completed single editor phase; its [phase record](phase-02-editor.md) summarizes observed outcomes. Further detailed plans and phase outcome records are created as their work begins.

| Phase | Target |
|---|---|
| 1 ✅ local acceptance | Runtime Next.js, Google sign-in, PostgreSQL/Drizzle notes, Zod/Pino/Redis limits, state boundaries, API docs/tests |
| 2 ✅ local acceptance | CodeMirror, sanitized preview and revision-safe server autosave |
| 3 | Links/backlinks/tags and scoped search |
| 4 | Private files, BullMQ/Redis worker, export/indexing/attachment jobs |
| 5 | 2D/optional 3D graph |
| 6 | Server-backed canvas |
| 7 | Daily notes/templates/tasks/properties |
| 8 | Installable public PWA shell; no persistent offline notes |
| 9 | Advanced/Pro features with backend gating |
| 10 | Optional local/BYOK AI and owner-scoped RAG |
| 11 | Sandboxed plugins |
| 12 | Polish, portability and i18n |
| 13 | Account/entitlement lifecycle expansion |
| 14 | Security/operational review and restore/resilience |

Google auth is Phase 1, not deferred to 13. Phase 4 replaces Drive sync. No E2EE milestone or Dexie setup. Nginx runtime configuration depends on hosting; naming it in a plan does not create a server. Read the [ADR](../decisions/ADR-018-full-stack-server-storage.md) for superseded choices.
