# Repository modernisation orchestrator

This orchestrator is a sequential engineering workflow. One agent may perform every role, or the agent may delegate read-only analysis and review to subagents. Code-changing roles must coordinate through the same migration plan and state file.

## Operating roles

### Repository analyst

Inventories the repository, detects the stack and lifecycle, maps entry points and dependencies, identifies generated and sensitive paths, and records the current structure without proposing changes prematurely.

### Baseline verifier

Discovers trustworthy install, lint, type-check, test, build, and smoke commands. Runs the safe commands available in the environment and records pre-existing failures exactly.

### Architecture custodian

Chooses the smallest stack-native target structure that improves navigability and boundaries. It rejects cosmetic churn and dogmatic layering.

### Migration engineer

Implements the approved plan in coherent, reversible slices. It updates imports, aliases, manifests, scripts, tests, docs, CI, deployment references, and case-sensitive paths together.

### Verification engineer

Runs focused checks after each slice and the complete available validation suite at the end. It compares results with the baseline and investigates regressions.

### Memory and documentation custodian

Creates the permanent `.ai/` layer and fills it with verified project facts, decisions, known issues, commands, and hand-off state. It keeps root instructions concise and moves procedures into linked documents.

### Final reviewer

Reviews the entire diff as if it were a pull request. It searches for accidental secret exposure, broken paths, untracked generated files, unsupported claims, and incomplete cleanup.

## Phase state machine

Update `.repo-moderniser/state.yml` and the matching output document at the end of each phase.

1. **Preflight** — establish repository root, branch, worktree state, scope, safety constraints, and protected paths.
2. **Inventory** — create a factual repository and dependency map.
3. **Baseline** — record current quality-gate results and a minimal runnable path.
4. **Plan** — create a risk-ranked migration plan and proposed target tree.
5. **Permanent agent layer** — generate project-specific `AGENTS.md`, `CLAUDE.md`, `.ai/`, and core documentation from templates.
6. **Structure and cleanup** — move or rename only evidence-backed files, remove duplication safely, and update every reference.
7. **Quality and GitHub hygiene** — improve commands, tests, CI, dependency management, issue/PR templates, and repository docs only when appropriate and verifiable.
8. **Full validation** — run all available gates, smoke the app, compare with baseline, and review the diff.
9. **Final report** — document results, remaining risks, deferred work, and exact evidence.
10. **Optional archive/cleanup** — after human approval, archive reports and remove the temporary moderniser layer.

## Continuous completion policy

Continue automatically from one phase to the next while the work is local, reversible, and supported by evidence. Do not stop merely because:

- a report has been produced;
- one folder has been reorganised;
- one test command passed;
- a subagent completed its portion;
- a minor uncertainty can be documented and resolved through inspection.

Pause and request a decision only when at least one of these is true:

- uncommitted user work could be overwritten;
- business behaviour or public API semantics are genuinely ambiguous;
- a destructive database or data migration is required;
- credentials, production access, signing keys, paid services, or external approval are required;
- two incompatible target architectures are equally plausible and the choice has material long-term cost;
- the repository cannot be validated enough to make a high-risk move safe.

When blocked, finish all independent safe work, record the blocker and its exact decision options, and leave the repository in a coherent state.

## Planning and change rules

- Every plan item must state: reason, files affected, risk, validation, rollback, and status.
- Prefer several small moves with validation between them over one massive tree rewrite.
- Preserve Git history with `git mv` when moving tracked files.
- Do not mix unrelated formatting across the repository with structural changes.
- Do not introduce an abstraction until there are real responsibilities or repeated patterns to justify it.
- Do not add a tool merely because it is popular. Tie it to a detected gap and a command that can be maintained.
- Existing project instructions outrank generic kit guidance unless they conflict with safety or the user explicitly requested replacement.

## Definition of done

The migration is done only when:

- no regression relative to the documented baseline remains unexplained;
- the app's standard install/build/test path is documented and as verified as the environment allows;
- permanent agent instructions describe the actual repository, not template placeholders;
- long-term memory contains durable facts and short-term memory contains a clean hand-off;
- all moved files have updated references across source, tests, tooling, CI, deployment, documentation, and case-sensitive paths;
- the structural validator passes or every exception is justified in the completion report;
- the full diff has been reviewed and the report names remaining risks and deferred tasks.
