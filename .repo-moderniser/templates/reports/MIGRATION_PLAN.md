# Repository migration plan

- Profile: {{PROFILE}}
- Behaviour policy: preserve observable behaviour
- Target architecture confidence: {{HIGH_MEDIUM_LOW}}

## Proposed target tree

```text
{{TARGET_TREE}}
```

## Current-to-target mapping

| Current path | Target path | Reason | Risk | Validation |
|---|---|---|---|---|
| `{{CURRENT}}` | `{{TARGET_OR_UNCHANGED}}` | {{REASON}} | {{RISK}} | `{{CHECK}}` |

## Slices

| ID | Objective | Scope | Risk | Depends on | Validation | Rollback | Status |
|---|---|---|---|---|---|---|---|
| M01 | {{OBJECTIVE}} | {{PATHS}} | {{RISK}} | {{DEPENDENCY}} | {{CHECKS}} | {{ROLLBACK}} | pending |

## Permanent agent and memory layer

{{FILES_AND_CONTENT_PLAN}}

## GitHub/CI/documentation work

{{PLAN_OR_NOT_APPLICABLE}}

## Explicitly out of scope

- {{FEATURE_UPGRADE_DATA_OR_PRODUCT_WORK}}

## Approval/blocker decisions

{{NONE_OR_OPTIONS_WITH_RECOMMENDATION}}
