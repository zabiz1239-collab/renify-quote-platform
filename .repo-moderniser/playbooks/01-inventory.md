# Phase 1 — Inventory and audit

## Purpose

Build a factual map of the repository before deciding how it should change.

## Automated first pass

Run:

```bash
python .repo-moderniser/scripts/inspect_repo.py --root .
```

The inspector intentionally avoids reading likely secret files. Review and correct its findings; heuristics are not ground truth.

## Manual verification

Map at least:

- product purpose and user-facing entry points;
- languages, runtimes, frameworks, package managers, lockfiles, workspace tools, and generated code;
- application, service, library, shared package, infrastructure, migration, script, asset, test, fixture, documentation, and deployment boundaries;
- primary install, development, lint, type-check, test, build, release, and smoke commands;
- internal import aliases, path mappings, code generation, module boundaries, and circular dependency risks;
- CI/CD workflows, hosting configuration, containers, infrastructure definitions, release automation, and environment contracts;
- public APIs, webhooks, queues, scheduled jobs, database schemas, file formats, and integration contracts that must remain stable;
- duplicated utilities/configuration, ambiguous names, misplaced files, abandoned experiments, and likely dead files;
- existing agent instructions, task notes, ADRs, runbooks, and sources of truth;
- sensitive-looking paths by name only.

## Audit scorecard

Score each area from 0 to 3 and give evidence:

- structure and navigation;
- architecture boundaries;
- build reproducibility;
- tests and smoke coverage;
- lint/type checking/static analysis;
- documentation and operations knowledge;
- secrets and dependency hygiene;
- CI/CD reliability;
- agent instructions and durable memory;
- maintainability and known technical debt.

0 means absent or unsafe; 1 means fragile; 2 means usable with gaps; 3 means clear and verified.

## Risk classification

Classify findings as:

- **Critical** — security/data-loss risk or repository cannot be safely built/deployed.
- **High** — likely regressions, broken automation, unclear production contract, or unsafe structural work.
- **Medium** — significant maintenance cost or missing quality gate.
- **Low** — naming, consistency, discoverability, or optional polish.

## Required output

- `output/INVENTORY.md`
- `output/inventory.json` from the inspector
- `output/AUDIT_REPORT.md`
- Updated `state.yml`

Do not implement fixes during this phase except to make the inspector itself run.
