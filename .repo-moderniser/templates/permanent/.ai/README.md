# Project AI operating layer

This directory contains portable project context for coding agents and human maintainers. It is version-controlled and vendor-neutral.

- `project.yml` — machine-readable repository identity, stack, commands, entry points, contracts, and protected paths.
- `orchestrator.yml` — workflow phases, roles, gates, memory updates, and completion policy.
- `memory/LONG_TERM.md` — durable architecture and operating knowledge.
- `memory/SHORT_TERM.md` — concise current-task hand-off.
- `memory/DECISIONS.md` — index of material decisions and ADRs.
- `memory/KNOWN_ISSUES.md` — verified defects, risks, and workarounds.
- `tasks/BACKLOG.md` — prioritised work intentionally deferred from the active task.

## Maintenance rules

- Keep facts verified and link to canonical code/docs.
- Label assumptions or stale information.
- Never store secret values, personal data, production data, or raw chat transcripts.
- Update this layer in the same change set when architecture, commands, deployment, or protected contracts change.
