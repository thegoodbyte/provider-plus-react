# PPVC-644 — Vite migration

## Scope and rollout

The Vite refactor is on `refactor/PPVC-644-vite`, based on synchronized `develop`. Production has not been changed by this migration. The RE API, admin, and IbogaReady repositories have remote `backup/production-before-PPVC-644-20260924` and `backup/develop-before-PPVC-644-20260924` branches. API develop preserves both histories through a merge; superseded conflicts retain current production behavior.

Use the existing **DEV Provider Plus** Railway project for validation: its database and JWT secret differ from production. Its Railway environment is named `production`, but it is the separate development project—always select the project ID `ae70922b-d9bb-48d0-99fe-157316785830` explicitly. Do not use the `staging` environment inside the production project: that environment shares the production database and JWT secret.

Target domains: `dev.retreatengine.com`, existing `api.dev.retreatengine.com`, and new `dev.ibogaready.com`. Outbound email is disabled using `OUTBOUND_EMAIL_ENABLED=false` on the development API. No production accounts or customer emails are used by browser tests. Production promotion requires user review.

## Compatibility

- Vite replaces react-scripts; standalone Jest/Babel keeps the existing test API and coverage thresholds.
- `REACT_APP_*`, `PUBLIC_URL`, and Vite `VITE_*` browser variables are supported. Only explicit public prefixes are exposed; server credentials are excluded. Build-time Railway variables override environment files.
- React Router/authentication remain unchanged. The production server supports direct SPA routes and returns 404 for missing assets.
- Output remains `build/`; Vite emits hashed assets and `.vite/manifest.json`. The admin route measurement script now reads that manifest.
- Admin lazy imports are preserved (37 dynamic entry chunks in the verified build). The client portal had no lazy routes before this change.
- Docker uses Node 22, the same startup port, and polling for mounted-source HMR. The existing parent compose file remains compatible; a standalone `docker-compose.dev.yml` is included.
- Application dependency versions were retained where possible. Axios, jsPDF (admin), and React Router received compatible security updates. No business feature changes are part of the migration.
- Type checks exclude test files, which Jest transforms separately. Old payment mocks and timing-dependent assertions were corrected rather than weakening production behavior.

## Deployment

Railway: `npm ci --legacy-peer-deps`, `npm run build`, `npm run serve`; `PORT` is honored. Config is in `railway.json` and `nixpacks.toml`. Set API URLs at build time. Deploy the migration branch to the development services for review, then merge to develop. Restore development services to track develop after merge. Only promote to production after approval.

DreamHost: run `bash scripts/deploy-dreamhost.sh` with explicit `DREAMHOST_HOST`, `DREAMHOST_USER`, and `DREAMHOST_PATH`. It uploads `build/`, including the SPA `.htaccess`. No destination or production deploy is hard-coded. No DreamHost deployment was performed.

Rollback: redeploy the previous successful deployment in Railway or build the corresponding production backup branch with its original lockfile. A Git branch rollback alone does not roll back the running service. Keep hashed assets from the previous static deployment until open sessions expire. No database migration is required for the frontend refactor.

## Local validation

- Admin: 933 tests across 167 Jest suites passed.
- Client portal: 95 tests across 19 Jest suites passed.
- Both production builds passed, including application TypeScript checks.
- Production browser checks passed for direct routes, login/API configuration, and asset responses.
- Local and Docker browser checks passed for routing, authentication request configuration, and mounted-source CSS HMR without page reload.
- API outbound-email disable guard: 51 communications tests passed; API build passed.
- Real-user acceptance, external DNS, and production promotion are separate release checks.

## Measurements

Measured on the same macOS machine with Node 22.20.0. One warm dependency-cache run per toolchain, not a statistical benchmark. Build timings include the full package build command; Vite includes explicit application type checking. Startup measures process launch to first successful HTTP response, not authenticated-page readiness.

| Measurement | CRA | Vite |
|---|---:|---:|
| Admin build | 21.09 s | 21.95 s |
| Client portal build | 4.84 s | 4.87 s |
| Admin HTTP-ready startup | 7.148 s | 0.703 s |
| Client portal HTTP-ready startup | 3.683 s | 0.551 s |

Build time is essentially unchanged in these runs; development startup improves substantially. Vite bundling alone took 7.65 s (admin) and 1.60 s (portal); the remaining build time includes type checking and command startup. Source-map settings and machine load can affect comparisons.

Reference: https://vite.dev/guide/env-and-mode and https://vite.dev/guide/static-deploy.html
