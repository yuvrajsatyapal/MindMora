# Design system and showcase ExecPlan

## 1. Goal
Deliver the shared UI language and working /dev/design-system reference requested on 2026-10-03, implementing PRODUCT_SPEC §4.1 and §8.1 theming within the boundaries of the approved logo.

## 2. Current state
Inspection: documentation-only repository, no package.json, source, runtime or tests. Node 22.22.3/npm 10.9.8 available. Approved logo assets exist in the prior design deliverable and will be copied intact.

## 3. Scope and acceptance
Design tokens, themes, component library, controlled domain presentation patterns, static showcase, tests and documentation. All npm lint/typecheck/test/build checks plus static-output Playwright pass. Both themes keyboard accessible, responsive at 375/768/1440, reduced motion respected. Token/style contract prevents arbitrary styles.

## 4. Out of scope
Application feature screens, storage, accounts, Drive, actual notes/tasks/canvas/graph behavior, persistent settings, PWA, deployment. Minimal root page links to showcase; no feature shell.

## 5. Architecture
Next static export hosts React controlled components. tokens.css is visual authority; component CSS and Tailwind semantic aliases consume it. Complex interactive primitives use Radix. Local React state is specimen state, not shared application/store or persisted knowledge. No remote services.

## 6. Data flow
User interacts with specimen → local React state/callback → shared component renders. Theme selection → session context/document data-theme → semantic variables → all components including portals. No data saved or synced.

## 7. Files
- package.json/package-lock.json, next.config.ts, tsconfig.json, postcss.config.mjs, eslint.config.mjs: reproducible static tooling.
- src/design-system/tokens.css, components.css: shared foundation and component contracts.
- src/components/ui/{index,primitives,overlays,theme,brand}.tsx: core exports, controls, accessible overlays, theme and approved brand.
- src/components/mindmora/index.tsx: controlled workspace patterns.
- src/app/{layout,page,globals}.tsx/css and src/app/dev/design-system/{page,showcase}.tsx plus showcase.css: static entry and reference only.
- public/brand/: approved SVGs.
- src/tests/setup.ts, src/components/ui/primitives.test.tsx, tests/e2e/design-system.spec.ts: behavior and browser evidence.
- scripts/check-styles.mjs, scripts/preview.mjs: token enforcement and local static preview.
- docs/design/design-system.md, docs/design/dependencies.md: design contract and dependency evidence.
- README, ARCHITECTURE, docs/{README,FILE_MAP,LEARNING}.md, docs/phases/phase-01-foundation.md: accurate implemented status.

## 8. Models
Only presentation types: ThemePreference, save/sync state discriminated unions and component props. No IDs/timestamps persisted, no database schema or migrations.

## 9. Authorized milestone
One requested design-system milestone: (a) design/plan, (b) minimum framework/test bootstrap, (c) red component tests, (d) tokens/components/showcase and green tests, (e) static browser validation and docs. Stop after this milestone for user review. This does not authorize the remaining Phase 1 notes milestones.

## 10. Edge cases
Long content and mobile wrapping; theme system changes and explicit overrides; loading/disabled duplicate activation; invalid field descriptions; empty specimens; keyboard overlays/focus return; reduced motion. Refresh restores system theme by design. Network/storage retries and concurrent knowledge changes are out of scope; status components expose these future states without implementing persistence.

## 11. Tests
Vitest/RTL for accessible fields, busy controls, task callback and theme control. Playwright against exported output for dialog, tabs/menu, theme, responsive overflow, motion and axe. npm run lint includes token contract. npm run typecheck; npm run test (non-watch); npm run build. Record failures and successes below; npm audit investigated rather than force upgraded.

## 12. Documentation
Design doc precedes source. Update file map and learning with implemented paths and flow. Phase 1 record acknowledges only bootstrap/design-system work, not completed note foundation. Product spec unchanged.

## 13. Decisions
System fonts avoid downloads and work offline once loaded. Tailwind semantic roles only. Native simple controls plus Radix complex controls reduce accessibility maintenance. CSS motion avoids a runtime animation dependency for this scope. Dependencies verified against official docs and npm registry, exact versions locked. Brand copied from finalized Junction M. No redundant state libraries until a feature needs them.

## 14. Progress
- [x] Inspect repository and approved logo.
- [x] Record design and execution plan.
- [x] Bootstrap/verify dependencies.
- [x] Observe intended behavior tests fail before implementation.
- [x] Implement tokens, components and showcase.
- [x] Pass static/browser/accessibility checks.
- [x] Update docs with actual evidence and stop for review.

### Verification — 2026-10-03

- Red: initial five component contract tests failed for intended missing behavior, not missing modules/tooling.
- Green: six component tests pass; native caller descriptions added as a regression case.
- Lint and semantic-style contract pass. Strict TypeScript passes.
- `npm run build` exports `/` and `/dev/design-system` successfully using Webpack. Turbopack's CSS evaluator could not bind its port in this environment; scripts now use supported Webpack mode.
- Nine Chromium E2E tests pass against the static export: both themes axe WCAG checks, dialog focus trap/Escape/return, tabs/menu/task keyboard actions, 375/768/1440 responsive widths, 320px reflow, OS/explicit theme precedence, reduced motion, no runtime errors/external requests.
- Visual inspection: desktop light/dark review; teal brand retained with quiet layered surfaces and outlined Junction M wordmark.
- Contrast failure found and fixed: light accent badges were 4.25:1; `--accent-text` now uses darker teal on pale backgrounds. Theme assertions wait for background transitions to settle before running axe.
- `npm audit` after lint-tool replacement: zero vulnerabilities. ESLint 9 is pinned for jsx-a11y peer compatibility and carries an upstream lifecycle warning; see dependency record.
- CI workflow created but no hosted run observed. No Docker, deployment, product persistence, Drive, or feature redesign.

### Handoff

All requested design-system work is complete. Review `/dev/design-system`. The next authorized-by-request milestone would integrate these primitives into the Phase 1 workspace shell; do not begin it automatically. Theme remains session-only until authenticated server preferences are implemented. Automated axe checks are evidence for these rendered specimens, not a blanket accessibility certification of future screens.

### Architecture revision — 2026-10-03

This completed milestone retains static UI validation as historical evidence. The [Phase 1 plan](phase-01-foundation.md) now targets runtime Next.js, Google sign-in, PostgreSQL/Drizzle and server-confirmed saves. Its migration is planned, not authorized by this handoff alone. Preserve the shared UI and samples; no Dexie/encrypted vault remains active scope.
