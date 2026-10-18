# Retreat Engine admin frontend

React 19 and TypeScript **5.9.3**, built with Vite. Requires Node 22.12+.

React, React DOM and their type packages all use major version 19. Application code is checked with `strict: true`, `moduleResolution: bundler` and the React JSX runtime. `npm run build` runs this strict check before bundling; `npx tsc --noEmit -p tsconfig.build.json` runs it alone. Jest uses Babel to execute tests separately; test files are excluded from the production type-check configuration.

- `npm ci --legacy-peer-deps`: install the locked dependencies.
- `npm start`: Vite development server on port 3000; set `PORT` to override.
- `npm run build`: type-check application code and generate `build/`.
- `npm run serve`: production SPA server, listening on Railway's `PORT`.
- `npm test -- --runInBand`: existing Jest unit tests, independent of CRA.
- `npm run test:timings`: run a serial, uncached unit benchmark and save per-test timings to `test-results/unit-timings.json`; see [PPVC-652](docs/PPVC-652.md).
- `npm run test:smoke`: production browser tests; build first.
- `SMOKE_DEV=true npm run test:smoke`: development and hot-reload checks.

Use `develop` for normal development. PPVC-644 is isolated on `refactor/PPVC-644-vite` until reviewed. Never push an unreviewed migration directly to `production`.

Existing `REACT_APP_*` variables and `PUBLIC_URL` remain supported. Vite also supports `VITE_*`; both prefixes are public browser configuration and must not contain secrets. Railway build-time variables override checked-in environment files. The production output remains `build/` so static deployments retain their existing directory contract.

See [PPVC-644 migration and deployment notes](docs/PPVC-644.md).

See [PPVC-645 TypeScript / React audit](docs/PPVC-645.md) for version alignment, strict-check scope and validation limitations.
