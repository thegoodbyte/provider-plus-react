# PPVC-903 — request-first booking flow

Implemented locally; not pushed or deployed. No production financial data was repaired. Requires the PPVC-902 financial-integrity prerequisite included in this branch.

## Recommended flow

Use **client → request → actual payment/receipt → staff-confirmed booking** when collecting money before confirming a place. The request and payment remain traceable to the client while there is no booking. Neither issuing a request, receiving payment nor opening the booking form creates a provisional booking or reserves capacity.

Booking first remains appropriate when staff intentionally reserve a place before collection. Create a request against that booking and record the actual payment. The system does not force either order.

A booking owns its agreement and operational retreat. A request asks for collection. A receipt records the actual transaction; payments allocate that receipt. Their identities and amounts are preserved when the organizational request/booking links are filled in.

## Staff workflow after deployment

1. Create a payment request for the client/retreat and record the actual receipt when paid. Leave booking empty while the client is not yet booked.
2. Once ready to confirm, open the request and select **Create booking**. Review the prefilled client, retreat, full quoted price, currency and booking/ceremony type. Opening this form creates no booking.
3. Save the booking. The matching existing payments are allocated, the request receives its booking ID, and the booking response/balance reflects the real ledger before the save completes. Existing payment and receipt IDs remain unchanged.
4. The request now offers **Open booking**. Open the booking → **Payments** to see both the issued request and actual payment history.
5. If the booking already exists separately, open its Payments tab → **Link existing payment** → select the recorded payment → **Link Payment**. The request booking link and request list refresh immediately; no reload or second payment entry is needed.
6. If the booking already exists but the primary request is missing, select the existing request in Edit and save. Clearing a primary or reverse link remains explicit and preserves financial history, as in PPVC-902.
7. Do not create another booking from an already-used request. The action opens its existing booking, and the API rejects duplicate/competing saves. Use Reschedule for a date move or issue a new request when the financial agreement is replaced.

## Consistency boundaries

- Inverse request booking IDs are filled only during explicit writes: payment creation/retry/attachment, or primary request selection on booking create/edit. Reads do not invoke the new binding routine.
- Binding checks client, retreat, retreat-request context and existing booking ownership. A conditional Mongo update fills an empty inverse only and never overwrites another booking.
- Primary linking is synchronous, before asynchronous client/medical/workflow side effects. A losing concurrent create that has not moved payments removes only its own newly-created booking and returns an explicit conflict message. Existing booking/history/payment associations are checked before creation.
- Automatic allocation requires the exact selected request and matching client/retreat, and refuses payments with an existing booking or conflicting legacy booking hash. Matching names, amounts, or client/retreat alone are insufficient.
- An organizational request link never moves an existing payment from another booking. Shared/split allocations keep their own booking IDs; a request already spanning several bookings is not assigned an arbitrary single reverse ID. Multi-person request actions explain that participants need separate bookings rather than copying the whole quote into one person's booking.
- Saved request-currency equivalents are retained when they match the booking currency, including source/date and proportional refunds. Existing explicit booking-currency agreements retain priority. No new current FX quote replaces that recorded credit during attachment. The read projection, cached balance and request ledger agree.
- Requests remain requests, not received funds. The action copies the full quote into a review form, not the deposit amount or the legacy amountPaid request alias. It never prefills booking amountPaid from an invoice.

## Validation

Evidence is in ../ppvc-903-validation/validation.json. Checks include full API/admin unit suites, affected final UI unit checks, both builds and contract integrity, disposable real Mongo/Nest/JWT flows, PPVC-902 integrity regressions, historical currency/refund regressions, and four desktop/mobile browser flows.

Endpoint scenarios cover real request/payment/booking creation in either order, no automatic/provisional booking, synchronous primary selection, explicit payment attachment, existing IDs and receipt amounts, manual EUR→PLN credit and refunds, duplicate and concurrent saves, shared allocations, and explicit unlink preservation. External delivery, provider rates and background workflows are synthetic/disabled in the local fixture.

Historical production records are not bulk rewritten. Explicitly attaching/selecting their existing payment/request is the repair action; do not record the same received payment twice. This is not a new transactional accounting system or a change to booking capacity/status policy.
