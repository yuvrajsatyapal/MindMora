# ADR-020 — Backend-Owned Supabase Auth Cookies

**Decision:** implemented for 1B local verification, 2026-10-04. **Live Google/provider acceptance:** Google sign-in/session/logout and refresh/replay verified (13/13 live checks).

## Context

MindMora requires backend-owned HttpOnly session cookies and a token-free browser projection. Supabase's standard SSR/browser pattern expects JavaScript-readable tokens for browser refresh; simply copying that integration would violate the selected boundary. 1B has no database/profile/session table and must preserve the public showcase.

## Decision

Use official auth-only `@supabase/auth-js` 2.117.2 in fresh request-local clients. Custom transient storage holds SDK PKCE verifier state; the browser-bound pending flow is carried in a protected ten-minute cookie with random app state. Supabase owns Google OAuth state/code validation; the app checks callback state/expiry and uses SDK code exchange with its recorded flow ID.

Persist only Supabase app access/refresh credentials and expiry hint in a host-only HttpOnly cookie; discard Google tokens and provider/user metadata. HTTPS uses Secure/__Host names, SameSite=Lax, Path=/; loopback HTTP is an explicit local exception. Every session request verifies identity online via getUser, with server refresh near expiry. POST start/logout require exact Origin, callback redirect destination is fixed, and auth responses are non-cacheable. Logout revokes scope=local, clears local cookies and reports remote outage accurately.

## Alternatives

1. Standard browser/SSR Supabase SDK: maintained default, but needs browser token access/refresh and does not meet MindMora's HttpOnly boundary.
2. Opaque cookie with custom DB/Redis session authority: requires extra token storage/schema/coordination before 1C, and duplicates session ownership; deferred.
3. Handwritten GoTrue REST/PKCE: fewer SDK dependencies but duplicates maintained provider protocol details; rejected.

## Rationale

Reuse supported provider APIs while keeping auth credentials out of browser JS and avoiding custom passwords/session cryptography. An auth-only package avoids introducing database/Storage clients before their milestones. Lazily validated configuration keeps the public showcase available before provider setup.

## Trade-offs

Online verification adds provider latency and fails closed during outage. Protected cookies still contain bearer credentials; HttpOnly does not prevent XSS-authenticated requests or stolen-cookie replay before provider revocation. Cookie size is bounded; oversized sessions fail safely, requiring reviewed chunking if needed. A single pending cookie supports one active sign-in per browser. Concurrent refresh behavior depends on Supabase's documented reuse policy and was observed in a live two-request check; that bounded result does not prove every timing/load pattern. SDK retry timing can exceed a per-fetch timeout.

## Consequences

No browser auth SDK, local/session storage tokens, service-role key, custom password/token table or Google provider-token persistence. Session projection/HTTP helpers exist without product screens. Cache/draft cleanup remains 1F/1G. Redis/Pino/admission controls remain 1D and endpoints are not production-ready before that work. Initial auth OpenAPI is maintained; Swagger/Postman generation remains 1H. Live provider checks must finish before 1B acceptance is checked off.

## Evidence

Test-first config/routes/client helper failures preceded implementation. Real-SDK fixture and Next/browser tests verify application cookie/PKCE/Origin/refresh/local-revocation behavior. The initial live settings check found Google disabled. After user setup, a fresh check returned HTTP 200 with Google enabled; the live start flow reached Google’s sign-in page. The user then completed sign-in/consent; the browser received the safe live session projection. Same-origin logout returned 204 and session afterward returned 401. Subsequent live refresh/rotation, immediate reuse/concurrent refresh, revoked original/refreshed cookie replay and independent-session isolation checks passed 13/13. Refresh was triggered by an aged expiry hint; natural JWT expiry was not awaited.

[Auth implementation/setup](../integrations/supabase-auth.md) · [Phase 1 plan](../../.agent/active/phase-01-foundation.md) · [ADR-016](ADR-016-supabase-auth-and-server-data.md)
