# Supabase Auth and Server Data

**Updated:** 2026-10-04. **Status:** ✅ 1B backend auth code/local verification; ✅ live Google sign-in/session/logout and refresh/replay acceptance verified. PostgreSQL/Drizzle/Storage remain planned.

## Purpose and scope

Google sign-in establishes a Supabase identity. MindMora verifies it on the server and gives the browser only a safe user projection. 1B introduces start/callback/session/logout routes; no sign-in screen, profile table, workspace, note API or database client. No custom passwords, Google-token table or independent session database.

## Implemented flow

```text
Same-origin POST /api/auth/start
→ fresh server AuthClient creates S256 PKCE challenge
→ short-lived HttpOnly pending cookie holds app state + SDK verifier storage
→ browser navigates to Supabase Auth → Google
→ fixed /api/auth/callback?state=...&code=...
→ compare app state/expiry, SDK exchanges code with browser-bound verifier
→ online getUser verifies identity
→ host-only HttpOnly app-session cookie; discard Google provider tokens
→ redirect to fixed homepage /

GET /api/auth/session → validate cookie → refresh if near expiry
→ online getUser → {user: {id, email, displayName}}
POST /api/auth/logout → exact Origin → verify/refresh → revoke scope=local
→ clear pending/session cookies → 204
```

Supabase owns Google OAuth state and the one-time code. The additional random app state matches the pending browser flow; PKCE proves possession of its verifier. No client-supplied return URL is accepted. Beginning a second sign-in replaces the single pending flow; use one browser tab per sign-in. Browser UI and authenticated workspace arrive in 1F.

## Files and responsibilities

- `src/server/auth/provider.ts`: request-local official `@supabase/auth-js` 2.117.2 client, transient SDK storage, bounded per-fetch timeout, code exchange/refresh/live verification/local revocation. No browser auth SDK or privileged key.
- `src/server/auth/session.ts`: cookie parsing/limits, state comparison, expiry hint, refresh and verified session result.
- `src/server/auth/routes.ts`: HTTP method/origin/query checks, fixed redirects, safe responses, cookies and request cleanup.
- `src/app/api/auth/{start,callback,session,logout}/route.ts`: thin Node/force-dynamic adapters; unsupported methods also receive non-cacheable responses.
- `src/features/account/types.ts`: strict Zod user projection; `api.ts`: non-persisting session/logout fetches. Future callers own cache clearing/cancellation.
- `src/server/config.ts`: lazy APP_ORIGIN/SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY validation. Uses publishable keys (`sb_publishable_...`), rejects secret keys, and exposes no raw input in errors. Legacy anon JWT keys are intentionally not this configuration contract.

## Cookie and request policy

On HTTPS, `__Host-mindmora-session` and `__Host-mindmora-pending` are HttpOnly, Secure, SameSite=Lax, Path=/, with no Domain. Local loopback HTTP uses unprefixed names and omits Secure for development/preview. Pending flow expires after ten minutes; session cookie lasts seven days and is renewed on refresh. Browser expiry is not provider revocation. Every accepted session request performs online `getUser`; no locally decoded user, `getSession` result or cached projection authorizes access.

The session payload includes only Supabase app access/refresh credentials and an expiry hint, not Google provider tokens/user metadata. These bearer credentials are in protected cookies, never browser JS stores, UI state, URL or returned JSON. HttpOnly does not stop XSS from issuing authenticated requests. Server-readable transport/storage trust still applies.

Cookie values are capped at 3800 encoded characters; duplicate/oversized/malformed values fail closed. Unusually large provider sessions may need a separately reviewed chunking strategy later; no truncation or partial session issuance. Expiry hints only choose when to refresh; online provider verification establishes identity. No custom signed/encrypted session protocol is implemented.

Start/logout require exact matching Origin and reject cross-site Fetch Metadata. Session GET rejects a foreign Origin or cross-site metadata when present. Callback is deliberately exempt from Origin because it is a top-level provider navigation; app state/PKCE/cookie expiry enforce the callback boundary. All auth responses, errors, redirects and refreshed cookies use `Cache-Control: private, no-store`, plus Pragma/Expires and no-referrer. Ingress must honor this policy.

## HTTP contract

| Route | Method | Result |
|---|---|---|
| `/api/auth/start` | POST, exact Origin, no query | 303 Supabase authorize redirect + pending cookie |
| `/api/auth/callback` | GET, code/state | 303 fixed homepage + app cookie; pending cookie removed |
| `/api/auth/session` | GET, app cookie | 200 strict user projection; may rotate cookie |
| `/api/auth/logout` | POST, exact Origin | 204 current-session revocation/local cleanup; no cookie is idempotent 204 |

Errors: 400 malformed flow/query, 401 rejected credentials, 403 foreign/missing mutation Origin, 405 unsupported method with Allow, 503 missing config/provider unavailable/unsafe provider response. JSON errors contain only `{error: {code, message}}`. General correlation IDs/Pino/Redis admission are 1D; interactive Swagger/generated Postman/drift tooling are 1H. The initial auth-only [OpenAPI contract](../api/openapi.json) documents current routes without credentials.

## Refresh, logout and failures

Refresh is server-side only and triggered within 30 seconds of expiry. The fresh token is verified online before issuing a new protected cookie. Network/provider errors fail closed with 503; ordinary session outages preserve the existing cookie for a later retry. Invalid/revoked sessions produce 401 and clear cookies.

Logout uses the user's access token with supported local-session revocation; it does not require an admin/service-role key or intentionally log out other devices. On remote failure, local cookies are cleared but 503 explicitly means provider revocation was not confirmed. A delayed refreshed cookie cannot authorize a revoked provider session because the next request verifies online. Client cache/draft cleanup and late-response UI suppression remain 1F/1G work.

Supabase refresh-token reuse exceptions accommodate concurrent requests. Fixture tests model controlled refresh-token reuse and independent sessions; real provider timing/revocation behavior remains a live acceptance check. SDK refresh may retry transient failures; each HTTP fetch has a ten-second timeout, not a promised ten-second whole-operation deadline.

## Live acceptance evidence — 2026-10-04

The real Next/Supabase two-session check passed 13/13: actual refresh/credential rotation,
immediate parent reuse, two concurrent refresh requests, logout/revoked original and
refreshed-cookie replay (401), revoked refresh (401), independent-session survival (200),
and cleanup (204). The app expiry hint was aged to trigger live refresh; natural JWT
expiry was not awaited. Same-user independent sessions do not establish database/RLS
isolation. Temporary test route and captured credentials were removed. Full evidence is
in the active Phase 1 plan and phase outcome record.

## Configure local Google verification

1. Fill ignored `.env` with APP_ORIGIN (usually `http://localhost:3000`), Supabase project URL and **publishable** key. `.env.example` contains placeholders; never paste keys into chat or commit `.env`.
2. In Google Cloud, configure OAuth consent/test users and a Web client. Use the exact Supabase Google-provider callback URI displayed in the dashboard. Optional `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` placeholders in ignored `.env` are a local setup reference only; the application does not read them. Put the same values in Supabase provider settings and enable Google. Filling `.env` alone does not enable the provider.
3. Set Supabase Site URL to APP_ORIGIN. Allow only the corresponding callback path with dynamic state query, for example `http://localhost:3000/api/auth/callback?state=*`. Add the explicit HTTPS equivalent when deploying; avoid a whole-origin wildcard. SDK flow ID is stored in the pending cookie, not appended to the redirect URL.
4. Run `npm run dev`. From the same-origin browser console, use this test-only POST form (UI is scheduled for 1F):

```js
const form = document.createElement("form");
form.method = "POST";
form.action = "/api/auth/start";
document.body.append(form);
form.submit();
```

5. Sign in with a disposable Google test account. Check `/api/auth/session` returns only id/email/displayName and no-store, then POST logout from the same origin. Check invalid callback/replay, expiry refresh, provider revocation and a second independent session. Record observed results in the active plan before marking live acceptance complete; do not copy tokens into tracked fixtures.

## Verification and current limits

`npm run test` exercises the actual SDK with an isolated transport fixture. `npm run test:auth` starts a disposable loopback provider, then Playwright against the production Next build. Browser tests cover the complete redirect/cookie/projection/refresh/logout path and absence of JS cookie visibility/localStorage/sessionStorage credentials. The fixture is test-only and is never imported by application routes; no production test bypass or user seeding endpoint exists.

An initial read-only live settings check on 2026-10-04 returned HTTP 200 with Google disabled. After user configuration, a fresh check returned HTTP 200 with Google enabled. The live start route redirected through Supabase to Google’s sign-in page with the configured callback and PKCE flow. The user completed Google sign-in/consent; the live app session returned the strict user projection. A same-origin logout returned 204; the same browser then received session HTTP 401 with `unauthenticated`. A subsequent live two-session check passed 13/13: actual provider refresh/rotation, immediate parent reuse, concurrent refresh, original/refreshed cookie replay rejection after logout (401), revoked refresh rejection (401) and independent B survival (200). The expiry hint was aged to trigger refresh; natural access JWT expiry was not awaited. Both sessions were cleaned up with logout 204. No cloud resource, paid upgrade or deployment was created. Redis admission/logging and private workspace security remain pending: these endpoints are not production-ready until 1D controls are integrated. Database owner/RLS and Storage policies belong to 1C/1E/Phase 4, not this auth result.

[Official Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google) · [SDK storage/PKCE guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide) · [Session/reuse semantics](https://supabase.com/docs/guides/auth/sessions) · [ADR-020](../decisions/ADR-020-backend-owned-auth-cookies.md) · [Security acceptance](../architecture/security-architecture.md)
