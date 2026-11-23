# Reproducible release coverage

The PPVC-1001 release initially recorded 165 broad and 18 smoke skips after its
70 broad / 9 smoke failures were repaired. Skips did not satisfy the release gate.
This follow-up runs the missing fixtures and replaces obsolete test infrastructure.

## Run the formerly skipped coverage

Build the matching API once before starting any fixture (`npm run build`). Supply
its checkout, a disposable **loopback MongoDB without an application database
name**, and these locally served matching applications:

- `PLAYWRIGHT_BASE_URL`: built admin application.
- `PLAYWRIGHT_FIXTURE_BASE_URL`: admin Vite server (component harnesses and HMR).
- `CLIENT_PORTAL_FIXTURE_BASE_URL`: matching IbogaReady Vite server.
- `INVOICE_CLIENT_WEBSITE_URL`: canonical public invoice website Vite server.
- Optional `COVERAGE_IR_URL`: built IbogaReady app for EKG journeys; otherwise uses
  the supplied portal Vite server.

Build admin with `REACT_APP_CLIENT_INVOICE_PREVIEW_URL` pointing at the supplied
website's `/clients/payment/admin-preview` URL. Keep the production iframe origin
validation enabled. Start local servers with their normal scripts using available
ports; no production snapshot, credentials or production writes are needed.

```sh
TEST_API_CHECKOUT=/absolute/path/to/api \
TEST_MONGO_URL=mongodb://127.0.0.1:27017 \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5101 \
PLAYWRIGHT_FIXTURE_BASE_URL=http://127.0.0.1:5103 \
CLIENT_PORTAL_FIXTURE_BASE_URL=http://127.0.0.1:5097 \
INVOICE_CLIENT_WEBSITE_URL=http://127.0.0.1:5093 \
COVERAGE_OUTPUT=/absolute/path/to/evidence \
node scripts/run-coverage-resolution.cjs
```

`node --test scripts/coverage-process.test.cjs` verifies signalled-child cleanup,
cooperative and forced termination, failure propagation, and missing-configuration
rejection. Keep this regression check alongside the browser gate.

The port numbers above are examples; all fixture ports are allocated dynamically.
With `COVERAGE_FULL=1`, the runner starts every supplemental API/domain fixture
itself and overwrites any stale fixture-file environment values. It owns separate
scratchpad databases for broad and smoke coverage. Do not reuse a prior run's
fixture output after interruption: those synthetic records may already be edited.
The runner rejects remote URLs, starts each domain fixture on its own database,
serializes shared fixture resets, saves source IDs/commands/UTC/exits/raw reports,
and closes only its own fixture children. It runs broad, smoke and development
HMR coverage separately and fails for **any failure, flaky result or skip**. A
fixture startup failure also fails the run. Set `COVERAGE_FULL=1` to collect the full broad and smoke suites; provide their
additional existing fixture environment variables through the release orchestrator.
The same zero-skip rule applies to full mode. This supplements the full repository
unit/database/E2E/build gates; it does not replace them.

## Resolution map

| Former skipped suite                                    | Permanent resolution                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client management                                       | Fresh production client services/schemas/indexes per browser/device; actual create, generated/manual IDs, update, search, status filter, reload and sibling isolation.                                                                                |
| Navigation                                              | Deterministic read-only API responses; assert actual grouped menu actions, mobile inert/focus behavior, history, deep links and errors. No optional assertions when controls are absent.                                                              |
| Retreat management                                      | Current client grid, selector search, section persistence, stay planner and responsive controls. Read-only fixture rejects writes. Actual booking persistence remains in request-first, paid-request, required-room and reschedule suites.            |
| Payments                                                | Current dedicated editor replaces the removed add-payment modal. Actual Mongo/service payment creation, exact booking link, reload, read-only cancellation, delete cancellation, search and responsive rows.                                          |
| Lazy routes                                             | Built Vite chunks and actual route CSS; permission and unauthenticated checks remain. Communications has separate settings and history entries; choose the intended entry.                                                                            |
| Client tasks / referrals / MRR follow-up                | Replaced private snapshot, hardcoded checkout/credentials/ports with fresh production service/controller/schema fixtures. Preserve client/staff visibility, capture email transport, assert saved notes, audit/history and unchanged sibling records. |
| WhatsApp DTO contract                                   | Real guarded controller/validation pipe and production MRR service/database replace the stand-alone DTO server and in-memory saved row. Exercise both grid and detail save/reload on desktop/mobile, invalid-field rejection and sibling isolation.   |
| Financial, booking, medical, language, screening suites | Start their checked-in domain fixtures on free ports and fresh databases. Current required room choices must be selected; do not restore implicit missing accommodation defaults. Drain in-flight API proxy calls before disposing HTTP contexts.     |
| Missing smoke fixtures                                  | Start actual integration-call, booster, EKG, contact-card, reminder and referral pagination fixtures; bundle audit supplies real PDF chunk IDs.                                                                                                       |
| Development HMR                                         | `playwright.hmr.config.ts` explicitly runs `smoke/migration.hmr.ts` against Vite. It cannot run against a production build and is no longer silently skipped there.                                                                                   |

### Retired quick-book checks

`RetreatDetailView` still contains an unreachable legacy modal implementation,
but its Quick Book Client trigger is no longer rendered. The old three form
scenarios (duplicated in Chromium/Firefox) depended on that trigger. The old
negative-amount scenario contained no outcome assertion and cannot be claimed as
coverage. They are **retired, not reported as passed**:

- Required booking fields / room selection: actual required-room and screening
  validation browser suites, plus real booking service/database validation.
- Client required fields and invalid email: current `forms-validation.spec.ts`,
  using actual client persistence and retry/reload checks.
- Money inputs: current exact-booking payment journey and database financial
  invariants; no new rule about negative agreed booking prices is inferred from
  the old assertion-free test. Refunds intentionally use negative ledger amounts.
- New booking creation: actual paid-request, request-first and reschedule suites.

The task request UI also now links to `/support`; the former inline request form
is no longer on My Tasks. Existing `client-support.spec.ts` and the production
support database suites cover request creation/privacy/retry; the client-task
suite retains real task visibility and captured status notifications.

No retired scenario counts toward passing totals. Keep the pre-resolution skip
inventory and before/after source IDs with each release, alongside final reports.

### Reusing an unchanged completed broad result

After a smoke-only fixture-wiring repair, `COVERAGE_REUSE_BROAD_EVIDENCE` and
`COVERAGE_REUSE_BROAD_GATE_RECORD` may point to the original complete broad
receipt and its outer command/environment record. The runner rejects any failed,
flaky or skipped broad report, changed application/schema/dependency/broad-test
files, non-ancestor sources, changed application URLs or Mongo/API environment.
Only the explicitly listed smoke-service infrastructure paths are eligible.
The scratchpad smoke definition-list locator migration is also eligible; it is
not imported by the broad suite. Its payment persistence assertions still run in
the fresh smoke gate. The isolated `smoke/canonical-ekg.spec.ts` network-drain repair is also eligible: it is not imported by broad tests and retains all medical-state assertions. Its full smoke scenarios must rerun with fresh fixtures. Permanent regressions reject broad financial and medical test changes.
`node --test scripts/coverage-reuse.test.cjs` exercises this with real temporary
Git histories and rejected application/environment/report changes. The original
broad command, source IDs and UTC times are retained as reused evidence; smoke
and development HMR must still execute and pass. This is never a skip or an
exception for a failed check.

The isolated `smoke/partial-receipt-allocation.spec.ts` cleanup also qualifies: await all in-flight route callbacks in `finally` before the shared HTTP context is disposed. Financial balance, ownership, allocation count and reload assertions remain unchanged. Fresh full smoke/HMR are required; any broad receipt-test or application change still invalidates reuse.
