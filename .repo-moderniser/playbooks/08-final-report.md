# Phase 8 — Completion report and hand-off

## Purpose

Produce a trustworthy, reviewable account of what changed and what remains.

## Completion report contents

`output/COMPLETION_REPORT.md` must include:

- repository and branch/commit context;
- modernisation profile and any overrides;
- before/after architecture summary and target tree;
- all meaningful file moves and boundary changes;
- permanent agent/orchestrator/memory files created or reconciled;
- quality, CI, GitHub, security, and documentation improvements;
- baseline-versus-final command table with exact results;
- pre-existing failures and new failures, clearly distinguished;
- smoke evidence;
- files quarantined or intentionally retained;
- assumptions and unverified areas;
- deferred backlog items;
- rollback guidance;
- reviewer checklist;
- final status: completed, completed with exceptions, or blocked.

## Permanent short-term memory

Update `.ai/memory/SHORT_TERM.md` so the next coding session can begin without reading the entire migration history. It should name current status, latest validation, known blockers, and the next recommended action.

## State

Set `state.yml` to `completed` only when every definition-of-done item is satisfied. Use `completed_with_exceptions` when the repository is coherent but environmental limits or documented pre-existing failures prevent full verification. Use `blocked` when the migration itself remains unsafe or incomplete.

Do not claim success based only on file creation.
