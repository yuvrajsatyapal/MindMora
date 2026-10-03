# API Validation, Documentation and Testing

**Status:** 📋 Planned, accepted 2026-10-03. No API, schemas, Swagger UI or Postman collection exists yet.

## Purpose

Zod checks actual form/request/job/config data at runtime; TypeScript alone cannot validate incoming JSON. OpenAPI defines endpoints, schemas, auth, errors and pagination. Swagger UI exposes that contract interactively. A generated Postman collection uses the same contract for repeatable local/staging checks.

```text
Shared Zod schemas → API input/output validation
             ↓ compatible schema generation
Versioned OpenAPI → Swagger UI
             └→ generated Postman collection
```

## Proposed files and responsibilities

- `src/features/notes/validation.ts`: bounded note create/update schemas; no client-controlled owner/plan.
- `src/server/http/errors.ts`: stable public error codes/envelope, correlation ID, safe messages.
- `src/server/config.ts`: Zod-validated server config; no logging of parsed secrets.
- `docs/api/openapi.json`: versioned machine-readable contract generated/verified as routes appear.
- `docs/api/mindmora.postman_collection.json`: generated collection with placeholder environment/session setup.
- API docs route: Swagger UI, controlled exposure in production and CSP-compatible integration.

These are plan paths, not implemented files. Select/version a compatible Zod-to-OpenAPI approach during 1H; avoid maintaining duplicate unconstrained schemas. Generated output must be reviewed and checked against routes, not blindly trusted.

## Contract requirements

Phase 1 endpoints: auth start/callback/logout/safe session; notes list/create/read/update/delete. Record supported methods, cookie/CSRF behavior, request/response validation, revisions/If-Match or equivalent, cursor pagination, error envelope and 400/401/403/404/409/429/5xx behavior. Later file/jobs/search APIs extend the same contract. Public responses never include server credentials or foreign-owner details.

Swagger's Try It feature must respect origin/CSRF and safe auth flow; document how local disposable accounts establish cookies. Postman uses callback/session fixtures or supported auth flow, not copied Google tokens in collection JSON. No real note data, bearer tokens, cookies or signed URLs in tracked examples. Restrict interactive docs as needed in production.

## Testing and explanation

Zod rejects malformed fields and length limits; permission checks independently reject valid-but-unauthorized requests. API integration tests compare actual responses/errors to the contract; drift checks fail when routes/schema differ. A collection-generation check and smoke test use disposable users. Verify Postman free feature limits before relying on cloud team/runner features. Documentation itself is not an authorization or sanitization layer.

[Zod](https://zod.dev/) · [OpenAPI specification](https://spec.openapis.org/oas/latest.html) · [Swagger UI](https://swagger.io/tools/swagger-ui/) · [Postman import/export](https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-data/)
