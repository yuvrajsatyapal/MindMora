# ADR-016 — Supabase for Identity and Server Data

**Decision:** Accepted 2026-10-03. **Current:** Auth and minimal PostgreSQL/Drizzle foundation
implemented through 1C; Storage and full knowledge/account lifecycle planned.
[Dated implementation evidence](../phases/phase-01-foundation.md).

## Context

The earlier spec reserved Supabase for optional account/Pro features while knowledge
lived locally. The user chose Google sign-in and a server-authoritative workspace instead.
Identity and private records need a coherent owner boundary across devices, without custom
password infrastructure or multiple primary databases.

## Decision

Use Supabase Auth for Google/session lifecycle and Supabase PostgreSQL as the canonical
record database, with Drizzle schema/migrations/server queries. Private Supabase Storage
is the selected future byte store; it is not implemented. APIs must derive owner from
verified identity and apply effective SQL RLS plus repository ownership checks.

## Alternatives considered

- Separate Aiven/Neon database with custom or separately managed identity: reasonable,
  but introduces another service/data boundary and conflicts with the selected single-provider model.
- Former optional-auth/local-first design: retains durable offline knowledge, but does
  not meet the user's chosen server-authoritative scope.
- Another managed full-stack provider: possible, but no comparative migration/benchmark
  was performed; Supabase was explicitly selected.

## Why this approach

The accepted design keeps managed identity and the canonical database together while
using maintained protocol/SQL libraries. It prepares one set of shared records across
devices; that capability still needs note APIs/UI. This rationale comes from the accepted
design, not a claim that the provider has better measured cost/performance than alternatives.

## Trade-offs

Provider/network availability and quotas become access dependencies. Managed services
reduce custom identity operations but introduce provider configuration/coupling and hosted
limits. Drizzle's SQL login can bypass RLS unless deliberately constrained. Authorized
server/provider operators can read content; no E2EE guarantee follows.

## Consequences

Auth arrives in Phase 1; Phase 13 expands account/entitlement behavior. No app password/raw
Google-token table, second production database, MinIO or Drive-authoritative knowledge sync.
Request-serving and privileged credentials remain separate. Private files/backup/security
settings must be verified when their features arrive, rather than assumed from the provider name.

[Auth details](../integrations/supabase-auth.md) · [Database details](../integrations/supabase-database.md) ·
[ADR-020](ADR-020-backend-owned-auth-cookies.md) · [ADR-021](ADR-021-scoped-database-role.md) ·
[ADR-018](ADR-018-full-stack-server-storage.md) · [Product spec](../../PRODUCT_SPEC.md).
