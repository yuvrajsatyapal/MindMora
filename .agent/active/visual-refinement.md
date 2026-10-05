# Phase 1 visual refinement

## Goal and current state
2026-10-05: user authorizes removing generic UI styling before Phase 2, with neutral black/
charcoal dark mode and unchanged light palette. Phase 1 CRUD exists; homepage is a placeholder
Card, workspace nests navigation/editor Cards, theme control exists only in showcase.
Authority: PRODUCT_SPEC.md, AGENTS.md, docs/design/design-system.md. Phase 2 is unstarted.

## Scope / acceptance
- Public homepage has distinct product-led composition, honest implemented capabilities and
  functioning workspace/design-system navigation.
- Dark theme uses neutral charcoal surfaces and neutral accents in explicit and system modes;
  light semantic palette remains byte-for-byte unchanged.
- Workspace has continuous navigation/document framing, readable typography, clear save and
  error states, theme control, same accessible field/action names and existing CRUD behavior.
- Both themes at 375/768/1440, keyboard focus, reduced motion and Axe checks pass.

## Architecture / data models / flow
Presentation only: static homepage -> ThemeProvider/CSS -> navigation -> existing authenticated
WorkspaceShell -> unchanged note scope/cache/API/server. No new data models or persistence.
Theme is temporary React context, not stored in browser storage. No private data on homepage.

## Files and milestones
1. Design: docs/design/visual-refinement.md and ADR-026 record neutral dark palette and layout.
2. Test-first: homepage navigation/theme semantics, browser theme contrast/reflow/reduced motion.
3. Implementation: src/app/page.tsx, src/app/globals.css, src/design-system/tokens.css,
   WorkspaceShell.tsx, SignInGate.tsx, NotesWorkspace.tsx, NoteList.tsx, NoteEditor.tsx.
   Reuse existing Logo, Icon, Button, ThemeSelect; no new libraries.
4. Validate npm run lint/typecheck/test/build/test:e2e/test:auth; applicable auth browser tests
   cover real local SQL/Redis saves and unchanged boundary behavior.
5. Update README/ARCHITECTURE/LEARNING/FILE_MAP/design docs; review PRODUCT_SPEC requirements
   unchanged. Record outcomes here; stop for review, no commit/deploy/Phase 2.

## Edge cases and boundaries
Long note titles wrap without page overflow; narrow layouts stack list/editor; unsaved drafts,
uncertain saves and revision conflicts retain existing behavior. Session gates and private cache
cleanup stay intact. Theme changes never clear a draft. No fake folders/backlinks/preview modes,
WebGL workload, new API, authentication change or expensive animation. No external assets.

## Decisions
TasteSkill applies to public redesign audit; frontend-design applies intentional composition.
Dials: variance 6, motion 3, density 3 public / 6 workspace. System sans retains native reading
comfort and avoids external fonts. User-approved charcoal supersedes old green dark tokens.
Native CSS reveals one homepage composition; no continuous animation, scroll hijack or canvas.
Three.js/GSAP/21st.dev are optional suggestions, not a requirement to add dependencies.

## Progress / evidence
- [x] Inspect architecture, current UI and local Next server/client guide.
- [x] Design and red behavior tests.
- [x] Implement visual changes.
- [x] Fresh validation and visual review.
- [x] Documentation and handoff.

### Observed execution
Homepage component test failed meaningfully against the old placeholder heading, then passed
with real workspace/showcase links, explicit example labeling and theme projection. Adding
ThemeSelect required mounting workspace tests under the existing root ThemeProvider. First
build rejected passing a Lucide glyph function through a client Icon wrapper from the Server
Component; direct Lucide rendering fixed the serialization boundary while preserving static
prerendering. Running initial typecheck concurrently with build raced generated .next types;
after build completion typecheck passed. Subsequent checks are sequential where generated
artifacts are shared. Public E2E first run passed new homepage checks but failed one old
system-dark color expectation; updated it from green to charcoal, then all 14 passed.
Manual review caught excessive mobile header wrapping; compact accessible Refresh session
icon and a two-row brand/theme/account grid resolved it. Final validation rerun below uses
that version. No speculative backend fix or dependency additions.

### Final validation — PASS
- npm run lint: ESLint and semantic-style contract pass.
- npm run typecheck: strict TypeScript pass, after completed build.
- npm test: 130 tests / 20 files pass.
- npm run build: pass; homepage and workspace shell remain prerendered.
- FORCE_COLOR=0 npm run test:e2e: 14 Chromium checks pass, both-theme Axe, 375/768/1440,
  system/explicit overrides, keyboard, reduced motion and private credential exclusion.
- FORCE_COLOR=0 npm run test:auth: 13 Chromium checks pass, actual local Next/PostgreSQL/Redis
  with controlled Auth transport, including save/reload/rename/delete, conflicts, uncertain
  writes, session isolation/late response cleanup, both-theme reflow/Axe and draft retention.
- Light palette comparison: all 25 existing semantic color/elevation roles unchanged.
- Manual screenshot review: dark homepage at 375/768/1440, light desktop, and dark workspace
  at 375/1440; generated both-theme screenshots at all three checkpoints.
- Documentation checker: 49 Markdown files / 563 local links / 22 npm references, no errors;
  git diff --check pass. 18 Mermaid blocks are unchanged; no fresh diagram rendering claimed.
- Read-only local development homepage GET returned 200; queued local homepage in Codex panel.

README, ARCHITECTURE, LEARNING, FILE_MAP, documentation index, workspace/design guides and
ADR-026 updated. PRODUCT_SPEC reviewed and unchanged: no requirement/status scope moved;
Phase 1 already implemented, this follow-up changes presentation only. Existing source
navigation rows were updated for actual theme/icon callers; no future files added.

- [x] Fresh validation and visual review.
- [x] Documentation and handoff.

Limits: browser provider is controlled, not a new live Google acceptance. Native system font
appearance varies by platform. Theme resets on reload. Homepage example is static authored
content; Markdown preview/folders/autosave are not introduced. No fresh hosted note mutation,
server/schema/config/credential change, dependency addition, commit, branch or deployment.
Changes remain on main for review. Phase 2 remains unstarted.
