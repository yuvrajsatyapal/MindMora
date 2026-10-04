# ADR-020 — Backend-Owned Supabase Auth Cookies

**Decision:** Implemented 2026-10-04, Milestone 1B. Dated fixture/browser/live evidence is
in the [phase record](../phases/phase-01-foundation.md); this ADR owns rationale, not the live test log.

## Context

MindMora requires a browser-safe identity projection and HttpOnly credentials. A standard
browser-managed Supabase session would expose tokens to JavaScript for refresh. The initial
auth milestone also had to preserve public pages without adding profile/session tables.

## Decision

Use the auth-only official SDK with fresh server clients and transient Map storage. Carry
SDK PKCE verifier storage/flowId plus random app state in a protected pending cookie. Store
only app access/refresh credentials and expiry hint in the protected session cookie; online
getUser decides identity, and server refresh/local-scope logout own lifecycle. Fixed redirects,
exact mutation Origin and no-store responses protect the HTTP boundary.

Cookie payloads are encoded JSON, not application-signed/encrypted envelopes. Their fields
are not identity authority; provider verification is. Exact mechanics/limits/guard order
belong in the [auth guide](../integrations/supabase-auth.md).

## Alternatives considered

- Standard browser/SSR Supabase session integration: maintained default, but browser token
  handling does not meet the chosen HttpOnly boundary.
- Opaque cookie with custom DB/Redis session authority: could avoid bearer tokens in the
  browser cookie, but adds sensitive token storage/schema/coordination and duplicate lifecycle.
- Handwritten provider REST/PKCE: reduces SDK dependency but duplicates maintained protocol work.

## Why this approach

Reuse supported provider exchange/refresh/verification/revocation while projecting no
tokens into browser JavaScript. The auth-only package avoids adding an unused broader
Storage/database SDK. Lazy configuration lets public pages remain available before setup.
This is the documented boundary choice, not proof of immunity from XSS or compromised cookies.

## Trade-offs

Online verification adds latency/availability dependence. Cookies still hold bearer
credentials; HttpOnly does not stop same-origin authenticated requests or stolen-cookie
use before provider invalidation. Cookie size is bounded and chunking absent. One pending
flow limits parallel sign-in tabs. Concurrent refresh depends on provider reuse behavior;
SDK retry duration can exceed an individual fetch timeout. Native in-app-browser form
Origin behavior required a temporary adapter for prior live verification, now removed.

## Consequences

No browser auth SDK, token UI store, app password/token table or Google provider-token
persistence. Current pages have no sign-in/workspace consumer. General admission/logging
and cache/draft cleanup remain later milestones. `handleAuth` explicitly disposes its
provider; the existing database verification helper does not yet do so and must be assessed
when integrated. Every private adapter must verify its own request and propagate refresh
cookies, rather than trusting a cached projection or the mere existence of a cookie.

[Auth source navigation](../FILE_MAP.md#backend-auth-and-browser-projection) ·
[Security](../architecture/security-architecture.md) · [ADR-016](ADR-016-supabase-auth-and-server-data.md).
