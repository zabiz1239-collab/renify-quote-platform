# Phase 6 — Quality gates and GitHub hygiene

## Purpose

Make the improved repository easier to validate and maintain without installing unnecessary tooling.

## Commands and tests

- Repair or document inconsistent setup/run/test commands.
- Add tests around moved critical paths and fragile boundaries when coverage is missing.
- Prefer existing test frameworks and task runners.
- Add a new tool only for a demonstrated gap, with a documented command and maintainership path.
- Do not use repository-wide auto-formatting unless already standard and intentionally scoped.

## CI

When GitHub Actions exists, preserve working workflows and improve them incrementally. When no CI exists, add a minimal workflow only after commands are verified locally and the repository's hosting/policy supports Actions.

New workflows should:

- use least-privilege permissions;
- avoid exposing secrets to untrusted pull requests;
- pin newly introduced third-party actions to immutable commit SHAs with a version comment where maintainable;
- use dependency caching safely;
- separate fast checks from deployment;
- avoid deploying from a pull-request validation workflow.

## Dependency hygiene

Generate `.github/dependabot.yml` only for ecosystems actually detected. Group updates sensibly and include `github-actions` when Actions are used. Do not trigger broad dependency upgrades as part of this migration.

Add dependency review only when GitHub Actions is available and repository policy permits it.

## Repository collaboration files

Use the templates as starting points and add only what fits the repository:

- pull request template for GitHub-hosted collaborative repos;
- issue forms for public or team-managed repos;
- contribution and security policies when relevant;
- CODEOWNERS only when valid owners are known; never leave fake handles.

## Required output

- Quality/GitHub section in `output/MIGRATION_LOG.md`
- Updated commands and docs
- Any new workflow/config validated syntactically and logically
- Updated `state.yml`
