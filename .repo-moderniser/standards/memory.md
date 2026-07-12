# Standard — portable project memory

## Purpose

Repository memory lets a future coding session recover durable context without depending on chat history or one vendor's private auto-memory. It must be useful to humans as well as agents.

## Memory layers

### Long-term memory — `.ai/memory/LONG_TERM.md`

Store durable, verified knowledge:

- product purpose and non-obvious domain language;
- architecture and dependency direction;
- package/service ownership boundaries;
- important runtime and deployment facts;
- stable commands and environment assumptions;
- public APIs, data contracts, and protected behaviours;
- recurring patterns and deliberate exceptions;
- links to ADRs and canonical docs;
- high-impact lessons that prevent repeated mistakes.

Do not store temporary task status, raw logs, speculative ideas, secrets, or a full changelog.

### Short-term memory — `.ai/memory/SHORT_TERM.md`

Keep a concise hand-off for the current work:

- current goal and branch/task reference;
- active plan slice;
- files or areas recently changed;
- latest validation results;
- open blockers and decisions needed;
- next concrete action;
- date last updated.

Replace stale task detail rather than appending forever. Keep it below the configured line budget.

### Decisions — `.ai/memory/DECISIONS.md` and `docs/decisions/`

Use the memory file as an index. Put material decisions in ADRs containing context, decision, alternatives, consequences, and status.

### Known issues — `.ai/memory/KNOWN_ISSUES.md`

Record only verified issues or clearly labelled suspected risks. Include evidence, impact, workaround, owner/status when known, and links to tests/issues.

### Backlog — `.ai/tasks/BACKLOG.md`

Capture work intentionally deferred from the current task. Do not silently expand the migration scope to solve it.

## Truth and uncertainty

- Store verified facts as facts.
- Label assumptions, hypotheses, and stale information explicitly.
- Link to the source of truth instead of copying volatile values.
- Never store credentials, tokens, private keys, personal data, production records, or secret values.
- Review memory whenever architecture, commands, deployment, or public contracts change.

## Conflict resolution

When memory conflicts with code, tests, CI, or deployment configuration, investigate and update the stale source. Do not blindly trust memory merely because it is labelled long-term.
