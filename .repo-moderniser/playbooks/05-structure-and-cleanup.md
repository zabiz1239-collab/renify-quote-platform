# Phase 5 — Structure and cleanup

## Purpose

Implement the planned reorganisation without accidental behaviour changes.

## Slice loop

For each approved slice:

1. Mark it active in `state.yml` and `output/MIGRATION_PLAN.md`.
2. Run the focused pre-change check when useful.
3. Move tracked files with `git mv` where available.
4. Update all source imports, aliases, dynamic imports, test paths, fixtures, snapshots, configuration, manifests, code-generation inputs, CI, deployment files, Docker contexts, documentation, and case-sensitive references.
5. Avoid unrelated formatting and generated output churn.
6. Run the slice's focused validation.
7. Review `git diff --check`, unexpected binary changes, file mode changes, and accidental deletions.
8. Update docs, long-term memory, short-term memory, and the migration log.
9. Mark the slice complete only with evidence.

## Dead and duplicate files

A file may be removed only when:

- references and runtime discovery mechanisms have been checked;
- its role is understood;
- generated/build/deployment conventions do not require it;
- the baseline and focused checks pass without it;
- evidence is recorded.

When uncertainty remains, move it to the configured quarantine directory, keep it out of commits, and list it in the report. Do not delete user data or unknown assets.

## Boundary improvement

Use the migration to clarify real module boundaries, but avoid turning a reorganisation into a product rewrite. Prefer dependency direction fixes that can be proven through tests. Defer speculative architecture changes to the backlog.

## Required output

- Completed structure slices with validation evidence
- Updated `output/MIGRATION_LOG.md`
- Updated permanent memory and docs
- Updated `state.yml`
