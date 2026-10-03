# ADR-016 — Supabase for Auth and Server Data

**Decision status:** Accepted by user, 2026-10-03. **Implementation:** ✅ 1B backend auth code/local checks; ✅ live Google/session lifecycle acceptance verified; 📋 PostgreSQL/Storage.

## Context

The v2 spec reserved ADR-016 for optional auth/Pro-only Supabase. The user chose full-stack storage and Google sign-in; the account-only restriction no longer applies.

## Decision

Use Supabase Auth for Google identity/session lifecycle, Supabase PostgreSQL for private knowledge/profiles/entitlements, Drizzle for schema/queries/migrations, and private Supabase Storage for attachment/export bytes. Protect APIs using validated backend session, verified owner, effective RLS and scoped repository queries. Establish and test a backend-owned secure cookie flow.

## Alternatives

Aiven/Neon plus custom identity/session services; the former optional auth-only Supabase/local-first design; another managed full-stack provider.

## Rationale

Keep one primary production database and managed auth/files rather than hand-implementing credential management. Support all devices through the same server records.

## Trade-offs

Network/provider availability and quotas affect note access. Authorized server/provider operators can read data; no E2EE claim. Drizzle roles must not silently bypass RLS. Free tier can pause and has storage/egress limits; worker/ingress hosting is separate.

## Consequences

Auth moves to Phase 1; knowledge persistence no longer uses Dexie/Drive. Phase 13 expands entitlements instead of introducing identity. No passwords/raw provider tokens in app tables; no Aiven/Neon database or MinIO.

[Specification](../../PRODUCT_SPEC.md) · [Auth design](../integrations/supabase-auth.md) · [ADR-018](ADR-018-full-stack-server-storage.md)

[ADR-020](ADR-020-backend-owned-auth-cookies.md) records the supported auth SDK/custom storage/HttpOnly cookie choice and live acceptance limitations.
