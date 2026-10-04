# ADR-021 — Verified Identity with Transaction-Scoped PostgreSQL Roles

**Decision:** Implemented 2026-10-04, Milestone 1C. This is an implemented library boundary,
not a note HTTP API. [Phase record](../phases/phase-01-foundation.md) owns validation and
observed hosted grant differences; [database guide](../integrations/supabase-database.md)
owns exact flags/grants/timeouts/configuration/recovery.

## Context

Drizzle uses direct SQL, not the Supabase Data API's JWT boundary. A privileged login can
bypass policies. Pooled connections also make session-level identity a cross-request risk.
First-time credential provisioning crosses PostgreSQL and a local file without a shared commit.

## Decision

Use a constrained NOINHERIT login that can SET ROLE to a non-login NOBYPASSRLS request role.
Neither owns application tables. Owner policies use verified claims with USING/WITH CHECK;
tables ENABLE/FORCE RLS. Before callback queries, inspect actual login/request flags, grants
and clean initial identity, then set request role/claims with LOCAL scope inside a transaction.
Issue actual verified-owner objects in a private WeakSet after existing online authentication.

Use parameterized Drizzle/postgres-js, a bounded lazy pool and verified remote TLS, with
prepare:false for pooler compatibility. Privileged URLs belong only to CLI. Schema defaults/
constraints establish minimal models; business revision/active-row rules remain future repos.
Project-specific Auth→profile→note foreign-key integrity overrides generic no-FK guidance.

Provisioning stages private recoverable credentials before transactional CREATE ROLE/GRANT,
then atomically publishes env after commit if the original is unchanged. No implicit rotation
or automatic recovery; a pending file requires state verification.

## Alternatives considered

- Privileged login plus owner predicates: simpler setup, but a missing predicate can expose
  rows and policies may be bypassed; rejected for request traffic.
- Supabase Data API: provides provider JWT/RLS integration, but does not follow the accepted
  Drizzle SQL boundary. It remains a different architecture, not a proven performance loser.
- Session-level role/claims: simpler statements but state can leak through pooled reuse;
  rejected in favor of transaction-local scope.
- Per-user DB logins: isolate identity differently, but introduce account/connection lifecycle
  without a current requirement.

## Why this approach

Keep the accepted ORM while making actual role/claim scope explicit and testable through
real queries. The object-identity guard catches accidental fabricated owners before SQL;
LOCAL settings align lifetime with the callback transaction. Staging prevents losing a
generated password if the role commits but local publication fails.

## Trade-offs

Role checks/setup cost round trips; pools and timeouts are per process/statement, not a
whole-system concurrency/deadline guarantee. The server/credential holder can impersonate
claims, and admins still bypass FORCE RLS. The owner object is not expiring authority or
proof of fresh revocation at each run. Callback exceptions are wrapped, and ambiguous commit
outcomes need future reconciliation. Manual SQL grants/FORCE live outside generator snapshots.

SQL/filesystem lack a joint transaction. Pending credentials add sensitive recovery material;
comparison is not complete file locking, and power-loss/backup guarantees are not established.
Effective hosted permissions can differ from requested grants, requiring actual query tests.

## Consequences

Future private adapters must reverify each request, propagate refresh and keep owner contexts
request-scoped. They must also assess the verification helper's missing explicit provider
cleanup. Future repositories apply owner/active/revision predicates and atomic updates;
privileged workers need independent rechecks. Preserve custom SQL through reviewed migrations,
never hosted reset/db push. Session pooler has development evidence; transaction pooler/
production load and infrastructure security remain unverified.

[Model](../features/note-model.md) · [Security](../architecture/security-architecture.md) ·
[Supabase connection reference](https://supabase.com/docs/guides/database/connecting-to-postgres) ·
[Drizzle RLS reference](https://orm.drizzle.team/docs/rls).
