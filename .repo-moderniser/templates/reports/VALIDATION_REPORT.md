# Final validation report

- Date/time: {{TIMESTAMP}}
- Commit/branch: {{CONTEXT}}
- Compared with baseline: `BASELINE.md`

## Structural validation

- Command: `python .repo-moderniser/scripts/validate_modernisation.py --root .`
- Result: {{PASS_FAIL}}
- Warnings/exceptions: {{DETAILS_OR_NONE}}

## Quality gates

| Gate | Baseline | Final command | Final result | Regression? |
|---|---|---|---|---|
| Lint | {{BASELINE}} | `{{COMMAND}}` | {{RESULT}} | {{YES_NO_NA}} |
| Type-check | {{BASELINE}} | `{{COMMAND}}` | {{RESULT}} | {{YES_NO_NA}} |
| Tests | {{BASELINE}} | `{{COMMAND}}` | {{RESULT}} | {{YES_NO_NA}} |
| Build | {{BASELINE}} | `{{COMMAND}}` | {{RESULT}} | {{YES_NO_NA}} |
| Smoke | {{BASELINE}} | `{{COMMAND_OR_PROCEDURE}}` | {{RESULT}} | {{YES_NO_NA}} |

## Diff review

- `git diff --check`: {{RESULT}}
- Import/path/reference review: {{RESULT}}
- Lockfile/dependency review: {{RESULT}}
- Generated/binary/mode/line-ending review: {{RESULT}}
- Secret and protected-path review: {{RESULT}}
- Instruction/memory placeholder review: {{RESULT}}

## Remaining limitations

{{LIMITATIONS_OR_NONE}}
