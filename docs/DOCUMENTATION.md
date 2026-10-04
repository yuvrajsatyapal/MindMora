# Documentation authoring standard

Use this standard for future implementation and documentation updates. Inspect current
source before writing; a plan, installed dependency or passing fixture is not proof of a
production behavior. Keep PRODUCT_SPEC authoritative and historical evidence dated.

## Primary homes

| Document | Primary responsibility |
|---|---|
| Root README | Project overview, prerequisites, setup, practical development commands and concise current status |
| ARCHITECTURE | Authoritative current components, runtime/data ownership, client/server and trust boundaries, subsystem interactions and failure boundaries; separate planned architecture |
| LEARNING | Plain-English concepts, mental models, end-to-end flows and progressive source-reading order |
| FILE_MAP | Grouped navigation: important files, responsibility/why, exports, callers/dependencies and related files |
| Integration/security/feature docs | Exact subsystem behavior, validation, permissions, external services, failures and limitations |
| ADRs | Context, decision, alternatives considered, why this approach, trade-offs and consequences |
| Active plan | Live scope/checklist, implementation progress, decisions, exact commands and observed results |
| Phase record | Dated observed outcomes and validation evidence, with links to the active checklist |

Each explanation has one primary home. Cross-link instead of copying large explanations
or validation ledgers. README links to deep guides; FILE_MAP remains navigational. Do not
put agent milestone request templates or agent permission/workflow instructions in README.

## Teaching a significant subsystem

Explain its purpose and the problem it solves. Start LEARNING sections with the concept
before code: concept → why needed → current implementation → system flow → important code
→ security implications → trade-offs → files to read next.

Follow the flow from its actual trigger to its actual end: participating components,
data exchanged, ownership, dependencies and external services. Explain authentication
separately from authorization; identify trusted/untrusted inputs, where validation runs,
and the roles/permissions enforcing access. Describe concrete failure behavior: rejection,
rollback, cleanup, retry, preserved state and surfaced errors. State limits honestly,
including gaps for which the code does not reveal intent. Do not invent a reason for a gap.

Use Mermaid for architecture, request/auth/database flows, integration boundaries and
important state transitions when it improves understanding. Do not diagram folders. Label
planned nodes/flows; validate each arrow against actual calls and data, and do not imply a
transaction or guarantee across systems that cannot commit together.

ADRs document meaningful architecture choices, not trivial implementation details. Record
reasonable alternatives and trade-offs without inventing benchmarks or historical debates.
Distinguish a rationale supported by existing requirements from an unrecorded author intent.
Preserve superseded decisions as historical, with clear status and successor links.

## Status and evidence

Use 📋 Planned, 🚧 In progress, ✅ Implemented and ❌ Removed/superseded. Explicitly label
validation separately: implemented code can still have pending provider/production checks.
Use blocked or deferred with the reason and remaining action; do not present them as passes.
Date results, record exact relevant commands, counts, outcomes and limitations when evidence
exists. Distinguish unit mocks, browser fixtures, local PostgreSQL, hosted PostgreSQL, live
Google acceptance and production verification. Never relabel historical runs as fresh.

For application work update affected docs after validation and before the review handoff.
For documentation-only work check references and source consistency; application tests are
not required and must not be claimed as run. Preserve historical test failures and fixes.
The active plan owns live checkboxes; a phase record is not a second competing checklist.

## Final quality check

1. Compare statements with source and distinguish current from future behavior.
2. Check referenced files, exports, callers, commands and environment variables.
3. Check local links/anchors and Mermaid syntax/flow; report tooling limits honestly.
4. Remove stale claims and cross-document contradictions; reduce unnecessary duplication.
5. Check decisions include alternatives, rationale, trade-offs and consequences.
6. Check sensitive flows describe trust, validation, permissions, failures and limitations.
7. Back every validation claim with observed evidence; leave unresolved questions explicit.
8. For docs-only work verify application/config artifacts remain unchanged from the task baseline.

[Documentation index](README.md) · [Execution plan standard](../.agent/PLANS.md).
