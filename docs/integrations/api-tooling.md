# API Contracts and Tooling

**Current:** Four auth Route Handlers, strict safe session projection, shared config/note
Zod contracts and an auth-only `openapi.json`. **Planned:** note endpoints, broader schema/
route generation and drift enforcement, Swagger UI and generated Postman collections.

## Existing contract boundary

The auth provider validates a shared projection before routes return it. Browser account
helpers validate successful JSON again; TypeScript alone does not validate a fetch response.
Auth HTTP policy owns methods/origins/cookies/errors. Note input/domain schemas are exported
but no note route parses them yet. [Model](../features/note-model.md) owns their exact rules.

[openapi.json](../api/openapi.json) describes auth routes without real credentials. Its
projection schema was derived from Zod during implementation; there is no current npm
script automatically regenerating the whole contract or failing on route drift. A machine-
readable file is not the same as Swagger/Postman integration or an executed acceptance test.
Its description now links the recorded live acceptance; that status is historical evidence,
not a freshly executed provider check.
[Auth guide](supabase-auth.md#http-contract-and-guard-order) owns exact guard/error behavior.

## Planned contract flow — 1H

```mermaid
flowchart LR
  Z["Shared Zod contracts"] --> G["Broader generation approach — not selected"]
  G --> O["Versioned OpenAPI"]
  O --> W["Planned Swagger UI"]
  O --> P["Planned Postman collection"]
  Routes["Actual routes"] --> Drift["Planned request/response drift checks"]
  O --> Drift
```

The selected generation library/version, interactive route/exposure policy and automated
collection runner are unresolved implementation choices. Proposed errors/admission helpers
and note/file/job APIs belong in their milestone plans, not as current source references.

## Constraints, failure and trade-offs

Contracts must describe supported methods, cookie/Origin controls, error envelope and
actual response/status schemas. Future note APIs add cursors and expected revisions; they
must not independently invent owner/plan inputs. Swagger Try It must respect cookie/CSRF
policy; exported Postman examples use placeholders/disposable fixtures, never copied tokens,
private note data or signed URLs. Production exposure/CSP/provider pricing needs review.

Sharing schemas reduces drift but generated output still needs route verification and
review. Input validity does not authorize access or sanitize content. A contract cannot
establish provider reachability, RLS effectiveness or production security. No runtime
failure of Swagger/collection generation can be described yet because those systems do
not exist. Historical API/projection evidence is in the [phase record](../phases/phase-01-foundation.md).
