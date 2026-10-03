# Component API and contribution guide

Import from `src/components/ui` for general controls and `src/components/mindmora` for knowledge patterns. All components consume `src/design-system/tokens.css` through shared CSS. Do not import database tables into either directory.

## Core inventory

| Export | Main props / contract |
|---|---|
| Logo | `iconOnly?`; approved path artwork; accessible brand name |
| Icon | `icon`, `size?: sm/md/lg`; decorative only |
| Button | native button props; `variant?: primary/secondary/ghost/danger`, `loading?`; default type button |
| IconButton | required `label` and Lucide `icon`; always 44px target |
| TextField / TextArea / Select | native element props plus required `label`, optional `hint`, `error`; associated descriptions and invalid semantics |
| Checkbox | native checkbox props, visible children label |
| Switch | `label`, controlled `checked`, `onCheckedChange`, `disabled?` |
| Badge / Tag | static content classification; Badge `tone?`; use a button for actions |
| Kbd | keyboard shortcut text, not a shortcut registration |
| Card / Separator | neutral content grouping and semantic separator |
| Alert | `title`, children, `tone?`, `urgent?`; urgent only for newly surfaced errors |
| EmptyState | `title`, children explanation, optional `action` |
| Skeleton | static loading bars with accessible `label`; no mandatory motion |
| Dialog | single focusable `trigger`, `title`, `description`, children; focus trap/Escape/return via Radix |
| Tabs | accessible `label`, nonempty `items` of value/label/content; automatic arrow activation |
| Menu | focusable `trigger`, `items` of label/onSelect/disabled; keyboard selection via Radix |
| Tooltip | single focusable child and supplemental `content`; child still needs its own name |
| Toast | nullable `message`, `onDismiss`; polite persistent feedback until dismissed |
| ThemeProvider / ThemeSelect | session-only system/light/dark projection; system CSS works before hydration |

Buttons forward native props and React 19 refs through their props, so Radix asChild triggers can manage focus. Do not pass a fragment or non-focusable container as an overlay trigger. Do not nest buttons inside another button. Current patterns expose only needed variants; add composition APIs when a real feature demonstrates a need.

## MindMora inventory

| Export | Controlled data and responsibility |
|---|---|
| NoteRow | title/excerpt/meta, selected, onSelect; selection display only |
| WikiLink | href, missing, children; caller resolves navigation and missing-note creation |
| BacklinkItem | href, title, context children; no link-index computation |
| TaskRow | checked, onCheckedChange, disabled, label children; caller owns draft or persistence |
| SaveStatus | unsaved / saving / saved / error; saved requires a confirmed server commit |
| SyncStatus | disconnected / offline / syncing / synced / error; presentation only; future refresh/job status independent from server note-save success |
| CanvasCard | title, body children, optional footer; no canvas dragging or graph engine |
| PropertyRow | name/value children inside a caller-provided dl |

## Extending the system

1. Check the exports before creating a new control. Prefer composing existing pieces.
2. Give new styling a semantic token when it represents a reusable decision; never add raw feature colors or arbitrary Tailwind brackets.
3. Record purpose, states, keyboard behavior, narrow layout, light/dark behavior and accessible names in the design doc.
4. Add examples to `/dev/design-system`, including failure/empty/loading states where applicable.
5. Add behavior tests before implementation, then browser coverage for focus, keyboard, and reflow changes.
6. Run lint (including style-contract), typecheck, tests, build, and E2E.

The lint contract blocks common style escapes; it is not a complete design reviewer. Human review still checks whether a new class is appropriate and whether component reuse was possible. Semantic token changes require both-theme visual review and contrast checks. Breakpoints and geometrical transforms are documented CSS exceptions, not new brand styles.

### Existing status wording awaiting runtime integration

The current controlled `SaveStatus` source still labels success “Saved on this device” with a local-commit comment; `SyncStatus` includes local-file/sync wording. These are existing showcase behavior, not implemented server semantics. Phase 1G will update the labels/comments and affected tests/specimens to server-confirmed saves and suitable refresh/job states before using them in the authenticated product. This documentation revision leaves source untouched.
