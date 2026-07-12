# Standard — agent instructions and orchestration

## Canonical instruction file

Use root `AGENTS.md` as the concise cross-agent source of truth. It should tell a coding agent how to navigate, run, validate, and safely change the actual repository.

A useful root file includes:

1. project purpose and critical contracts;
2. repository map with links to deeper docs;
3. exact setup/run/lint/type-check/test/build/smoke commands;
4. architecture and coding conventions;
5. protected paths and prohibited actions;
6. planning and change workflow;
7. documentation/memory update rules;
8. definition of done.

Keep it specific and short enough to load reliably. Put long procedures in linked playbooks, skills, or docs.

## Scoped instructions

Add nested `AGENTS.md` or `AGENTS.override.md` only when a subdirectory genuinely has different commands, risks, or conventions. Do not scatter identical instruction copies across the tree.

## Claude compatibility

Use a short root `CLAUDE.md` that imports `AGENTS.md`:

```text
@AGENTS.md
```

Add Claude-specific notes only when necessary. Do not maintain two divergent copies of the same rules.

## Skills

Use a repository skill for repeatable, multi-step procedures rather than enlarging always-loaded instructions. A skill should have one clear job, explicit inputs/outputs, safety boundaries, and validation steps.

## Orchestrator model

The permanent `.ai/orchestrator.yml` is a project workflow contract, not an autonomous production process. It should define:

- phases and roles;
- command catalog;
- required evidence and quality gates;
- protected paths and external blockers;
- memory update points;
- completion and hand-off criteria.

Subagents may parallelise read-only discovery or independent review. Serialize overlapping code changes and reconcile all results through one plan.

## Instruction quality

Instructions should be:

- executable: name exact commands and paths;
- bounded: state what not to do;
- evidence-based: reflect the repository rather than generic preferences;
- non-contradictory: remove stale alternatives;
- maintainable: update when commands or architecture change;
- verifiable: state how “done” is tested.
