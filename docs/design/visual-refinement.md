# Visual refinement before Phase 2

Status: ✅ Implemented and validated locally, 2026-10-05. User-authorized before Phase 2.

## Design read / audit
Personal knowledge workspace for focused reading and writing. Public page evolves from a
placeholder card into a product introduction; protected workspace evolves from nested cards
into navigation beside a document. Preserve Junction M, routes, action names, field order,
light palette and privacy disclosures. Remove green dark surfaces, oversized workspace masthead
and repeated boxed framing. Existing system sans, semantic components and 44px targets remain.
No SEO route migration; existing title/description remain accurate.

## Palette, type and layout
Dark: canvas #181818, navigation/surface #141414, raised #202020, hover/selection #292929,
text/accent #E6E6E6, muted #ADADAD, divider #383838, control/focus #808080/#E6E6E6.
Errors/warnings retain semantic colors. Light palette remains as implemented. Neutral focus
and selection also use outlines/aria-current, rather than relying on color alone.
System sans: tight large homepage headline; compact workspace chrome; large document title;
monospace Markdown source remains an explicit editable field. No external font request.

```
Public:    wordmark                        theme / design reference
           A place for                    Static example note
           your thinking.                 title / prose / margin note
           introduction + workspace link
           one concise workflow section / privacy disclosure
Workspace: brand / workspace                  theme / account actions
           list controls / server refresh status
           note navigation | title
                           | Markdown source
                           | save state / Save note / delete
```

Homepage example is explicitly static and uses authored public text. It demonstrates writing,
not folders, links, rendered Markdown or fake live account data. No fabricated stats/reviews.
Workspace continuity is established by structure and typography, not decorative imagery.

## Interaction, responsive and accessibility
Only real navigation/actions appear interactive. ThemeSelect is available on homepage and
workspace and remains session-only. Save/error semantics, native labels, draft guards and
session admission remain unchanged. Sidebar toggle uses aria-expanded and aria-controls.
Skip link targets the homepage main. Keyboard focus uses global visible outline; no new traps.
At <=768px homepage and workspace stack; decorative margin note is hidden, controls wrap;
long note titles wrap and editor remains min-width:0. At 375px CTA and text fit within gutters. Workspace header uses brand/theme then a single account row; Refresh session keeps its accessible name with a compact icon.
At 1440px spacious homepage and full-height reading surface; at 200% reflow no fixed overlay.
Single opacity/translate entry is <=480ms, only homepage; reduced motion removes it. Hover
feedback comes from existing controls. No parallax, continuous motion, 3D or scroll hijacking.

## Review against brief
Charcoal is explicitly requested, not an arbitrary dark-tech accent. Boldness is concentrated
in the homepage type scale. Repeated feature cards and a cinematic scene would compete with
the user's actual notes; document framing carries product identity. No new dependencies or
service obligations. See ADR-026 and the active visual-refinement plan for fresh evidence.
