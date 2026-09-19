# PPVC-636 — Lazy loading secondary screens

At baseline commit `72fa446`, opening the launcher downloaded the medical, communications, analytics and administration screens. Those screens now use named dynamic-import chunks. The retreat analytics and announcement tabs also load on demand: leaving their static imports in place would keep the chart library and announcement code in the entry bundle.

## Measurements

Production baseline: assets downloaded from `retreatengine.com` at deployment `c60e37fd-5f1d-427e-9c93-bc4253d024ab` (commit `72fa446`), before deploying this change. The baseline HTML uses the same local shell with references replaced by the deployed entry assets. Optimized measurements use the local production build. Byte figures below use Node gzip compression, not the build tool's slightly different gzip estimates.

| Metric | Production baseline | Optimized build | Reduction |
| --- | ---: | ---: | ---: |
| Entry JavaScript (raw bytes) | 4,835,941 | 3,586,810 | 25.8% |
| Entry JavaScript (gzip bytes) | 1,246,537 | 949,255 | 23.8% |
| First contentful paint (ms) | 3,080 | 2,388 | 22.5% |
| Launcher visible (ms) | 3,216 | 2,520 | 21.6% |
| DOMContentLoaded (ms) | 3,035 | 2,340 | 22.9% |

Chromium 147.0.7727.15, five fresh browser contexts, browser cache disabled, locally served gzip-compressed artifacts, 4× CPU throttling, 5 Mbps download and 50 ms latency. Timing values are medians. APIs return synthetic empty records; no production API calls or email sends occur. These are controlled browser measurements, not real-user production telemetry or a guarantee of the same speedup on every device. Launcher visibility includes Playwright observation overhead. Only the entry script is requested on the launcher in all measured runs.

An additional pre-change local production-build measurement was captured before modifying application code: entry 4,836,109 raw / 1,247,601 gzip bytes; launcher-visible median 3,264 ms. This corroborates the deployed baseline; differences in environment/build output account for slightly different hashes/sizes. Raw per-run results are committed in the adjacent JSON files.

Reproduce the optimized measurements:

```sh
npm run build
node scripts/measure-route-loading.cjs docs/performance/PPVC-636-after.json
```

Set `MEASURE_BUILD_DIR` to measure another production build directory containing its assets and asset-manifest.json. For builds before PPVC-634 renamed the launcher heading to Home, set `MEASURE_LAUNCHER_HEADING='Module Launcher'`. Do not run other browser tests/builds concurrently with timing measurements.

## Loading and recovery

The route-content boundary provides an accessible loading status while keeping the sidebar and header available. A failed JavaScript or CSS chunk shows a recoverable error with an explicit Reload page button. A full reload intentionally obtains the current HTML/chunk manifest and clears React.lazy's cached rejection; there is no automatic reload loop. Navigation to a different pathname resets the error. The same boundary protects public medical links and the settings modal. Existing route paths and permission checks remain in place; lazy loaders are only invoked after their guards allow rendering.

## Validation

- Production build passes (existing lint/bundle-size warnings remain).
- Eight unit tests cover loading, error recovery through navigation, denied loaders, and existing medical direct-link/magic-link permissions.
- Fifteen production-build browser smoke tests pass and cover deferred requests, all four selected route areas, direct links/reloads, back/forward, delayed chunks, failed JS and CSS downloads, reload recovery, navigation away from failure, unauthenticated and restricted access, medical-advisor access, public medical links, core navigation, and the existing announcement wizard/retreat history flow.

```sh
CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/components/RouteContentBoundary.test.tsx src/components/ProtectedRoute.test.tsx
PLAYWRIGHT_PRODUCTION_BUILD=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:4186 PLAYWRIGHT_WEB_SERVER_COMMAND='node_modules/.bin/serve -s build -l tcp://127.0.0.1:4186' npx playwright test e2e/lazy-routes.spec.ts e2e/announcements.spec.ts --project=chromium --workers=1 --retries=0 --reporter=line --output=/tmp/ppvc-636-e2e
```

Core screens and shared UI libraries remain eager in this first increment. The initial bundle is still substantial; additional route splitting can be considered separately. First visits to secondary screens now incur an on-demand download; subsequent visits reuse the loaded module.
