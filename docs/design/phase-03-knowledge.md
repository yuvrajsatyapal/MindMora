# Phase 3 knowledge workspace design

Status: ✅ Implemented frontend composition. Validation is recorded in the Phase 3 execution record.

Knowledge controls extend the current document workspace. The existing neutral surfaces, typography, spacing, border, focus and accent tokens remain authoritative. Search and tags live in the sidebar. Backlinks occupy a collapsible secondary section after the save/recovery controls below the document, including at narrow widths; this avoids squeezing the editor and retains a consistent focus order at 320px. Current draft tags sit below the editor with a provisional label. Counts, backlinks and search describe committed data.

A labeled plain text search input and tag buttons drive server search. Results use real lists, plain text snippets and explicit loading, empty, retry and load-more controls. The selected tag has a pressed state and clear control. Search/tag state stays in React memory; only UUID note selection reaches the URL.

Preview wiki references render as buttons without href, using shared eligible-prose syntax. Collision-free source markers preserve references crossing emphasis nodes; after Markdown sanitization the admitted markers become internal spans with plain text labels. Raw source HTML and arbitrary links never obtain these controls. Activation resolves the title through the scoped API. A unique target follows the existing dirty-draft discard guard. Missing targets show an explicit confirmation with proposed title; a create operation freezes its idempotency key/input and retries that pair after uncertain responses. Duplicate titles show ambiguity and never choose a target automatically. Renames do not rewrite source Markdown.

CodeMirror completion stays within the mounted editor lease and installs the existing autocomplete extension. Suggestions have listbox semantics and support arrows, Enter and Escape. Composition suspends requests/insertion; stale prefix and account generation responses are discarded. Completion inserts portable title syntax and preserves undo history. Source autosave, conflict and recovery controls remain independent of knowledge failures.

Wiki controls and backlink sources are keyboard reachable, status messages announce fetch/create errors, and all knowledge selection uses the shared navigation guard. Missing creation confirmation uses the browser focus-restoring confirmation already used by the workspace. Empty/disabled knowledge states retain source editing. No essential action requires hover or animation. Panels wrap at 320px; reduced motion follows existing tokens. Light/dark, zoom, contrast and axe evidence belongs in the execution record rather than an unverified design claim.

Flow: source draft → shared syntax → inert preview action → scoped resolution → optional explicit creation → guarded UUID selection. Server search/tags/backlinks → scoped query memory → semantic sidebar/panel → same guarded selection.
