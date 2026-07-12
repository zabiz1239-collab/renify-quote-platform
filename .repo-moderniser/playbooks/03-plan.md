# Phase 3 — Target structure and migration plan

## Purpose

Choose the smallest useful target architecture and turn it into reviewable, testable slices.

## Target structure rules

1. Start with the detected framework's conventions and the current public/deployment contract.
2. Preserve a working conventional layout. Do not add `src/`, `services/`, `domain/`, or other layers merely because they are fashionable.
3. Create a layer only when it clarifies an actual responsibility, dependency direction, ownership boundary, deployment unit, or reuse boundary.
4. For monorepos, keep applications, packages, services, infrastructure, and tooling boundaries explicit; do not flatten them.
5. Keep generated code, database migrations, platform-specific files, assets, and deployment configuration in locations expected by their tools.
6. Prefer an incremental target tree that can be reached through validated slices.

## Plan format

For each slice include:

- identifier and objective;
- evidence/problem addressed;
- files/directories affected;
- behaviour and contracts that must remain unchanged;
- dependencies on earlier slices;
- risk: low, medium, high, or blocked;
- exact validation commands/checks;
- rollback method;
- documentation and memory updates;
- status.

Include a proposed target tree and a mapping from current paths to target paths. Mark unchanged areas explicitly so reviewers understand the scope.

## Separate workstreams

Keep these distinct in the plan:

- permanent agent/memory layer;
- file and module organisation;
- dead/duplicate file cleanup;
- tests and quality commands;
- documentation;
- GitHub/CI/dependency hygiene;
- deferred product defects and feature work.

## Required output

- `output/MIGRATION_PLAN.md`
- Updated `state.yml`

## Gate

The plan may proceed automatically under the configured profile when changes are reversible and supported by baseline evidence. Material public API, data model, runtime, framework, or production workflow changes require explicit approval and are out of scope by default.
