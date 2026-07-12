# Pre-change baseline

- Date/time: {{TIMESTAMP}}
- Commit/branch: {{CONTEXT}}
- Environment: {{OS_RUNTIME_TOOL_VERSIONS}}
- Dependency state: {{INSTALLED_LOCKED_UNAVAILABLE}}

## Results

| Gate | Command | Exit | Result | Evidence/notes |
|---|---|---:|---|---|
| Manifest/config | `{{COMMAND}}` | {{EXIT}} | {{PASS_FAIL_BLOCKED}} | {{NOTES}} |
| Lint | `{{COMMAND}}` | {{EXIT}} | {{PASS_FAIL_BLOCKED}} | {{NOTES}} |
| Type-check | `{{COMMAND}}` | {{EXIT}} | {{PASS_FAIL_BLOCKED}} | {{NOTES}} |
| Tests | `{{COMMAND}}` | {{EXIT}} | {{PASS_FAIL_BLOCKED}} | {{NOTES}} |
| Build | `{{COMMAND}}` | {{EXIT}} | {{PASS_FAIL_BLOCKED}} | {{NOTES}} |
| Smoke | `{{COMMAND_OR_PROCEDURE}}` | {{EXIT_OR_NA}} | {{PASS_FAIL_BLOCKED}} | {{NOTES}} |

## Pre-existing failures

{{FAILURES_WITH_EXACT_SCOPE}}

## Critical behaviour to preserve

{{CHARACTERISATION_OR_SMOKE_PATHS}}

## Validation limitations

{{CREDENTIAL_NETWORK_PLATFORM_MISSING_TEST_LIMITS}}
