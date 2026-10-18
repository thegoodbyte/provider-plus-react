# @ibogaspirit/frontend-tooling

Canonical source: Retreat Engine admin `packages/frontend-tooling`.
Consumers: admin and IbogaReady, via the same versioned npm archive checked into each repository's `vendor/` folder. No sibling paths, registry credentials or external package publication are required in CI. This package has no React, Vite or other runtime dependencies; the app supplies its Vite loader and React plugin.

Exports: `config` builds the shared public Vite contract; `serve` creates/starts the static SPA server from the consuming app's working directory; `check-config` validates the app's actual Vite config and secret isolation. Config declaration types are included.

Change the canonical source, bump this package's version, run its tests and pack it (`npm pack ./packages/frontend-tooling --pack-destination ./vendor --ignore-scripts`). Copy that exact archive to the portal's vendor folder and update the dependency and package-lock in both apps. Never replace an already released archive under the same version. Run `npm ci`, `npm run test:tooling`, `npm run test:config`, app tests/builds and browser smoke checks in each consumer. `node scripts/check-shared-tooling.cjs` checks installed-package integrity against the committed distribution (and canonical source where present).

Application-specific dependencies and UI/business logic remain app-owned. Separate dependency installs allow independent reproducible builds and React/tooling updates. Use this package boundary for further genuinely shared, versioned tooling rather than importing sibling source trees.
