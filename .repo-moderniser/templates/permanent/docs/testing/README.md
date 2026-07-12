# Testing and verification

_Last verified: {{YYYY-MM-DD}}_

## Quality commands

| Gate | Command | Working directory | Notes |
|---|---|---|---|
| Lint | `{{LINT_COMMAND_OR_NONE}}` | `{{DIR}}` | {{NOTES}} |
| Type-check | `{{TYPECHECK_COMMAND_OR_NONE}}` | `{{DIR}}` | {{NOTES}} |
| Test | `{{TEST_COMMAND}}` | `{{DIR}}` | {{NOTES}} |
| Build | `{{BUILD_COMMAND}}` | `{{DIR}}` | {{NOTES}} |
| Smoke | `{{SMOKE_COMMAND_OR_PROCEDURE}}` | `{{DIR}}` | {{NOTES}} |

## Test layers

{{UNIT_INTEGRATION_CONTRACT_E2E_SMOKE_SUMMARY}}

## Fixtures and test data

{{FIXTURE_POLICY_AND_NO_PRODUCTION_DATA_RULE}}

## External services

{{FAKES_CONTAINERS_TEST_ACCOUNTS_OR_LIMITATIONS}}

## CI mapping

{{WHICH_WORKFLOW_RUNS_WHICH_GATES}}

## Known gaps

- {{KNOWN_GAP_OR_NONE}}

## Common failures

- {{FAILURE_AND_FIX_OR_NONE}}
