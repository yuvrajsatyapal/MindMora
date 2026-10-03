# MindMora Documentation

**Updated:** 2026-10-03. ✅ Shared UI and 1A Node runtime/server config boundary; 📋 auth/persistence/storage/jobs planned.

| Document | Job |
|---|---|
| [Product spec](../PRODUCT_SPEC.md) | Authoritative v3 full-stack requirements and feature scope |
| [Agent instructions](../AGENTS.md) | Current operating/security rules |
| [Architecture](../ARCHITECTURE.md) | Implemented state versus accepted target |
| [Plan standard](../.agent/PLANS.md) | How to write self-contained milestone plans |
| [Phase 1 ExecPlan](../.agent/active/phase-01-foundation.md) | Full-stack migration, files, tests, live checklist |
| [Roadmap](phases/README.md) | Revised 14 phases and plan timing |
| [Phase 1 record](phases/phase-01-foundation.md) | Observed outcomes and limitations |
| [File map](FILE_MAP.md) | Actual significant file responsibilities |
| [Learning](LEARNING.md) | Implemented concepts versus planned backend explanations |
| [Full-stack design](architecture/full-stack-architecture.md) | Save/conflict/file/job flows |
| [State](architecture/state-management.md) | Database versus temporary query/UI/URL/draft ownership |
| [Security](architecture/security-architecture.md) | Current SEC-01–10; auth/RLS/no private browser persistence |
| [Supabase](integrations/supabase-auth.md) | Google auth, server session, roles and data scope |
| [Backend services](integrations/backend-services.md) | Redis/BullMQ/worker/Nginx/Pino |
| [API tooling](integrations/api-tooling.md) | Zod/OpenAPI/Swagger/Postman |
| [Budget](integrations/hosting-and-costs.md) | Dated free quotas and unselected runtime hosting |
| [ADR-016](decisions/ADR-016-supabase-auth-and-server-data.md) | Supabase Auth/PostgreSQL/Storage |
| [ADR-018](decisions/ADR-018-full-stack-server-storage.md) | Full-stack server storage; no E2EE/browser note DB |
| [ADR-019](decisions/ADR-019-backend-services-and-api-tooling.md) | Accepted tooling and rollout |

## Existing UI contracts

[Design](design/design-system.md) · [Component API](design/component-api.md) · [Dependencies](design/dependencies.md) · [Completed design-system plan](../.agent/active/design-system.md).
Historical static build/test evidence applies to the earlier UI milestone. Milestone 1A preserves the source and reruns showcase checks on the Node runtime; current evidence is in the Phase 1 record.

## History and status

[Local-first history](architecture/local-first-architecture.md), [ADR-001](decisions/ADR-001-static-export.md), [ADR-002](decisions/ADR-002-indexeddb-source-of-truth.md), [ADR-003](decisions/ADR-003-dexie.md) and [ADR-017](decisions/ADR-017-client-side-encryption.md) are ❌ superseded, not current instructions.

✅ Implemented / 🚧 In progress / 📋 Planned / ❌ Removed (or superseded with history). An accepted ADR is not implemented behavior. Keep active execution checklists in `.agent/active/`; phase records report actual outcomes. Create later feature/AI/phase docs when their work begins, following spec §19.3; avoid speculative implementation claims.
