# Phase 4 — Permanent agent, orchestrator, and memory layer

## Purpose

Create a concise, vendor-compatible project operating layer that remains after the temporary moderniser is removed.

## Templates

Use `.repo-moderniser/templates/permanent/` as a starting point, never as finished content. Replace every placeholder with verified repository facts or an explicitly labelled unknown.

## `AGENTS.md`

Reconcile the existing file rather than blindly replacing it. The permanent root file should be concise and practical, covering:

- project purpose and important boundaries;
- repository layout and where more context lives;
- supported setup, run, lint, type-check, test, build, and smoke commands;
- coding and architecture conventions actually used here;
- protected contracts and do-not rules;
- expected planning, validation, documentation, and review behaviour;
- definition of done;
- links to `.ai/` and relevant docs.

Move lengthy procedures into linked files. Remove the temporary moderniser block when the permanent content is complete, but keep the temporary kit until final validation.

## `CLAUDE.md`

Prefer a short file beginning with:

```text
@AGENTS.md
```

Add Claude-specific instructions only when they differ genuinely. Do not duplicate the full canonical instructions.

## Permanent `.ai/` layer

Populate:

- `.ai/orchestrator.yml` with the actual commands, roles, gates, protected paths, and done criteria;
- `.ai/project.yml` with the actual project identity, stack, package/workspace map, commands, entry points, deployment, and contracts;
- `.ai/memory/LONG_TERM.md` with durable, verified knowledge;
- `.ai/memory/SHORT_TERM.md` with the current migration hand-off and next action;
- `.ai/memory/DECISIONS.md` with links to existing and new ADRs;
- `.ai/memory/KNOWN_ISSUES.md` with verified issues and evidence;
- `.ai/tasks/BACKLOG.md` with deferred work outside the migration.

Long-term memory stores durable facts. Short-term memory stores current goal, active branch, latest changes, validation state, blockers, and next steps. Do not turn either file into a transcript.

## Documentation

Create or reconcile the architecture, decisions, operations, and testing docs. Keep a single source of truth and link to it rather than copying the same facts into multiple files.

## Required output

- Permanent files above with no unresolved template placeholders
- Agent-layer section in `output/MIGRATION_LOG.md`
- Updated `state.yml`
