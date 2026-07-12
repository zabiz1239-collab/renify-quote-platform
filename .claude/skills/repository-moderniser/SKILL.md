---
name: repository-moderniser
description: Audit and safely modernise an existing application repository by preserving behaviour, creating a stack-native structure, adding AGENTS.md/CLAUDE.md, a portable .ai orchestrator and memory layer, documentation, validation, and GitHub hygiene. Use for legacy repo cleanup, restructuring, agent-readiness, or one-off standardisation; do not use for unrelated feature development or broad framework upgrades.
---

# Repository moderniser

Modernise the current repository using the installed `.repo-moderniser/` engine.

## Required inputs

Read, in order:

1. Existing applicable project instructions and documentation.
2. `.repo-moderniser/START_HERE.md`.
3. `.repo-moderniser/moderniser.yml`.
4. `.repo-moderniser/ORCHESTRATOR.md`.
5. The numbered playbook for the active phase and its relevant standards.

## Workflow

1. Run the safe repository inspector.
2. Complete preflight, inventory, baseline, and the risk-ranked plan.
3. Continue through implementation, permanent agent/memory creation, quality improvements, full validation, and the completion report.
4. Work in small reversible slices and update `.repo-moderniser/state.yml`, the migration log, docs, and memory after each material slice.
5. Use the framework's real conventions. Do not force a generic architecture.
6. Preserve observable behaviour and public/deployment/data contracts unless explicitly approved.
7. Never expose secret values, force-push, push, deploy, modify production data, or call write-capable external services.
8. Stop only for a genuine external blocker, destructive action, overlapping uncommitted user work, or material business/API ambiguity. Finish independent safe work first.
9. Do not claim completion until the structural validator and all available project-specific quality gates have run and the full diff has been reviewed.

## Outputs

Produce and maintain every required file under `.repo-moderniser/output/`, plus project-specific permanent `AGENTS.md`, `CLAUDE.md`, `.ai/`, and documentation files. Clearly distinguish pre-existing failures, new regressions, blocked validation, and deferred backlog work.
