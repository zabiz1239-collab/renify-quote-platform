# Repository modernisation completion report

## Status

{{COMPLETED_COMPLETED_WITH_EXCEPTIONS_BLOCKED}}

- Date: {{DATE}}
- Repository/branch: {{CONTEXT}}
- Profile: {{PROFILE}}
- Baseline: `BASELINE.md`
- Validation: `VALIDATION_REPORT.md`

## What changed

{{CONCISE_SUMMARY}}

## Before and after

### Before

{{BEFORE_ARCHITECTURE_AND_MAIN_GAPS}}

### After

{{AFTER_ARCHITECTURE_AND_MAIN_IMPROVEMENTS}}

```text
{{FINAL_RELEVANT_TREE}}
```

## Important moves and compatibility work

| From | To | References/contracts updated | Validation |
|---|---|---|---|
| `{{FROM}}` | `{{TO}}` | {{REFERENCES}} | {{EVIDENCE}} |

## Permanent agent, orchestrator, and memory layer

{{FILES_CREATED_RECONCILED_AND_HOW_TO_MAINTAIN}}

## Quality, documentation, security, CI, and GitHub improvements

{{IMPROVEMENTS_OR_NOT_APPLICABLE}}

## Baseline versus final evidence

{{RESULT_TABLE_OR_LINK_TO_VALIDATION_REPORT}}

## Pre-existing failures

{{NONE_OR_EXACT_FAILURES}}

## New regressions

{{NONE_OR_EXACT_REGRESSIONS_AND_STATUS}}

## Quarantined, retained, or uncertain files

{{NONE_OR_LIST_WITH_REASON}}

## Deferred backlog

{{LINK_AND_TOP_ITEMS}}

## Assumptions and unverified areas

{{NONE_OR_LIST}}

## Rollback

{{BRANCH_COMMIT_OR_MANUAL_ROLLBACK_GUIDANCE}}

## Reviewer checklist

- [ ] Review the complete diff, not only this report.
- [ ] Confirm application behaviour and visible UI/API contracts.
- [ ] Confirm test/build/smoke evidence is acceptable.
- [ ] Confirm no secret, production data, generated junk, or unrelated dependency churn was added.
- [ ] Confirm permanent `AGENTS.md`, `.ai/`, and docs match the actual project.
- [ ] Approve cleanup of the temporary `.repo-moderniser/` layer.
