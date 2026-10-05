# ADR-026: Neutral dark theme and document surfaces

Status: ✅ Accepted and implemented, 2026-10-05.

## Context
The user rejected teal in dark mode and generic boxed UI before Phase 2, requesting a
minimal charcoal appearance inspired by their Obsidian reference. Light mode should retain
its palette. Existing shared semantic tokens and accessible primitives are established.

## Decision
Use neutral charcoal dark surfaces and off-white primary actions/selection/focus. Keep
semantic error/warning/success colors and the light palette. Compose the protected workspace
as continuous navigation and a document surface, rather than nested cards. Retain Markdown
source and explicit save behavior. The public introduction is prerendered and typography-led,
with an explicitly static authored example note. Theme selection remains temporary context.
Use existing Lucide glyphs and native CSS for one reduced-motion-aware entry sequence.

## Alternatives / rationale
- Recolor only: low risk, but leaves the repeated Card framing the user rejected.
- GSAP/Three.js spectacle or imported component kit: can create visual drama, but adds
  dependencies/runtime cost and competes with focused reading. User suggested these as options.
- Replace shared components/fonts: broader brand/accessibility churn; existing primitives
  and local system fonts already serve keyboard, loading, validation and responsive needs.

## Trade-offs and consequences
Neutral accents make primary action contrast and selected-state structure more important.
Selection also uses aria-current, weight and an inset marker; focus remains explicit.
System fonts avoid network/font-loading cost but have platform variation. Native motion
has limited choreography, appropriate for the chosen quiet visual direction. Layout changes
require fresh both-theme reflow/contrast and real save/conflict browser checks. No dark theme
preference persistence, folders, rich preview, autosave or future-phase claims are introduced.

[Design contract](../design/visual-refinement.md) ·
[Execution evidence](../../.agent/active/visual-refinement.md)
