# PPVC-901 — booking 1310 does not list payment request 1392

Implemented locally; not pushed or deployed. No production financial data changed.

## Diagnosis

Targeted read-only production inspection on 2026-10-22 confirmed:

- Booking **1310** explicitly references request **1392** through its primary `paymentRequestId`.
- Request **1392** is paid for **10500 PLN**, but has no reverse `bookingId`.
- Completed payment **1187** references that request and is already allocated to booking **1310** for **10500 PLN**. The cached booking amount is also 10500 PLN.
- The request-list endpoint previously queried only `PaymentRequest.bookingId`. Therefore the request disappeared from the booking's Payment requests section despite both explicit associations and the recorded payment.

This is a discovery/display bug. It is not evidence of missing funds and does not require recording another payment or changing the historical request.

## Staff workflow after deployment

1. Open Bookings → **1310** → **Payments**.
2. Under **Payment requests**, request **1392** appears as paid, with **10500 PLN** and linked payment **1187**.
3. Choose **View** to inspect the original request. The recorded payment remains in **Payment history**.
4. Reload or return to the booking; the same request remains visible once.
5. If the request service is unavailable, use **Retry payment requests**. An unavailable list no longer states that no requests exist. A failed optional payment-plan fetch does not hide successfully loaded requests.

No relinking, financial correction or new payment is needed to use this fix.

## Implementation contract

The request-list read recognizes three explicit associations: the request's forward `bookingId`, the booking's primary `paymentRequestId`, and a request referenced by a payment allocated to the exact booking. Overlapping links produce one request row. All requests and payment-derived candidates must match the booking's client and retreat. Standalone service requests and inverse candidates explicitly assigned to another booking are excluded. The reader never infers a relationship from matching names, amounts, client/retreat similarity alone, or invoice numbers.

GET operations do not repair links or change payment/request/receipt records, prices, cached balances, timestamps, counters or workflow. Existing paid/unpaid statuses and payment amounts are preserved. Invalid booking IDs return 400 and missing bookings return 404.

The admin loads issued requests independently from optional payment-plan success and distinguishes loading, unavailable, empty and populated states. Request-list failures have an explicit retry action.

## Validation

- API unit suite under the project's existing release-test profile (`APP_ENV=production`, external providers mocked): **258 suites / 2793 tests / 1 snapshot passed**. The 32 failures from the first local-mode run were production-contract test expectations using development URL/job/provider fallbacks; rerunning with the established release runner's environment passed. No production jobs/providers were invoked.
- Admin full suite: **274 suites / 1650 tests passed**.
- Both application builds passed. API dependencies reuse the existing PPVC-776 install with an identical package-lock; an initial older dependency install lacked the Swagger build plugin.
- New unit tests cover inverse/payment-derived discovery, deduplication, ownership scopes, invalid/missing bookings, read-only behavior and UI request retry/independent plan failures.
- Real disposable Mongo/Nest/JWT/controllers regression covers the reported 1310/1392/1187 relationship, missing/null/direct/payment-only/overlapping links, unchanged financial totals, wrong owner/retreat/context/conflicting booking exclusions, unauthenticated access, invalid IDs and request outage recovery. Repeated complete database snapshots before/after GETs are equal.
- Desktop/mobile browser flows (1440px/390px) open the full booking Payments tab, verify paid request 1392/linked payment 1187 and actual payment history, view the request, reload, and recover from a sustained list outage while payment-plan loading fails. Payment and request endpoints use the real fixture; unrelated shell lookups and failure transports are controlled test boundaries.

Local fixture: start disposable Mongo on 127.0.0.1:27091, build the API and run `node test/booking-request-discovery.fixture.cjs`, then `node test/booking-request-discovery.integration.cjs`. The fixture descriptor is written to the sibling ppvc-901-validation directory; browser tests use `PPVC901_FIXTURE` pointing to it. Stop the fixture with SIGTERM before stopping Mongo so its database is dropped. No production credentials are used by the test fixture. Production diagnosis artifacts stay private and outside application commits.

Evidence: `ppvc-901-validation/validation.json`. Deploy API before frontend. No live verification of deployed application changes has been performed.
