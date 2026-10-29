# Booking payment reconciliation regression

A paid request and a paid booking are distinct: completed/refunded ledger allocations determine booking balances. A payment received before a booking exists can legitimately have no bookingId. A later request metadata edit must never silently move receipt ownership; request settlement must visibly flag missing/conflicting/unfinished allocation and offer explicit review. Explicit reviewed allocation recomputes totals rather than incrementing cached balances, and retries finish partial work without creating money again.

The PPVC-952 regression follows the audited order: receive 6,600 PLN against an unbooked PR, later add booking1311 via the real request update endpoint, observe the warning, confirm existing payment allocation, reload and assert 4,400+6,600=11,000 paid. Both original payment/receipt identities and original exchange rates survive, no email is sent, and the cancelled primary request remains unchanged.

Run from a clean admin checkout with dependencies installed, a sibling API checkout with dependencies installed, local MongoDB running, and Chromium installed (`npx playwright install chromium`):

```sh
TEST_MONGO_URL=mongodb://127.0.0.1:27017 npm run test:booking-reconciliation -- --api ../api --output ../booking-reconciliation-results
```

The command builds the API before starting its fixture, chooses local service ports, runs both real API/Mongo browser journeys, rejects skipped/missing/flaky journeys and stops its services. Never rebuild API dist while that fixture is running. External delivery/FX/PDF fixture boundaries are stubbed; business services, schemas, indexes, auth and money writes are real. Output includes service logs, Playwright JSON and source IDs. The API `npm run test:db` gate includes the same exact-order, retry, sibling, refund and forbidden-link regressions automatically.

For changes to receipt/PR/booking relationships, run the dedicated browser gate in addition to full relevant unit/API E2E/database/build checks. A mocked success response or an assertion against a paid PR status alone does not prove a booking is paid. Production releases still require all workspace release gates; this command does not deploy anything.
