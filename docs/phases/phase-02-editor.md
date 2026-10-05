# Phase 02 — Complete Editor Record

**Status:** ✅ Implemented and locally accepted on 2026-10-05 as one complete phase.
Phase 3 is unstarted; hosted/provider and production readiness remain separately gated.
The [active ExecPlan](../../.agent/active/phase-02-editor.md) owns the completed checklist,
exact commands, failure/fix history and validation ledger.

## Observed capabilities

- CodeMirror source editing, Markdown formatting, selection/history and Save shortcut.
- Edit/Preview/Split of the current draft, with both-theme responsive/keyboard behavior.
- Sanitized Markdown/GFM, local bounded math and explicit bounded Mermaid rendering.
- Immutable serialized autosave with 1.5-second idle debounce and five-second automatic spacing.
- Server-confirmed saved state that retains typing during earlier writes and binds new IDs without remounting.
- Explicit conflict, throttling and uncertain-write recovery with same-tab draft retention.
- Workspace nonce CSP and scriptless sanitized diagram sandbox, without relaxing production script policy.
- Preview failure isolation and source/title composition gating.

## Architecture and flow

CodeMirror owns source transactions/history. The controller separately owns the draft,
acknowledged revision and active operation. Existing note APIs/session leases/repositories
remain the persistence and authorization boundary. Preview is derived from draft memory,
with an AST sanitizer and controlled block renderers; it supplies no save authority.

```text
CodeMirror / Title -> memory draft -> serialized immutable snapshot
                   -> existing note API -> auth/Origin/owner/revision/RLS -> PostgreSQL
PostgreSQL acknowledgement -> new base + retain newer typing -> scoped memory cache

Draft -> bounded Markdown AST -> sanitizer -> controlled preview
                                     -> bounded local KaTeX
                                     -> explicit Mermaid -> nonce measurement
                                          -> style-free serialization -> SVG sanitizer
                                          -> empty-permission scriptless iframe
```

The Mermaid 12.1 adapter nonces live measurement styles before insertion, then omits styles
from serialized clones before its internal sanitizer reparses HTML with nonce values hidden
by the browser. Hooks belong only to the disposable subtree; no global DOM patch. Geometry
and valid local arrow markers survive final sanitization. Revalidate this adapter on upgrades.

## Validation evidence and boundaries

Fresh checks passed: lint, typecheck, 177 unit tests, production build, API drift/contracts,
7 actual PostgreSQL/RLS tests plus migration/provisioning checks, 12 HTTP/PG/Redis note tests,
5 Redis tests, 3 compiler/request-time boundary checks, 4 startup tests plus launch scenarios,
19 protected E2E tests and 14 public E2E tests. Dependency audit reported zero vulnerabilities.
The final rich-preview test also passed after bringing diagrams into view for screenshots.
Exact commands and documentation checks are in the ExecPlan.

Browser fixtures use actual SQL/Redis and controlled Auth transport; they do not certify
fresh live Google sign-in or deployment. Axe covers the parent editor at 375/768/1440 in
both themes with reduced motion, excluding the opaque scriptless iframe because it cannot
accept Axe scripts. Frame title, source fallback, rendered labels/geometry, empty sandbox,
script-src none and absence of executable markup are checked separately. Only Chromium's
exact denied Playwright iframe-bootstrap warning is expected; other console/CSP errors fail.
Composition uses synthetic browser events, supplemented by controller tests.

## Intentional limits and deferred work

Drafts are memory-only and may be lost on refresh/close. Recovery is deliberate; there is
no offline queue, automatic merge or durable browser knowledge store. Preview admits less
than the 1 MiB save capacity and does not preempt CPU with a worker. External images are
inert placeholders with explicit permitted links. Diagram presentation is fixed and
noninteractive; custom styles/config/click handlers are unavailable.

Links/backlinks/search are Phase 3; attachments/Storage/exports/workers are Phase 4.
History, graph/canvas, task aggregation, AI/BYOK, plugins, billing and deployment stay out of
scope. No server API/schema changes, hosted writes, paid resources, branches or commits.

## Documentation homes

[Editor behavior](../features/editor.md) · [Design](../design/phase-02-editor.md) ·
[ADR-027](../decisions/ADR-027-editor-autosave-and-safe-rendering.md) ·
[Current architecture](../../ARCHITECTURE.md) · [Security](../architecture/security-architecture.md) ·
[Learning](../LEARNING.md) · [File map](../FILE_MAP.md)
