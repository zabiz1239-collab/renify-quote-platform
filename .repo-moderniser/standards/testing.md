# Standard — testing and verification

## Baseline first

Run existing checks before structural changes. Preserve exact evidence so pre-existing failures are not mistaken for regressions.

## Test pyramid without dogma

Use the cheapest reliable layer for each risk:

- static validation, linting, and type checking for structural mistakes;
- unit tests for local behaviour and edge cases;
- integration/contract tests for module, database, queue, or API boundaries;
- end-to-end or smoke tests for critical user/runtime paths.

Do not add slow broad tests when a focused test proves the moved boundary. Do not rely only on unit tests when imports, assets, routing, build tooling, or deployment paths changed.

## Characterisation tests

When behaviour is poorly documented, add a focused test that records current observable behaviour before refactoring. This is especially valuable for legacy utilities, data transforms, routing, authentication boundaries, and public APIs.

## Commands

The permanent project layer should provide exact commands for the checks that actually exist. Prefer one documented entry point per gate via existing package scripts or task runners.

## Determinism

- Use lockfiles and reproducible install modes.
- Avoid tests that require production credentials or mutate shared external systems.
- Separate optional integration tests from the default fast suite when needed.
- Make time, randomness, network, and filesystem dependencies controllable where practical.

## Migration validation

After every structural slice, run checks proportional to the affected boundary. At the end, rerun the full available baseline suite and a realistic smoke path. Compare results, not merely exit codes when outputs matter.
