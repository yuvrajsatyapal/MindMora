# MindMora Documentation

**Updated:** 2026-10-05. ✅ Shared UI, 1A runtime and 1B backend auth code; ✅ live Google sign-in/session/logout and refresh/replay acceptance verified; ✅ 1C minimal schemas/database/RLS; ✅ 1D HTTP/Pino/Redis admission; ✅ 1E note CRUD/revisions/create reconciliation locally verified; 📋 workspace/editor/storage/jobs.

| Document | Job |
|---|---|
| [Product spec](../PRODUCT_SPEC.md) | Authoritative v3 full-stack requirements and feature scope |
| [Agent instructions](../AGENTS.md) | Current operating/security rules |
| [Getting started](../README.md) | Prerequisites, environment setup and runnable commands |
| [Documentation standard](DOCUMENTATION.md) | Primary homes, teaching quality, diagrams and evidence rules for future updates |
| [Architecture](../ARCHITECTURE.md) | Authoritative current runtime, data/trust boundaries and failures; separate target |
| [Plan standard](../.agent/PLANS.md) | How to write self-contained milestone plans |
| [Phase 1 ExecPlan](../.agent/active/phase-01-foundation.md) | Full-stack migration, files, tests, live checklist |
| [Roadmap](phases/README.md) | Revised 14 phases and plan timing |
| [Phase 1 record](phases/phase-01-foundation.md) | Observed outcomes and limitations |
| [File map](FILE_MAP.md) | Actual significant file responsibilities |
| [Learning](LEARNING.md) | Implemented concepts versus planned backend explanations |
| [Full-stack design](architecture/full-stack-architecture.md) | Separately labeled planned save/conflict/file/job flows |
| [State](architecture/state-management.md) | Database versus temporary query/UI/URL/draft ownership |
| [Security](architecture/security-architecture.md) | Current SEC-01–10; auth/RLS/no private browser persistence |
| [Supabase Auth](integrations/supabase-auth.md) | Google PKCE, cookie/refresh/logout lifecycle, HTTP guards and provider failures |
| [Supabase database](integrations/supabase-database.md) | Verified owner context, SQL roles/RLS, pooling/TLS, provisioning recovery and failures |
| [Backend services](integrations/backend-services.md) | Redis/BullMQ/worker/Nginx/Pino |
| [API tooling](integrations/api-tooling.md) | Zod/OpenAPI/Swagger/Postman |
| [Budget](integrations/hosting-and-costs.md) | Dated free quotas and unselected runtime hosting |
| [ADR-016](decisions/ADR-016-supabase-auth-and-server-data.md) | Supabase Auth/PostgreSQL/Storage |
| [ADR-018](decisions/ADR-018-full-stack-server-storage.md) | Full-stack server storage; no E2EE/browser note DB |
| [ADR-019](decisions/ADR-019-backend-services-and-api-tooling.md) | Accepted tooling and rollout |
| [ADR-020](decisions/ADR-020-backend-owned-auth-cookies.md) | Implemented cookie/PKCE lifecycle and observed provider evidence |
| [Note model](features/note-model.md) | Implemented profile/note schemas and input contracts; API behavior implemented; workspace UI planned |
| [ADR-021](decisions/ADR-021-scoped-database-role.md) | Implemented constrained login, transaction identity, effective RLS and trust limits |
| [ADR-022](decisions/ADR-022-http-admission-and-safe-logging.md) | HTTP limits, trusted forwarding, outage fallback and allowlisted logging |
| [ADR-023](decisions/ADR-023-startup-dependency-health.md) | Once-per-process dependency probes and production fail-fast |
| [Auth/note OpenAPI](api/openapi.json) | Auth/note contract records without credentials; broader tooling remains 1H |

| [Note API](features/notes-api.md) | Implemented endpoints, concurrency, replay, errors and trust boundaries |
| [ADR-024](decisions/ADR-024-note-write-concurrency-and-reconciliation.md) | Atomic revisions, owner-scoped create keys and lazy profile initialization |

## Existing UI contracts

[Design](design/design-system.md) · [Component API](design/component-api.md) · [Dependencies](design/dependencies.md) · [Completed design-system plan](../.agent/active/design-system.md).
Historical static build/test evidence applies to the earlier UI milestone. Milestone 1A preserves the source and reruns showcase checks on the Node runtime; current evidence is in the Phase 1 record.

## History and status

[Local-first history](architecture/local-first-architecture.md), [ADR-001](decisions/ADR-001-static-export.md), [ADR-002](decisions/ADR-002-indexeddb-source-of-truth.md), [ADR-003](decisions/ADR-003-dexie.md) and [ADR-017](decisions/ADR-017-client-side-encryption.md) are ❌ superseded, not current instructions.

✅ Implemented / 🚧 In progress / 📋 Planned / ❌ Removed (or superseded with history). Implemented and validated are distinct; evidence is dated and identifies its test/provider boundary. An accepted ADR is not implemented behavior. Keep active execution checklists in `.agent/active/`; phase records report actual outcomes. Create later feature/AI/phase docs when their work begins, following spec §19.3; avoid speculative implementation claims.
