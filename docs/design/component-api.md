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

### Implemented status wording

Phase 1G now labels `SaveStatus` success “Saved to server”; product callers set it only after an acknowledged commit or matching reconciliation read. `SyncStatus` reports server refresh state and draft retention. The showcase remains a controlled sample and performs no persistence. See the [workspace design contract](phase-01-foundation.md).


## Editor feature composition — Phase 2

These controls belong to `src/features/editor/components`, composed by NoteEditor rather
than added to the generic UI barrel. Reuse shared Button/TextField/Alert/SaveStatus and the
semantic editor classes. [Design](phase-02-editor.md) owns interaction/layout; complete
acceptance remains in the [active plan](../../.agent/active/phase-02-editor.md).

| Export | Main props / responsibility |
|---|---|
| CodeMirrorEditor | `value`, `onChange`, `onSave`, `nonce?`, `onComposing?`, `handle?`; one labelled source view with transaction-based adoption/formatting and destroy on unmount |
| EditorHandle / FormatAction | `focus`, `format`; heading/bold/italic/list/checklist/quote/link/code selection actions |
| EditorToolbar / EditorMode | `mode`, `setMode`, `handle`; native pressed Edit/Preview/Split controls and shared formatting buttons; formatting disabled in Preview |
| MarkdownPreview | `content`, `nonce?`; separate 250 ms bounded preview, immediately retires prior source generation |
| MathBlock | `source`, `display`; bounded lazy trusted KaTeX with safe source/error fallback |
| MermaidBlock | `source`, `claimRender`, `nonce?`; explicit bounded render, fixed config, cleanup and titled scriptless SVG frame |

The controller's clean/saving/dirty/error-family phases map to existing SaveStatus values;
paused/invalid/conflict/unavailable details are adjacent alerts/actions, not new generic
status variants. Saved requires the current normalized draft to match acknowledged server
state. Cache callbacks never set draft clean. Images are alt/source placeholders with a
permitted explicit source link, and task checkboxes are disabled/read-only.
