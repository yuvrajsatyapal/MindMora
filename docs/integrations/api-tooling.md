# API contracts and interactive reference

**Status:** ✅ Implemented for Phase 1 auth and note APIs. The checked-in contract contains
no deployment credentials, provider tokens or private note examples. Validation evidence
belongs in the [active ExecPlan](../../.agent/active/phase-01-foundation.md).

## One schema source and reviewed operation metadata

[Shared note validation](../../src/features/notes/validation.ts) and
[response schemas](../../src/features/notes/types.ts) own runtime payload shapes.
[The generator](../../scripts/generate-api-docs.mjs) uses Zod 4's built-in `toJSONSchema`
with input semantics, rather than a second schema library. It combines generated schemas
with [reviewed metadata](../api/operation-metadata.json) for routes, responses, headers,
cookies and security. Metadata is the editable source; do not manually edit generated
[OpenAPI](../api/openapi.json) or [Postman](../api/mindmora.postman_collection.json) outputs.

`npm run api:generate` regenerates both outputs; `npm run api:check` compares exact bytes
and validates local references, concrete Route Handler inventory/exported methods and
facade admission rules. `npm run test:contract` tests that unsupported/missing operations
and unresolved references fail. These checks deliberately require reviewed metadata when
route admission rules change. They do not prove every runtime response status by themselves;
auth/note integration and browser checks provide that evidence.

JSON Schema cannot express UTF-8 byte length, Unicode code-point counts, NUL rejection or
all refinements. The generator documents those enforced Zod restrictions and explicitly
adds PATCH's at-least-one-changed-field rule. The runtime remains authoritative. Browser
and Postman tools cannot bypass runtime validation, owner checks or admission.

## Swagger execution boundary

`/dev/api-docs` lazy-loads `swagger-ui-react` 5.33.1 (Apache-2.0), with SSR disabled from a
Client Component as required by the installed Next.js guide. The server page is dynamic:
it is available in development and returns 404 outside development unless
`API_DOCS_ENABLED=true` is explicitly configured. This opt-in exposes a public API reference;
it does not grant private API access. Swagger's remote validator is disabled and auth
persistence is disabled. The outgoing interceptor allows only the current origin's `/api/`
paths, rejects embedded URL credentials, and uses same-origin cookies. Editable server or
request fields therefore cannot send app requests and session cookies to another origin.

Google start/callback execution is rejected by the API console: establish sign-in through
the application's top-level Google flow. Normal browser mutations send the native Origin
header and still pass the backend's Origin/CSRF controls. A logged-in developer can issue
real note writes from Swagger, so use disposable notes. No credential is embedded in the
specification, client module or collection.

## Postman and executable smoke

Import the generated collection and set `baseUrl` to your local application origin. The
only supplied variables are localhost, disposable UUIDs and empty callback placeholders.
Use a local cookie jar after legitimate app sign-in; never export cookies or credentials.
Create/PATCH/DELETE examples contain disposable titles, empty content and expected revisions.
Set `noteId` from the create response and update revisions when doing requests manually.
Collection test scripts check documented status membership and private no-store headers.
OAuth callback placeholders are documentation, not a replayable authentication flow.

`npm run test:api-collection` executes all generated requests against a running disposable
localhost runtime (`API_SMOKE_BASE_URL` defaults to `http://localhost:3000`). It uses manual
redirect handling and checks actual statuses, no-store and correlation headers. Without
`API_SMOKE_COOKIE`, it verifies unauthenticated/admission behavior; this is not authenticated
CRUD evidence. With an in-memory disposable local cookie it asserts session and complete
create/list/get/update/delete success, including commit-confirmed revisions. It never prints
or writes the cookie. Auth start/callback/logout run only in unauthenticated mode; authenticated smoke does not revoke the disposable CRUD session. Never run it against production.

```text
Shared Zod schemas + reviewed operation metadata
             |
        generate / drift check
             |
     OpenAPI + Postman collection
       |                 |
 Swagger same-origin   localhost smoke
       |                 |
      Existing auth / note HTTP security and services
             |
       Owner-scoped PostgreSQL
```

See [auth/session integration](supabase-auth.md), [note API](../features/notes-api.md) and
[security architecture](../architecture/security-architecture.md) for runtime boundaries.
