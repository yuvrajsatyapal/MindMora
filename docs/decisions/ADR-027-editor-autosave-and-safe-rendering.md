# ADR-027 — Snapshot autosave and bounded safe Markdown preview

**Status:** ✅ Implemented and locally validated in Phase 2, 2026-10-05.  
**Date:** 2026-10-05.  
**Scope:** Protected source editor, save coordinator and local rich preview.  
**Evidence:** [active ExecPlan](../../.agent/active/phase-02-editor.md); no production or live
provider certification follows from implementation status.

## Context

Phase 1 already provides authorized revision-scoped note operations, owner/generation
leases and PostgreSQL commit acknowledgements. Its explicit-save textarea cannot support
typing while an older save is in flight without separating the live draft from that snapshot.
Phase 2 also introduces owner-authored rich content, which must be treated as untrusted at
render time. Existing 1 MiB storage capacity is too broad for unrestricted synchronous
preview work. API contracts, persistent authority and server controls should remain intact.

## Decision

Use direct CodeMirror 6 for source document/selection/history and a memory-only React
controller for acknowledged base, draft, local sequence and captured operation. Debounce
valid changes at 1,500 ms, space automatic write starts by 5,000 ms and serialize writes
and reconciliation. Explicit save uses the same coordinator, may flush automatic delay,
and respects active operations and Retry-After. An acknowledgement adopts response text
only if no newer local edit sequence exists. New-note ID/URL binding retains the mounted
controller. `onSaved` updates committed cache data; only `onDirty` owns navigation guards.

Keep existing PostgreSQL/NotesApi authority. Create retry freezes the UUID key and exact
original normalized input; uncertain updates/deletes read before another mutation. Pause
on failures/conflicts; keeping a draft against the latest revision requires explicit save.
No blind reconnect replay or durable mutation queue is introduced.

Derive preview independently after 250 ms: unified remark parse/GFM/math → remark-rehype
without raw HTML → explicit rehype-sanitize schema → controlled React components. Raw HTML
is omitted and stored Markdown remains unchanged. Recheck URLs, render images as inert
placeholders and permit an explicit absolute-HTTPS source link only. Generic code is text.
Pre-admit preview to 256 KiB UTF-8, 2,000 markup delimiters and 5,000 lines, then bound it to 20,000 AST nodes. The delimiter/line admission follows an observed adversarial AST-fixture unit timeout during concurrent service startup; it prevents dense input from reaching the parser without claiming preemptive execution.

Load KaTeX only for math with 4 KiB expressions, `trust:false`, `throwOnError:false`,
`maxExpand:100`, `maxSize:10` and accessible HTML/MathML output. This locally generated
output is the sole audited HTML sink. Bundle fonts/CSS locally.

Load Mermaid only after Render diagram. Fixed strict security disables HTML labels,
config overrides and event binding. Reject init/frontmatter, HTML, custom CSS and
resource/click/image/icon inputs; cap source at 10 KiB, edges at 200 and admitted attempts
at three per preview generation. Serialize Mermaid's singleton render operations. Mermaid
12.1 globally selects its generated SVG for sizing, so a disposable connected offscreen
subtree is necessary. Instance-only append/insert hooks add the workspace nonce to generated
style nodes before insertion. Instance-only innerHTML reads omit those styles before Mermaid’s internal sanitizer reparses serialized SVG, whose nonce values browsers hide. Live styles remain for measurement; no global document/prototype override is used. Cleanup removes
this subtree immediately on unmount and rejects late results. The adapter is version-coupled.

DOMPurify's SVG profile plus explicit stripping removes styles, scripts/events,
foreignObject, images/animation, external resource URLs and active references. Canonical local marker fragments are retained only on marker-start/mid/end when their ID resolves to an existing marker, preserving edge direction. Fixed presentation
attributes replace custom diagram styling. Display sanitized SVG in a scriptless sandbox
with no same-origin permissions and a separate default-deny CSP; no interactive diagram
callbacks are installed.

Generate an untrusted-header-independent nonce in workspace Proxy, set request/response
CSP and private no-store headers, and pass nonce from async workspace headers to CodeMirror
and diagram measurement. Production script policy allows intended nonce scripts and
strict-dynamic without unsafe-inline/eval. Stylesheets require self/nonce; style attributes
have an explicit unsafe-inline allowance for local generated layout/shared UI. Markdown
styles remain forbidden. The frame uses fixed style attributes, with no style elements
that would conflict with the inherited workspace policy. Public routes are outside this
workspace-only policy and keep their rendering mode. Native OAuth form redirect chains allow self, configured Supabase origin and Google accounts; same-origin Referrer-Policy preserves the POST Origin required by CSRF checks. External preview links and diagram frames retain no-referrer.

## Alternatives considered

| Alternative | Reason for the selected approach |
|---|---|
| Freeze input during save | Simpler coordination, but prevents uninterrupted writing and does not meet in-flight typing behavior. |
| Treat each response as the whole current draft | An older response would erase newer typing or falsely clear saved/navigation state. |
| New autosave API, history table or Redis queue | Existing atomic revisions and keyed create solve this scope without duplicating persistent authority. |
| Blind mutation retries or automatic conflict overwrite | Can repeat uncertain work or discard remote changes; deliberate reconciliation preserves visibility. |
| Persist drafts/queues in browser storage | Conflicts with the server-authoritative memory-only architecture and expands private-data retention. |
| React editor wrapper | Additional compatibility/lifecycle dependency; direct view lifecycle is small enough for this scope. |
| rehype-raw, MDX or arbitrary HTML | Adds content execution authority beyond portable Markdown requirements. |
| Live remote images and automatically rendered diagrams | Adds tracking/resource and CPU work without an explicit user action. |
| Direct generated SVG in the workspace | Gives generated DOM/CSS broader influence; sanitizer plus scriptless frame narrows capabilities. |
| Detached Mermaid measurement | Selected Mermaid renderers query global body IDs; detached SVG cannot supply its required layout path. |
| Global DOM monkeypatch or script CSP relaxation | Instance-only insertion hooks preserve nonce policy without changing unrelated document behavior. |
| Full Mermaid theme/custom CSS | Requires preserving more note-controlled styling; fixed sanitized presentation is sufficient for Phase 2. |
| Hard deadline by Promise race | Does not preempt synchronous parser/Mermaid CPU; bounded inputs and honest limits are preferable. |

## Rationale

The local sequence answers whether this tab changed after an operation began; the server
revision answers whether PostgreSQL changed since the last acknowledged base. Both are
necessary. Existing auth/RLS/admission remain authoritative, while preview controls address
execution/resource trust rather than persistence permission. Separate preview bounds and
errors preserve editing/saving when rich content is too large or malformed.

## Trade-offs and consequences

The controller has explicit pause/conflict/reconciliation states and costs extra online
verification/read requests. Manual save may produce more traffic than automatic spacing;
server admission still governs all tabs. Failed same-tab drafts are retained only while
mounted. Cancelling a request or unmounting never guarantees rollback of a sent write.

Nonce adoption adds dynamic workspace work and a version-coupled Mermaid adapter; framework,
CodeMirror and actual browser CSP checks are needed on upgrades. Style-attribute allowance
is a deliberate compatibility trade-off, not permission for Markdown HTML/CSS or relaxed
scripts. Sanitized diagram output loses custom styles and interactive links. Bounds reduce
resource risk but do not guarantee a hard CPU deadline or forensic memory erasure.

Files, exports, queues, wiki links, AI/BYOK, plugins, permanent preferences and hosted
production acceptance remain outside Phase 2. See [feature behavior](../features/editor.md),
[state ownership](../architecture/state-management.md), [security](../architecture/security-architecture.md)
and the [dependency record](../design/dependencies.md) for their primary responsibilities.
