# Standard — documentation and decisions

## Single source of truth

Each fact should have one canonical home. Other files should link to it. Avoid copying setup commands, architecture explanations, and environment lists across many files where they will drift.

## Root README

The README should help a new contributor understand:

- what the project is and its current status;
- prerequisites and supported runtime versions;
- safe local setup and run path;
- essential quality commands;
- high-level architecture and important directories;
- environment/configuration approach without secrets;
- deployment/release pointer;
- contribution/support/licence links where relevant.

Do not turn it into a complete operations manual.

## Architecture docs

Document current reality, not an aspirational diagram. Include system context, major components, data/control flow, dependency direction, external integrations, trust boundaries, deployment units, and known constraints. Link to code and ADRs.

## ADRs

Use ADRs for decisions with meaningful alternatives or long-term consequences. A concise ADR contains:

- title, date, status;
- context and forces;
- decision;
- considered alternatives;
- consequences and follow-up;
- related links.

Do not create an ADR for every file rename.

## Operations

Document safe local and production-adjacent operations: environments, deployment/release flow, migrations, health checks, observability, backup/recovery pointers, rollback, scheduled jobs, and incident-relevant dependencies. Never embed credentials or production-only values.

## Testing docs

Document test layers, commands, fixtures/data policy, service dependencies, CI mapping, smoke procedure, common failures, and what is intentionally untested.

## Currency

Every structural or command change must update its canonical documentation and project memory in the same change set.
