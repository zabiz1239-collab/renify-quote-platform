# Phase 0 — Preflight

## Purpose

Establish a safe working context before any application edit.

## Steps

1. Confirm the repository root and whether this is a single application, monorepo, library, service, mobile app, infrastructure repo, or mixed repo.
2. Read all existing instruction files that may apply to the working directory. Treat existing project-specific rules as evidence about intended workflows.
3. Inspect `git status --short`, current branch, remotes, submodules, worktrees, and ignored files without printing secret contents.
4. If the worktree is dirty, distinguish moderniser files from pre-existing user changes. Under the default policy, complete read-only audit work but stop before application edits that could overlap those changes.
5. If working locally on the default branch and branch creation is available, create or use a dedicated branch such as `chore/repository-modernisation`. Do not force a branch change in a managed cloud task environment.
6. Review `.repo-moderniser/moderniser.yml`. Record every override in `output/MIGRATION_LOG.md`.
7. Identify protected, generated, vendored, binary, large-data, secret-like, migration, signing, and deployment-critical paths by filename and role. Do not read secret values.
8. Initialise the output documents from the report templates and update `state.yml`.

## Gate

Application edits may begin only when the worktree policy is satisfied, scope is clear, protected paths are recorded, and the migration can be kept reversible.

## Required output

- Preflight section in `output/MIGRATION_LOG.md`
- Updated `state.yml`
- Explicit statement of branch/worktree status and any constraints
