# Prompt to paste into Codex

Apply the installed Repository Moderniser Kit to this existing repository.

Use the repository skill `$repository-moderniser` when available. Before editing application files, read the existing applicable instructions and documentation, then read `.repo-moderniser/START_HERE.md`, `.repo-moderniser/moderniser.yml`, `.repo-moderniser/ORCHESTRATOR.md`, and the numbered playbooks.

Complete the whole one-off modernisation workflow, not only an audit or plan:

1. Run the safe repository inspector and verify its findings.
2. Record preflight, repository inventory, audit scorecard, and the current behavioural/quality baseline.
3. Design the smallest stack-native target structure. Preserve framework conventions and public, data, environment, and deployment contracts.
4. Create and populate concise permanent `AGENTS.md`, a short `CLAUDE.md` importing it, the `.ai/orchestrator.yml` and `.ai/project.yml` files, long-term and short-term memory, decision/known-issue indexes, backlog, and proportionate architecture/operations/testing docs.
5. Implement the migration in small reversible slices. Update every import, alias, configuration, test, CI, container, deployment, asset, and documentation reference affected by a move.
6. Improve tests, commands, CI, dependency maintenance, and GitHub collaboration files only where appropriate to this repository and verifiable.
7. Run focused checks after each slice, then the structural validator and every safe available lint, type-check, test, build, and smoke gate. Compare with the baseline and review the complete diff.
8. Finish `.repo-moderniser/output/COMPLETION_REPORT.md` with exact evidence, remaining risks, deferred work, and rollback guidance.

Continue through all non-blocked phases without waiting after each step. Make and record safe assumptions when evidence supports them. Pause only for overlapping uncommitted user work, irreversible/data-changing operations, credentials or production access, or material ambiguity that could alter business behaviour or public contracts. Finish all independent safe work before pausing.

Do not read or print secret values. Do not force-push, push, deploy, change production data, perform destructive database operations, rotate credentials, or make broad dependency/framework/runtime upgrades. Do not claim success merely because files were created.
