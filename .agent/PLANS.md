# MindMora Execution Plan Standard

An ExecPlan is a living, self-contained implementation contract, not a product spec.
Use it for multi-file features, architecture or schema changes, integrations, significant
refactors, and new phases. Small isolated fixes can use a brief written plan.
Store plans under `.agent/active/`; never rely on chat history for required context.

## Required structure

1. **Goal:** concrete user-visible outcome and links to product requirements.
2. **Current state:** inspected facts, existing files/tooling, implementation status, date.
3. **Scope:** included deliverables and acceptance criteria.
4. **Out of scope:** explicit boundaries that prevent unrelated feature work.
5. **Architecture:** participating layers, responsibilities, state ownership, constraints.
6. **Data flow:** step-by-step runtime flow; Mermaid where it helps.
7. **Files:** exact paths to create/modify, responsibility of each, and meaningful test files.
8. **Data models:** proposed types, IDs, timestamps, validation, table indexes and migrations;
   distinguish proposals from implemented schema.
9. **Milestones:** small independently reviewable deliverables. For each include goal,
   architecture, file responsibilities, data flow, tests, commands and expected outcomes,
   concepts to learn, documentation updates, and stop boundary.
10. **Edge cases:** offline, refresh, failed storage/network, retries, corruption, empty
    state, missing URL IDs, concurrent changes. Assign each to a milestone.
11. **Tests:** unit/component/E2E matrix. Use red → green → refactor for behavior; record
    commands and observed failures/passes during execution. Never call unrun checks passing.
12. **Documentation:** exact docs to update and when an ADR/design doc is required; follow
    [documentation authoring standard](../docs/DOCUMENTATION.md) and its primary homes.
13. **Decisions:** rationale, alternatives, open questions, deviations, ADR references.
14. **Progress:** checkboxes, dated outcomes, validation evidence, limitations, next milestone.

## Milestone execution

Before implementation, read `AGENTS.md`, the spec, this standard, and relevant docs.
Explain the requested milestone and expected changes. Bootstrap necessary tooling before
running its first behavior test; do not claim missing-tool failures are meaningful test failures.
Write and run the behavior test to demonstrate failure, implement the minimum, run targeted
tests, refactor, then run the required checks and relevant E2E tests.

Afterward update this plan, phase record, file map, learning notes, and affected docs.
Report the important files, flow, concepts, exact verification, and limitations. Stop after
the authorized milestone; a plan is not authorization to implement every listed milestone.

## Status and maintenance

Use 📋 Planned, 🚧 In progress, ✅ Implemented, ❌ Removed. Start as planned, with
unchecked milestones. Record surprises and decision changes as they happen. Completion
requires working behavior, successful applicable checks, and accurate documentation.
Distinguish implemented from validated; date exact commands/results and identify fixture,
local, hosted, live-provider and production evidence separately. Mark blocked/deferred
checks with reasons and remaining actions; do not rewrite old outcomes as fresh passes.
For documentation-only reviews validate references/source consistency without claiming
application tests ran. Keep one execution checklist here; phase docs link to it and record actual phase outcomes.
Do not expand `PRODUCT_SPEC.md` without explicit user authorization.

## Full-stack planning requirements

Current authority: PRODUCT_SPEC v3, ADR-016/018/019. Plans must distinguish the implemented Node runtime/public UI from remaining backend milestones and capture session/CSRF, verified owner/RLS roles, Zod API contracts, revision conflicts, in-memory cache cleanup, Pino redaction and service quotas. For job work define separate worker hosting, idempotency/retries/timeouts, outbox/reconciliation and private result authorization. For files define Storage policy/content/size/retention and partial-failure cleanup. No browser knowledge persistence, E2EE vault, MinIO or automatic Drive sync. Deployment/provider credentials/payment remain separate authorized actions. Keep later phases high-level until their work begins.
