# Start here — repository modernisation

You are operating inside an existing application repository. Your goal is to improve its maintainability and agent-readiness **without losing behaviour, history, data, deployment compatibility, or framework conventions**.

## Read order

Before changing any application file, read:

1. Existing root instructions and documentation, including `AGENTS.md`, `CLAUDE.md`, `README*`, contribution guides, architecture notes, and deployment files.
2. `.repo-moderniser/moderniser.yml`.
3. `.repo-moderniser/ORCHESTRATOR.md`.
4. Every numbered playbook in `.repo-moderniser/playbooks/` as you reach that phase.
5. The relevant standards under `.repo-moderniser/standards/`.

Then run the repository inspector:

```bash
python .repo-moderniser/scripts/inspect_repo.py --root .
```

Use `python3` instead of `python` when required by the environment.

## Required outcome

Complete all non-blocked phases, not merely the audit. The finished repository must have:

- a verified, stack-appropriate structure;
- concise, project-specific `AGENTS.md` instructions;
- a `CLAUDE.md` importing `AGENTS.md` unless an existing arrangement is better and documented;
- a permanent `.ai/` orchestrator and portable long-term/short-term memory layer;
- current architecture, testing, operations, and decision documentation proportional to the app;
- reliable commands for install, development, linting, type checking, testing, building, and smoke verification where the stack supports them;
- safe GitHub repository hygiene appropriate to the repository;
- a complete audit, migration plan, migration log, and completion report with evidence.

## Non-negotiable safety rules

- Preserve observable behaviour by default.
- Never read, copy, print, commit, or move secret values. You may list the path of a likely secret file without reading its contents.
- Never force-push or push automatically.
- Never change production data, run destructive database migrations, rotate credentials, or call write-capable external services.
- Never replace a framework's standard layout with a generic layout merely for visual consistency.
- Never delete an uncertain file. First prove it is unused, record the evidence, quarantine it when practical, and verify the app without it.
- Never combine broad dependency upgrades, framework upgrades, new features, and structural migration into one change set.
- Do not hide baseline failures. Distinguish pre-existing failures from regressions introduced by the migration.

## How to work

Operate in small, reviewable slices:

1. inspect and record;
2. establish the baseline;
3. propose the target structure and risk-ranked plan;
4. implement one coherent slice;
5. update references and documentation;
6. run the relevant validation;
7. record the result;
8. continue to the next slice.

When a safe assumption can be made, state it in the migration log and continue. Pause only for a genuine external blocker, an irreversible action, or ambiguity that could change business behaviour or data.

## Completion test

Do not declare completion until the structural validator passes, all available quality gates have been run, the final diff has been reviewed for accidental changes, the permanent memory has been populated, and `.repo-moderniser/output/COMPLETION_REPORT.md` states what was and was not verified.
