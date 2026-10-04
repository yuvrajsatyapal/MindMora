# Implemented file-map runtime flows

**Date/status:** 2026-10-05 — ✅ Complete, awaiting review. Documentation-only user request.

## Goal and scope

Rewrite docs/FILE_MAP.md with six distinct fields: linked file path, short purpose,
important exports, callers, dependencies and high-level runtime flow. Include one small
ASCII flow after each major subsystem. Existing map combines callers/dependencies and
some subsystem rows omit exports/flow. Only map existing implemented files; explicitly
identify test-only callers and implemented helpers without product callers.

## Files and flow

Inspect existing imports/exports/callers → rewrite FILE_MAP public UI, startup, auth,
HTTP/admission/logging, contracts/database, privileged CLI and verification sections →
validate source paths, links, table columns and arrows → compare non-Markdown baseline.
AGENTS and docs/DOCUMENTATION persist the requested format for future milestones.
No application, credentials, schema, contract, product requirement or milestone changes.

## Five-document review

FILE_MAP requires changes. README setup, PRODUCT_SPEC status/scope, ARCHITECTURE boundaries
and LEARNING concepts remain accurate after the prior documentation sync; this request
changes navigation format only, so those four need no factual change.

## Verification and handoff

Check links/anchors/fences/script references, six-column row completeness, actual paths
and source-matched callers/exports/flow; hash tracked/untracked non-Markdown files and .env
against task baseline. No application tests required or claimed for prose-only changes.
Stop for review, keep 1E unstarted, no commit/deployment.

- [x] Inspect map, important source exports/imports and expected scope.
- [x] Rewrite map and persist format.
- [x] Validate references/source integrity; stop for review.

## Results — 2026-10-05

Rewrote FILE_MAP with 88 unique existing file rows and all six separate fields.
Seven ASCII subsystem flows cover UI, startup, auth, HTTP/admission/logging, database,
CLI and verification. Tests and helpers without product callers are explicit. Draft
ASCII validation caught a malformed branch newline and a Unicode left arrow; corrected
both before handoff. AGENTS/DOCUMENTATION preserve the requested format.

`python3 /tmp/mindmora-1d-docs-check.py`: 41 Markdown files, 396 local links, 19 Mermaid
blocks and 17 script references, zero errors. File-map structure/path validation: 88
complete six-field rows, unique existing paths and seven ASCII blocks. `git diff --check`
passes. Runtime arrows/exports/callers checked against source; no external renderer run.
Non-Markdown source/config plus ignored .env hashes unchanged from task baseline. No
application tests rerun for this prose-only task; no commit, deployment or 1E work.
Stop for review.
