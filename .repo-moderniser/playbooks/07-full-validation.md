# Phase 7 — Full validation and regression review

## Purpose

Prove the repository is at least as functional as the baseline and that the new structure is internally consistent.

## Structural validator

Run:

```bash
python .repo-moderniser/scripts/validate_modernisation.py --root .
```

Resolve errors. Warnings may remain only when justified in the completion report.

## Full available gates

Repeat every safe baseline command under the same conditions, then run any new focused tests or commands added during migration. Record exact command, exit code, and result.

## Smoke verification

Verify the smallest realistic user or service path without writing production data. Depending on the project, this may be:

- app starts and a health/home route responds;
- CLI shows help and one read-only command works;
- package imports and a representative API call executes locally;
- mobile/web build completes and the first screen renders in an available environment;
- infrastructure validates or plans without applying.

When runtime verification is impossible, say why and identify the strongest substitute evidence.

## Diff review

Review the entire change set for:

- changed behaviour not named in the plan;
- stale or case-mismatched paths;
- broken imports, aliases, scripts, assets, fixtures, snapshots, containers, CI, and deployment references;
- accidental secret or `.env` inclusion;
- lockfile churn without an intended dependency change;
- generated files that should not be committed;
- unexpected binary/file-mode/line-ending changes;
- duplicated or contradictory instructions;
- unresolved placeholders or claims not supported by evidence.

Use `git diff --check` and inspect the status/summary. Do not mark the phase complete while an unexplained regression remains.

## Required output

- `output/VALIDATION_REPORT.md`
- Validator output JSON/Markdown
- Updated `state.yml`
