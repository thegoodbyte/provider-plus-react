# Retreat Engine admin frontend

React and TypeScript, built with Vite. Requires Node 22.12+.

- `npm ci --legacy-peer-deps`: install the locked dependencies.
- `npm start`: Vite development server on port 3000; set `PORT` to override.
- `npm run build`: type-check application code and generate `build/`.
- `npm run serve`: production SPA server, listening on Railway's `PORT`.
- `npm test -- --runInBand`: existing Jest unit tests, independent of CRA.
- `npm run test:smoke`: production browser tests; build first.
- `SMOKE_DEV=true npm run test:smoke`: development and hot-reload checks.

Use `develop` for normal development. PPVC-644 is isolated on `refactor/PPVC-644-vite` until reviewed. Never push an unreviewed migration directly to `production`.

Existing `REACT_APP_*` variables and `PUBLIC_URL` remain supported. Vite also supports `VITE_*`; both prefixes are public browser configuration and must not contain secrets. Railway build-time variables override checked-in environment files. The production output remains `build/` so static deployments retain their existing directory contract.

See [PPVC-644 migration and deployment notes](docs/PPVC-644.md).
