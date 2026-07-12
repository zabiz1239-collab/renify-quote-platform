# Standard — GitHub repository hygiene

Apply only when the repository is hosted on GitHub and the feature fits its collaboration model.

## Pull requests

A useful PR template prompts for:

- purpose and scope;
- linked issue/context;
- type of change;
- testing and smoke evidence;
- screenshots for visible UI changes;
- deployment/data/config impact;
- risk and rollback;
- checklist for docs, tests, and secrets.

Keep it short enough that contributors use it.

## Issues

Use issue forms for structured bug and feature intake in public or team-managed repositories. Avoid requiring sensitive data. Include reproduction, expected/actual behaviour, environment, logs with redaction guidance, and impact.

## CODEOWNERS

Add only with confirmed valid GitHub users or teams and repository policy. Never insert placeholders that could silently fail required review.

## Dependabot

Generate `.github/dependabot.yml` from actual manifests and workspace roots. Include GitHub Actions when workflows exist. Group routine updates to reduce noise, but keep security updates actionable. Do not use the migration to merge broad version changes.

## CI and dependency review

Preserve working CI. Add minimal validation only after local commands are proven. Dependency review is useful for pull requests when policy and Actions availability allow it.

## Community files

Add `CONTRIBUTING.md`, `SECURITY.md`, support guidance, licences, or codes of conduct only when appropriate to repository visibility, team workflow, and ownership. Do not invent contact details or disclosure channels.

## Releases and changelog

Respect the existing release mechanism. Document it in operations docs. Do not introduce semantic-release, changesets, or another release tool without a demonstrated need and approval.
