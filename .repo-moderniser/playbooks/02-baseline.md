# Phase 2 — Behaviour and quality baseline

## Purpose

Record what works and fails before structural changes so regressions are distinguishable from pre-existing defects.

## Command discovery

Prefer commands already encoded in trusted project files such as package scripts, task runners, Makefiles, workspace configuration, CI workflows, development containers, or current documentation. Resolve contradictions by checking what CI or deployment actually uses.

## Dependency installation

- Use the repository's existing package manager and lockfile.
- Prefer frozen/locked/reproducible modes.
- Do not regenerate a lockfile merely to establish the baseline.
- Do not install globally or change runtime versions silently.
- If dependencies cannot be installed because of credentials, platform limits, network restrictions, or missing private packages, record the exact limitation and continue with available static checks.

## Run safe available gates

Run, where applicable:

1. configuration or manifest validation;
2. lint/static analysis;
3. type checking;
4. focused and full automated tests;
5. build/package generation;
6. non-destructive smoke or launch check;
7. existing security/dependency checks that do not upload code or require secrets.

Do not run production deployments, destructive migrations, seed/reset commands, paid jobs, or write-capable external integrations.

## Evidence rules

For every command, record:

- exact command and working directory;
- environment assumptions;
- exit code;
- concise result;
- whether failure existed before the migration;
- relevant log/report path without copying secret values.

If no tests exist, identify a minimal critical path and design a focused smoke or characterisation test before high-risk moves.

## Required output

- `output/BASELINE.md`
- Baseline section in `output/MIGRATION_LOG.md`
- Updated `state.yml`

## Gate

High-risk structural moves require enough baseline evidence to detect breakage. If that evidence cannot be created, downgrade to the conservative profile and focus on documentation, agent context, and low-risk organisation.
