# Supabase Auth and Server Data

**Status:** 📋 Planned, accepted 2026-10-03. Auth, PostgreSQL/Drizzle and Storage integration are not implemented.

## Purpose and user experience

Google sign-in opens a private account workspace. Auth is required to access server notes. Supabase manages identity/session lifecycle; PostgreSQL stores notes/profile/entitlements and private Storage stores files. No custom password table, raw Google-token table or second auth database.

```text
Sign-in button → backend start → Supabase Auth / Google
→ backend code/PKCE callback → validated identity → secure app session
→ API validates session → verified owner → repository/Storage permission checks
```

## Proposed implementation boundaries

`src/server/auth/session.ts` validates/refreshes/clears backend sessions; auth Route Handlers handle start/callback/logout and safe `/session` projection. `src/server/db` holds server-only Drizzle clients/migrations; user-scoped services enforce ownership. Paths remain proposed. Use maintained supported Supabase APIs; test server-owned HttpOnly/Secure/SameSite cookie behavior and avoid mixing it with browser auth SDK token persistence. Enforce allowlisted redirects, PKCE/state and CSRF/origin checks. Auth credentials are never included in query/UI state.

## Database/Storage security

Enable owner RLS and Storage policies. A privileged Drizzle connection does not automatically enforce RLS; request transactions must use tested least-privilege role/verified claim context. Scope all queries even when RLS exists. Worker/maintenance privileged access is separate and still explicitly owner-checked. Test profile editing cannot grant Pro; user A cannot discover user B records, files or jobs. Reset pooled identity context through transaction-local claims.

## Failures and tests

Show sign-in/network failure, session-loading/expiry and safe reauthentication. No anonymous durable offline workspace. Logout/account switch clears private UI/cache and invalidates late responses. Use disposable auth users, not production accounts. Test callback abuse, expiry/refresh/revocation, CSRF, forged user/plan fields, two-user RLS through actual DB driver and clean client bundles.

## Trade-offs and explanation

Managed Auth avoids custom password/session cryptography, but availability depends on provider/network. Server-managed content is readable by authorized infrastructure, unlike an E2EE vault. Free-tier limitations apply to knowledge data too. No payment provider integrated; entitlement lifecycle expands in Phase 13.

[Google sign-in documentation](https://supabase.com/docs/guides/auth/social-login/auth-google) · [SSR guidance](https://supabase.com/docs/guides/auth/server-side) · [ADR-016](../decisions/ADR-016-supabase-auth-and-server-data.md) · [security tests](../architecture/security-architecture.md)
