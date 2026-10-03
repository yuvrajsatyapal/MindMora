# MindMora design system v1

Status: ✅ Implemented and verified for the showcase scope.

## Intent and scope

A quiet, precise workspace language for user-owned knowledge. Carry forward the approved Junction M, teal #087F73, ink #162A2A, mint #70E0C5, paper #F6F8F5 and night #102322. Extend these with documented neutral surfaces and semantic feedback colors. This milestone creates the shared system and /dev/design-system only. It does not implement or redesign notes, Drive, graph, canvas, AI or persistence.

## Visual structure

An editorial reference page with a compact left index, an understated brand masthead, numbered sections, wide specimen areas, and side-by-side usage notes. White/paper light surfaces and layered deep-green dark surfaces; teal reserved for primary actions, selection, links and focus. No gradients, decorative dashboard metrics or marketing cards. Mobile moves the index into an in-flow wrapping navigation; specimens stack without horizontal page overflow.

## Token contract

CSS custom properties are the source of truth in src/design-system/tokens.css. Three levels: brand primitives, semantic roles, component/layout aliases. Light and dark define the same roles. Tailwind v4 exposes semantic roles only; remove the default palette. UI consumes roles such as --surface, --text, --text-muted, --accent, --on-accent, --border-control, --danger rather than brand hex values.

Typography: local system sans stack for interface and reading; local monospace for code, shortcuts and identifiers. No web-font request. Scale 12/14/16/20/24/32/48 px equivalent rem values; body line-height 1.6, controls 1.25, headings 1.15. Normal/medium/semibold weights. Reading width 68ch. Use native semantic headings, never choose a heading solely for its size.

Spacing: 4px base with 0/1/2/3/4/6/8/12/16 steps (0–64px). Radii: 4px controls-small, 8px controls/cards, 12px dialogs, full for status dots/pills. Borders: 1px structural, 2px emphasis/focus; control boundary has stronger contrast than decorative dividers. Shadows: none by default, low elevation for raised elements, overlay elevation for dialogs/menus. Layer tokens: navigation, floating menu, overlay, dialog, toast. Content width, navigation width, minimum touch size and reading width are named layout tokens.

## Interaction and accessibility

WCAG 2.2 AA target: normal text at least 4.5:1; large text and meaningful boundaries/focus at least 3:1. Every interactive element gets a visible focus-visible ring with offset; never remove without replacement. Targets at least 44px by default, with compact controls still receiving a 44px hit area. State differences use text/icons/structure as well as color. Disabled controls use native disabled semantics. Loading buttons retain their action label, announce busy state and prevent duplicate activation. Inputs have persistent labels and associated hint/error text. Errors use aria-invalid and are never placeholder-only.

Native checkbox/select/details for their native behaviors. Accessible primitive library for modal focus trapping, escape, focus return, tabs, menus and tooltips. Tooltips supplement accessible names; essential instructions remain visible. Dialogs have titles/descriptions. Toasts use polite live feedback; urgent save failure remains inline. Reduced-motion preference removes animations and transitions. Keyboard-only and mobile browser verification are required.

Icons: Lucide outline vocabulary, 20px default, 16px for metadata, 24px for emphasis, 1.75 stroke. Decorative SVGs hidden from accessibility tree. Icon-only buttons require an explicit accessible name. Junction M is a brand asset, not a navigation glyph. Do not substitute an AI sparkle for local storage or synchronization.

Motion: 120ms feedback, 180ms overlays, standard ease-out. Animate opacity/transform only when necessary, never layout or essential information. Avoid perpetual loading animation for reduced-motion users; retain a text loading label.

## Component inventory

Core: Logo, Icon, Button/IconButton, TextField/TextArea/Select, Checkbox, Switch, Badge/Tag, Kbd, Card, Separator, Alert, EmptyState, Skeleton, Tooltip, Dialog, Tabs, DropdownMenu and Toast feedback. Native disclosure covers simple collapsible content. Showcase demonstrates default, hover/focus via real interaction, active/selected, disabled, loading, invalid and empty states.

MindMora: NoteRow, WikiLink (resolved/missing), BacklinkItem, TaskRow, SaveStatus, SyncStatus, CanvasCard and PropertyRow. These are controlled presentation components: props in, callbacks out. SaveStatus separates unsaved/saving/saved/error; only a future caller with a confirmed server commit may pass saved. SyncStatus separately expresses disconnected/offline/syncing/synced/error. Presentation components do not enforce authentication; future workspace APIs require it. No database imports, simulated durable writes, graph engine or AI runtime.

## Theme and responsive behavior

System is the default, projected by CSS media query before JavaScript. Light/dark/system control is session-only in this milestone; React state projects an explicit document data-theme. Do not persist theme in localStorage: durable preferences belong to future authenticated PostgreSQL settings APIs. Dialog/menu portals inherit document tokens. Responsive checkpoints 375/768/1440px, plus 200% zoom/reflow. Components should wrap long titles, filenames and tags.

## Governance

All future UI imports shared components from src/components/ui and MindMora patterns from src/components/mindmora. Composition may add layout using semantic tokens. New variants require a documented purpose, showcase specimen, keyboard behavior, and tests. Do not copy component CSS into features. A style-contract check rejects raw colors, arbitrary Tailwind values and inline style props in application code; token definitions and documented geometric icon paths are exceptions. Changing a token requires reviewing both themes and contrast. The showcase is a public prerendered developer reference on the Node runtime, not a protected route.

## Verification and source references

Test controlled component behavior, theme precedence, invalid field association, busy button blocking, and task changes. Browser checks cover public routing, keyboard dialog escape/focus return, tabs/menu, narrow layout, reduced motion, and automated axe checks in both themes. Automated checks supplement manual visual review.

- https://nextjs.org/docs/app/guides/static-exports
- https://tailwindcss.com/docs/theme
- https://www.radix-ui.com/primitives/docs/overview/accessibility

## Developer handoff

See [component contracts](component-api.md) for imports, props, extension steps, and controlled-data boundaries; [dependency record](dependencies.md) for exact versions/licenses and tooling trade-offs. The implementation uses Next's supported Webpack mode because this environment prevents Turbopack's CSS subprocess from binding its evaluation port. Both dev and build scripts consistently use that mode; output now uses the Next Node runtime after Milestone 1A.

Contrast adjustment: `--accent-text` uses #05675D for small text on pale teal in light mode. The approved #087F73 remains the logo/primary-action color. In dark mode, accent text remains mint. This resolves the measured 4.25:1 badge contrast failure.

Verification: six component tests and nine static Chromium E2E tests pass; lint, strict typecheck, static build and dependency audit pass. Browser checks include both-theme axe checks, keyboard focus, 320–1440px reflow, system theme and reduced motion. Hosted CI and assistive-technology user testing are not claimed.

## Full-stack target revision — 2026-10-03

Historical implementation and test evidence above remain static UI evidence. Current target uses runtime Next.js/backend APIs, server-confirmed saves, private API no-store behavior and in-memory query state; no Dexie/vault or browser knowledge persistence. Milestone 1A preserved specimens/tokens and migrated runtime tooling, rerunning all nine showcase browser checks. See [ADR-018](../decisions/ADR-018-full-stack-server-storage.md).

### Existing status wording awaiting runtime integration

The current controlled `SaveStatus` source still labels success “Saved on this device” with a local-commit comment; `SyncStatus` includes local-file/sync wording. These are existing showcase behavior, not implemented server semantics. Phase 1G will update the labels/comments and affected tests/specimens to server-confirmed saves and suitable refresh/job states before using them in the authenticated product. This documentation revision leaves source untouched.
