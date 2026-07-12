# Standard — repository structure

## Principle

A good repository structure makes responsibilities, runtime boundaries, ownership, and change impact easy to understand. It is not a universal directory diagram.

## Decision order

Choose structure in this order:

1. framework/toolchain requirements;
2. deployment and package boundaries;
3. public API and import compatibility;
4. current working conventions;
5. actual domain or feature boundaries;
6. consistency and aesthetics.

A lower-priority reason must not break a higher-priority constraint.

## Universal expectations

Where applicable, a maintainable repo should make these discoverable:

- primary application/package source;
- tests and fixtures;
- configuration and environment examples without secrets;
- scripts/automation;
- documentation and decisions;
- deployment/infrastructure;
- generated and vendored code boundaries;
- agent instructions and project memory;
- ownership and quality commands.

Not every category needs its own top-level directory. Follow the stack.

## Common profiles

### JavaScript/TypeScript web apps

- Preserve framework conventions such as Next.js `app/` or `pages/`, Remix routes, Nuxt directories, or Angular workspace layout.
- Use `src/` only when the framework supports it and the repository already uses it or the move has a clear benefit with aliases and tooling updated.
- Group reusable UI, feature/domain code, server code, data access, and utilities by real boundaries. Avoid one giant `components/`, `utils/`, or `services/` dumping ground.
- Keep server-only secrets and modules separated from browser bundles.

### Python

- Preserve Django, Flask, FastAPI, scientific, or CLI conventions.
- A `src/<package>/` layout is useful for distributable packages but may be a high-risk import change for an existing app; do not impose it without evidence.
- Keep tests outside the installed package unless the project convention requires otherwise.
- Separate application configuration from secret values and environment-specific deployment files.

### JVM, .NET, Go, Rust, Ruby, PHP

- Preserve ecosystem-standard project/module layouts and build-tool expectations.
- Do not invent cross-language naming conventions that fight the toolchain.
- Keep generated files and migrations where framework discovery expects them.

### Mobile and desktop

- Preserve Xcode, Gradle/Android, Flutter, React Native, Electron, Tauri, or platform packaging structure.
- Treat signing, entitlements, native projects, assets, and store metadata as protected paths.

### Monorepos

A healthy monorepo usually makes these boundaries explicit when they exist:

```text
apps/          deployable user-facing applications
services/      independently deployed backend services
packages/      reusable libraries and shared configuration
infra/         infrastructure definitions
scripts/       repository-wide automation
docs/          cross-project architecture and operations
```

Do not create empty categories or move a working workspace solely to match this example. Respect the existing workspace manager and package graph.

## Layering rules

- Use feature/domain grouping when changes commonly span UI, logic, and data for one capability.
- Use technical layers when dependency direction is stable and shared across many capabilities.
- Hybrid structures are acceptable when documented.
- Keep interfaces at boundaries that require substitution, testing, or separation—not around every function.
- Avoid circular dependencies and hidden cross-feature imports.
- Define public module surfaces where the language/ecosystem supports them.

## Naming

- Prefer names that describe responsibility, not vague containers such as `misc`, `common`, `helpers`, `new`, `old`, or `temp`.
- Follow language casing and framework filename conventions.
- Account for case-sensitive CI/deployment filesystems.
- Do not rename large sets of files for style alone during a structural migration.

## Root hygiene

Keep required tool and platform files at the root, but move incidental scripts, screenshots, notes, and duplicate configs into an appropriate documented location. Never move a root file until its consumers and discovery rules are known.
