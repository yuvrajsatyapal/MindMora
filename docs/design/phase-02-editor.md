# Phase 2 editor design

**Status:** ✅ Implemented and locally validated, 2026-10-05. Scope is the [complete editor plan](../../.agent/active/phase-02-editor.md), using existing semantic tokens and ADR-026. No new brand palette.

## Experience and layout

The existing document surface contains title, compact formatting controls, Edit/Preview/Split mode controls, source/preview panes and persistent save status/actions. Desktop Split uses two equal flexible columns; mobile uses a single pane with source followed by preview when Split is selected, with each pane labelled. Preview derives from the live draft. Long code, tables and diagrams scroll inside their pane; the page does not overflow. Source is editable while saving. Images show alt/source and an explicit external-link action, never automatic network loading. Mermaid shows source and an explicit Render diagram action. Errors affect a block, not the document.

## Keyboard and focus

Initial selection focuses Title. Tab reaches the labelled Markdown content textbox and exits it normally; indentation does not trap Tab. Standard undo/redo and source IME remain CodeMirror responsibilities; source and Title composition both pause autosave until composition ends. Formatting buttons keep the source selection and return focus to it. Primary-modifier+S flushes the save controller; no browser Save Page action. Mode controls use accessible native buttons with aria-pressed. Switching mode preserves the mounted editor/history; keyboard focus moves to a visible control when a pane is hidden. No custom palette/keymap modes.

## Status and recovery

Saved to server appears only for the acknowledged current draft. Saving, unsaved, invalid, paused/cooldown, conflict and unavailable remain visible, with polite status and urgent inline error. Conflict shows current server title/source as escaped text alongside the retained draft. Use server version discards deliberately; Keep draft selects the latest base but requires explicit Save now. Failed writes retain same-tab text; refresh/close can lose it. Delete/navigation/sign-out require existing discard guards.

## Accessibility and responsive review

Reuse shared Button/TextField/Alert/SaveStatus. Persistent source/preview labels, descriptive iframe titles, noninteractive task checkboxes and accessible math output. Use semantic color roles in both themes; no color-only state or essential animation. Verify keyboard/IME, focus/undo preservation, 375/768/1440 widths, reduced motion, long text/code/table, both-theme Axe and production CSP in the browser. Acceptance evidence belongs in the active plan; this document itself is not proof of passing checks.
