# Repository inventory

- Generated: {{TIMESTAMP}}
- Repository root: `{{ROOT}}`
- Branch: `{{BRANCH}}`
- Worktree: {{CLEAN_OR_DIRTY}}
- Repository kind: {{KIND}}
- Lifecycle/deployment context: {{CONTEXT_OR_UNKNOWN}}

## Purpose and entry points

{{PURPOSE_AND_ENTRY_POINTS}}

## Stack and toolchain

| Category | Detected | Evidence |
|---|---|---|
| Languages | {{LANGUAGES}} | {{FILES_MANIFESTS}} |
| Runtimes | {{RUNTIMES}} | {{VERSION_FILES}} |
| Frameworks | {{FRAMEWORKS}} | {{MANIFESTS_IMPORTS}} |
| Package/workspace tools | {{TOOLS}} | {{LOCKFILES_CONFIG}} |

## Current repository tree

```text
{{RELEVANT_TREE}}
```

## Packages, apps, and services

| Name | Path | Type | Entry point | Build/deploy unit |
|---|---|---|---|---|
| {{NAME}} | `{{PATH}}` | {{TYPE}} | `{{ENTRY}}` | {{UNIT}} |

## Commands

| Purpose | Command | Source of truth | Verified? |
|---|---|---|---|
| Install | `{{COMMAND}}` | {{SOURCE}} | {{STATUS}} |

## Tests and quality

{{TESTS_LINT_TYPES_BUILD_SUMMARY}}

## CI/CD and operations

{{WORKFLOWS_DEPLOYMENT_CONTAINERS_INFRA}}

## Contracts and protected boundaries

{{PUBLIC_APIS_DATA_ENV_AUTH_DEPLOYMENT}}

## Generated, vendored, sensitive-looking, or protected paths

List paths and roles only; do not include secret values.

{{PATHS}}

## Candidate structural problems

{{FACTUAL_CANDIDATES_NOT_YET_DECISIONS}}
