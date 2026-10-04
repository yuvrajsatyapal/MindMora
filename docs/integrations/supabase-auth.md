# Google Authentication through Supabase

**Current:** ✅ backend auth routes and browser-safe helpers, through 1B/1C. No sign-in screen
or private workspace yet. This guide owns protocol, HTTP/cookie rules, setup and failure
behavior. [ADR-020](../decisions/ADR-020-backend-owned-auth-cookies.md) owns the decision;
[phase record](../phases/phase-01-foundation.md) owns dated local/live validation.

## Purpose and participants

Supabase manages Google identity and session lifecycle. MindMora verifies identity on the
server, keeping bearer credentials in protected cookies and exposing a minimal projection.
Google client credentials are configured in Supabase, not consumed by app auth code.
The app uses the auth-only SDK with fresh transient storage instead of a browser SDK or
custom password/session database. Auth routes do not touch application profiles/notes.

## Sign-in sequence

```mermaid
sequenceDiagram
  participant B as Browser
  participant R as handleAuth / session helpers
  participant S as Request-local AuthClient
  participant A as Supabase Auth
  participant G as Google
  B->>R: Same-origin POST start
  R->>R: Config, method, Origin and query checks
  R->>S: start(fixed app callback + random state)
  S-->>R: Authorize URL, flowId, verifier storage
  R-->>B: 303 + protected pending cookie
  B->>A: Navigate to validated authorize URL
  A-->>B: Google sign-in redirect
  B->>G: Sign-in / consent
  G-->>B: Redirect to Supabase provider callback
  B->>A: Google OAuth callback
  A-->>B: Redirect to app callback with code/state
  B->>R: GET callback + pending cookie
  R->>R: Check fields, state, code and pending expiry
  R->>S: exchange(code, recorded flowId)
  S->>A: Code + PKCE verifier
  A-->>S: App session credentials
  R->>S: verify(accessToken)
  S->>A: getUser(accessToken)
  A-->>S: User identity
  R-->>B: 303 fixed homepage + session cookie; clear pending
```

The SDK constructs the S256 challenge from its verifier state. The app captures that
storage plus SDK flowId in the pending cookie. Supabase owns provider OAuth state; the
app also checks its own random state. A browser request cannot choose a post-login return
URL. Starting another flow replaces the one pending cookie, so concurrent sign-in tabs
can invalidate each other's pending flow.

## HTTP contract and guard order

Paths below use canonical trailing slashes for browser requests; adapters reside under
`src/app/api/auth`. Configuration is checked first. If invalid, any action returns 503
before method/Origin checks. Unsupported methods are explicitly routed to the same policy.

| Path | Method / policy | Successful result |
|---|---|---|
| `/api/auth/start/` | POST; exact APP_ORIGIN; no nonempty query | 303 validated Supabase authorize URL + pending cookie |
| `/api/auth/callback/` | GET; external navigation permitted; pending state/PKCE instead of Origin gate | 303 fixed `/` + app session; pending removed |
| `/api/auth/session/` | GET; absent Origin allowed, foreign Origin or cross-site fetch rejected; no nonempty query | 200 `{user: {id, email, displayName}}`; may refresh cookie |
| `/api/auth/logout/` | POST; exact APP_ORIGIN; no nonempty query | 204 current-session revocation and cookie cleanup |

Start/logout reject missing or different Origin, and non-callback requests reject
`Sec-Fetch-Site: cross-site`. Callback accepts only singular `state`, `code`, `error`,
`error_description`, `error_code` parameters. Provider-error callbacks, absent/oversized
code, missing/expired pending flow or bad state yield a safe 400 without exposing provider
descriptions. Unsupported methods yield 405 with Allow when config is valid.

All policy responses set `Cache-Control: private, no-store`, Pragma/Expires and
`Referrer-Policy: no-referrer`. Errors expose `{error: {code, message}}`, never raw SDK
payloads. [Auth OpenAPI](../api/openapi.json) is the existing contract; broader generation,
Swagger and Postman tooling are planned. No auth admission limiter or Pino exists yet.

## Credential and cookie trust

Session cookies contain base64url JSON of `accessToken`, `refreshToken`, `expiresAt`.
They are not application-signed/encrypted cookie envelopes. The token fields and expiry
hint are untrusted; identity always comes from online provider verification. Google
provider tokens and raw user metadata are not copied into the app session cookie.

| Property | Implemented behavior |
|---|---|
| Cookie names | HTTPS `__Host-mindmora-pending` / `__Host-mindmora-session`; unprefixed on configured loopback HTTP |
| Attributes | HttpOnly, SameSite=Lax, Path=/, no Domain; Secure when APP_ORIGIN is HTTPS |
| Pending flow | Ten-minute app expiry/max-age, random base64url state, verifier storage/flowId |
| App session cookie | Seven-day max-age; renewed after server refresh; not proof of provider validity |
| Input size/ambiguity | Duplicate same-name cookies or cookie values over 3900 characters are ignored; JSON parse failures become null |
| Output size | Encoded value over 3800 characters rejected; no chunking implementation |
| Identity projection | Strict id/email/displayName; provider full_name is sliced to 200 JS string units before projection validation |

HttpOnly reduces JS token access, not authenticated XSS requests or stolen-cookie use.
Do not cache a returned projection as authorization. The SDK's `persistSession:true`
uses a fresh server Map, not browser/durable storage; auto-refresh and URL detection are
explicitly disabled. `handleAuth` disposes the SDK and clears its Map in finally after
provider operations. The database helper's differing cleanup behavior is described in the
[database guide](supabase-database.md#verified-owner-and-trusted-caller).

## Session, refresh and logout

```mermaid
sequenceDiagram
  participant B as Browser
  participant R as Auth route
  participant V as verifySession
  participant A as Supabase Auth
  B->>R: Session GET or logout POST + cookie
  R->>V: Decoded untrusted fields
  V->>V: tokenSchema validation
  opt expiresAt is within 30 seconds or earlier
    V->>A: refreshSession(refreshToken)
    A-->>V: New token tuple
  end
  V->>A: getUser(current accessToken)
  A-->>V: Verified identity
  V-->>R: projection + tokens + refreshed
  alt Session action
    R-->>B: 200 projection; new cookie if refreshed
  else Logout action
    R->>A: admin.signOut(user accessToken, local)
    A-->>R: Revocation result
    R-->>B: 204 + clear pending/session
  end
```

The SDK method name `admin.signOut` does **not** mean this call uses a service-role key:
it supplies the user's access token with local scope. Missing/corrupt decoded cookie on
logout follows idempotent 204 cleanup without provider verification; a structured but
invalid token tuple instead follows the 401 path. Other device sessions are not intentionally
revoked. A late cookie from a completed refresh still needs online verification next time.

## Failure behavior

| Failure | Result and cleanup |
|---|---|
| Config invalid | 503 auth_unavailable; early return, no cookie cleanup |
| Wrong method / Origin / non-callback query | 405 / 403 / 400; early return, no provider operation/cookie cleanup |
| Callback query/state/expiry/provider error | 400 invalid_auth_callback; pending cleared, existing session not automatically cleared |
| Missing/invalid structured credentials or rejected provider identity | 401 unauthenticated; pending/session cleared |
| Provider outage/network/unsafe response on ordinary session | 503 auth_unavailable; existing cookie preserved for a later caller retry |
| Provider failure inside logout branch | 503; local cookies cleared, remote revocation unconfirmed |
| Provider failure inside callback branch | Pending cleared; 503 normally retains an existing session; 401 clears both |

The provider maps 4xx errors other than 429 to unauthenticated; 429/5xx become unavailable.
Each SDK fetch uses a ten-second AbortSignal and no-store. The SDK can retry refresh;
there is no total ten-second operation deadline or route-level retry policy. Browser
`readSession` maps HTTP 401 to null, validates successful JSON and otherwise throws a
fixed error, including abort/network failures. `logout` resolves only on 204. Both helpers
have no page caller, persistence, automatic retry or account-cache cleanup yet.

## Setup and manual verification

1. Set ignored `.env`: APP_ORIGIN matching the browser address, project SUPABASE_URL and
   SUPABASE_PUBLISHABLE_KEY in the supported `sb_publishable_...` format. Legacy anon JWT
   keys/service-role keys are not accepted by this configuration contract. Configured
   non-loopback origins require HTTPS; the public showcase needs none of these values.
2. Configure a Google Web OAuth client/consent/test users. Use the **exact** Callback URL
   displayed by Supabase's Google provider settings in Google's Authorized redirect URIs.
   Google returns to Supabase `/auth/v1/callback`, not directly to MindMora. Put client
   ID/secret in Supabase and enable Google. Optional `.env` Google fields are reference
   placeholders only. Provider dashboard state cannot be inferred from repository files.
3. Set Supabase Site URL to APP_ORIGIN and allow the callback generated by app code,
   e.g. `http://localhost:3000/api/auth/callback?state=*`; add the explicit deployment
   equivalent when that is selected. The app callback includes state, not flowId.
4. Run the dev server. No permanent sign-in button/auth-check route currently exists.
   Ordinary Chromium form POST was exercised by the fixture browser tests:

```js
const form = document.createElement("form");
form.method = "POST";
form.action = "/api/auth/start/";
document.body.append(form);
form.submit();
```

5. The in-app browser's native form previously lacked an acceptable Origin and received
   origin_rejected. A temporary same-origin adapter was used for live verification and
   removed; it is not a current route. Do not relax Origin checks or assume fetch-following
   redirects supplies a working interactive OAuth flow. Use a browser that sends the
   required Origin or implement/review an adapter in a separately authorized milestone.
6. Use a disposable Google account and examine `/api/auth/session/`, then same-origin POST
   logout. Provider setup/acceptance should be rechecked when configuration changes;
   do not copy session credentials into tracked examples.

[Official setup reference](https://supabase.com/docs/guides/auth/social-login/auth-google)
is external guidance, not fresh provider-state verification in this docs pass.

## Evidence and current limits

The phase record preserves successful real Google/session/logout and bounded live refresh/
replay checks, with dates and natural-expiry limitations. Fixture tests use actual SDK and
Next/browser cookies against controlled provider transport. Database tests separately
exercise real PostgreSQL with fabricated test transport responses; they do not repeat
Google consent. Current results must not be extrapolated to every provider setting, reuse
interval or load pattern.

No product login/workspace, general HTTP admission/logging, custom cookie encryption,
Google Drive scope/token integration, profile creation, browser cache lifecycle or production
TLS deployment. Supabase Auth can revoke sessions; cookie presence alone cannot establish
that it has. The database is a separate integration, described [here](supabase-database.md).
