# PPVC-651 — Shared frontend tooling

Scope confirmed by Martin: Retreat Engine admin and IbogaReady. Both already had identical Vite configs, SPA server scripts and config checks. This change gives those implementations one canonical source, with independently reproducible consumers.

## Using the apps

No end-user workflow changes. In either repository, use `npm ci`, `npm run test:config`, `npm run test:tooling`, `npm test -- --runInBand`, `npm run build`, and `PORT=3000 npm run serve` as appropriate. Existing build/ directory, routes, PUBLIC_URL, REACT_APP_* / VITE_* exposure, PORT and browser targets remain unchanged. Internal environment variables stay out of browser defines. The runtime package is a production dependency, so the static server remains available when development dependencies are omitted.

## One source of truth, independent deployments

The admin owns `packages/frontend-tooling`. Both repositories install the exact same `vendor/ibogaspirit-frontend-tooling-1.0.0.tgz`, pinned by file path and SHA-512 in their lockfiles. CI needs only that app's checkout; there are no sibling imports, external registry credentials or new Git repositories. The package has no third-party runtime dependencies. Each app supplies its own React plugin and Vite loader.

The shared exports are `config` (including a declaration file), `serve` and `check-config`. The two Vite files and serving/config-check scripts are thin adapters. App-specific dependencies, TypeScript/Jest configuration, UI and business rules remain app-owned. Separate node_modules/lockfiles are appropriate for independently deployed applications, including their different React patch versions; this change does not force a monorepo or a shared UI migration.

## Updating shared tooling

1. Edit the canonical source in the admin's `packages/frontend-tooling`.
2. Bump its package.json version. Never replace a released archive under the same version.
3. From the admin root, run `npm pack ./packages/frontend-tooling --pack-destination ./vendor --ignore-scripts`.
4. Copy that exact new archive into IbogaReady's vendor directory. In each app, install the new archive with `npm install --save-exact ./vendor/ibogaspirit-frontend-tooling-VERSION.tgz --ignore-scripts`, updating the manifest and lockfile. Remove an older archive only after no manifest references it.
5. Run clean installation, shared-tooling/config tests, app unit tests, builds and relevant browser checks in each consumer. Commit the source change, both app manifests/lockfiles and both identical archives. Release either app independently when its checks pass.

`npm run test:tooling` verifies archive/lock integrity, the installed package against its archive, and canonical source against that archive where present, then runs the shared test suite. It catches editing canonical source without repacking, changing installed package files, or tampering with the archive. Node test discovery skips explicit node_modules paths, so the small app test adapter runs the installed tests from the package directory.

## Validation scope

Both consumers installed successfully using their lockfiles and independent node_modules directories. Both actual Vite config checks and shared-package integrity checks pass. Shared tests cover environment allowlisting/base/targets and SPA deep links, MIME, immutable asset caching, HEAD, missing assets, POST rejection, encoded traversal and malformed paths. Additional isolated integrity fixtures demonstrate rejection of source drift, installed drift and archive/lock drift.

Both app builds and complete unit suites were run. Local browser checks serve those builds through the installed package on desktop/mobile, verify login rendering from deep links, static assets/cache headers and missing-file behavior, with external requests blocked. These checks do not exercise authenticated business workflows or claim production deployment.

Exact results, package hashes, commands and commits are recorded in workspace `ppvc-651-validation/validation.json` and the release ledger. Implemented locally, not pushed or deployed.
