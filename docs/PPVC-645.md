# TypeScript / React compatibility audit (PPVC-645)

The core upgrade already landed with PPVC-644's Vite migration. No second framework upgrade is needed. Both frontends use TypeScript 5.9.3, React/React DOM 19 and major-version-19 React type packages. Their application tsconfig enables strict checking, the React JSX runtime and bundler module resolution.

- Admin installed versions: React/DOM 19.2.0, @types/react 19.2.7, @types/react-dom 19.2.3.
- Portal installed versions: React/DOM 19.2.6, @types/react 19.2.14, @types/react-dom 19.2.3.

Patch versions need not match between runtime and DefinitelyTyped; the React major must match. Existing dependencies and lockfiles were preserved. No incompatible package update was required by the application build.

`npm run build` runs `tsc --noEmit -p tsconfig.build.json` before Vite. This strict check covers application refs, contexts, hooks, forms and lazy-route imports. The production configuration excludes Jest test sources. Jest executes test files with Babel separately; a successful build is not a claim that every test source has been type-checked.

Both production builds passed. The portal's 43 unit suites / 187 tests passed, and its isolated route/reload, static-asset and public-questionnaire browser checks passed. The admin's booster browser scenarios also pass, including both ceremony choices and the missing-record guard. See the workspace validation record for complete counts and existing-suite limitations.

Broader unchanged-production checks exposed existing issues outside this upgrade: the admin RetreatDetailView email-composer unit suite stalls, the ReferralAssignmentNotifications unit fixture lacks the raw API mock used by its portal-account child, and three portal aftercare browser scenarios fail (closed-preparation card, support form, mobile menu). These failures were observed with unchanged production application/test sources; no runtime source or package changes are included in this ticket. They are not described as passing.

Use `npm test -- --runInBand` for the full unit suites. Admin validation of remaining suites uses `--testPathIgnorePatterns=RetreatDetailView.email.test.tsx` and records that exclusion explicitly. For portal browser compatibility, build first and run:

```sh
SMOKE_PORT=43645 npx playwright test -c playwright.smoke.config.ts smoke/migration.spec.ts smoke/public-entry.spec.ts
```

Production smoke runs skip the development-only hot-reload and real-development-credential tests. No credentials or production financial/medical data are required for these fixture checks.

Recorded admin result with the stalled email suite excluded: 244 suites / 1,448 tests passed; one suite / one test failed due to that missing fixture mock. The isolated admin production-browser run passed five checks (three booster plus two migration) with one development-only skip; the focused portal browser run passed three checks with two development-only skips. This audit does not claim the complete legacy test suites are green.
