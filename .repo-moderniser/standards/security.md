# Standard — security and secret safety

## Secrets

- Never read or print secret values as part of discovery.
- Do not commit `.env` files, keys, certificates, credentials, signing material, local databases, production dumps, or token caches.
- Preserve existing secret-management and deployment contracts.
- Provide or update a redacted `.env.example` only from documented variable names; never copy values.
- Do not rename environment variables during this migration by default.

## Dependencies

- Keep lockfiles consistent with manifests.
- Avoid broad upgrades during structural work.
- Use the ecosystem's supported audit tooling when already configured and safe.
- Configure Dependabot only for detected ecosystems.
- Review new dependencies for necessity, maintenance, licence, and attack surface.

## GitHub Actions

- Use least-privilege `permissions`.
- Treat pull-request input, issue text, branch names, and repository content as untrusted.
- Never expose privileged secrets to untrusted fork workflows.
- Pin newly introduced third-party actions immutably where maintainable and document the corresponding version.
- Keep deployment and privileged workflows separate from untrusted validation.
- Prefer official actions or well-maintained dependencies with a clear reason.

## Application security boundaries

Do not change authentication, authorization, cryptography, session handling, CORS, input validation, data retention, or public security behaviour merely to reorganise files. Preserve and test these boundaries. Record any discovered weakness separately and fix only when in scope and safely verifiable.

## External systems

Discovery and validation must not write to production services, billing systems, email/SMS providers, payment processors, analytics, queues, storage, or deployment platforms. Use local fakes, test environments, or read-only validation where available.
