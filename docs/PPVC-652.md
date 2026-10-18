# PPVC-652: unit-test performance

The frontend already uses Vite for builds and Babel-Jest for unit tests. Jest
does not invoke Webpack or Vite. `babel.config.cjs` handles TypeScript, JSX and
ES import/export syntax; the existing Jest transform allowlist covers the
configured ESM dependencies. This change keeps those transforms, mocks and
coverage thresholds intact.

Profiling identified `RetreatDetailView.email.test.tsx` as the main bottleneck.
Ant Design's generated runtime styles and decorative motion made jsdom's CSS
selector/visibility work expensive. The test now wraps the real component in
a local `ConfigProvider` with `zeroRuntime: true` and `motion: false`. No static
stylesheet is loaded in this behavioral unit test; real browser tests such as
`e2e/retreat-bulk-email.spec.ts` retain production styling and animations.
See Ant Design's [zero-runtime and motion documentation](https://ant.design/docs/react/customize-theme/).

All seven email scenarios keep their original role/label queries and API
assertions: custom sends, recipient-language locking, clearing a template,
delayed previews, translation preparation, invalidation after edits and failure
handling. The test-specific 120-second timeout and 10-second async-query
timeout are removed; normal Jest and Testing Library deadlines apply again.
No application code or production configuration changes.

## Measured result

Single local cold-run comparison on Node 22.20.0, using the same base commit,
serial Jest invocation and `--no-cache` flags:

| Scope | Before | After |
| --- | ---: | ---: |
| Full suite, including process startup | 276.6 s | 62.9 s |
| Retreat email test file | 223.1 s | 6.7 s |
| Passing suites / tests | 260 / 1,556 | 260 / 1,556 |

The full run was 77.3% shorter (4.4× faster). Test identities and statuses match
exactly; no tests were removed or skipped. These are local measurements, not a
timing guarantee for CI. Production build and the timing helper's successful
and failure exit paths were also verified.

## Reproduce and diagnose

1. Install the locked dependencies with `npm ci --legacy-peer-deps`.
2. Run `npm run test:timings` for a serial, uncached full suite. The command
   preserves Jest's failure exit code and writes its JSON report under the
   already ignored `test-results/` directory.
3. Inspect `testResults[].endTime - startTime` for slow files, then
   `assertionResults[].duration` for individual tests. Confirm that test names,
   counts and statuses match before comparing elapsed times.
4. For a focused measurement, run
   `npm run test:timings -- src/components/RetreatDetailView.email.test.tsx`.
   Each run replaces the timing report; save a copy before comparing revisions.
5. Continue using `npm test -- --runInBand` for normal cached runs. Use
   `npm run build` for the separate strict application type check and Vite build.

Compare the same commit scope, Node/dependency versions and flags. Wall-clock
measurements depend on machine load; avoid timing thresholds in correctness
tests. Only use the local no-style provider for behavioral tests whose styling
is covered in a browser, not for visibility, layout or animation regressions.
