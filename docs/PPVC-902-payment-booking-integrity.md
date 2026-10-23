# PPVC-902 — booking and payment-request integrity

Implemented locally. Production deployment and historical data repair are pending.

## Architecture

A booking owns its agreement (price/currency/accommodation) and current operational retreat. A payment request asks for collection; its requested amount is not money received. A payment is an actual allocation; the receipt records the actual transaction and currency. The booking primary request and request booking links organize the workflow, while payment booking allocations own the financial ledger. Changing an organizational link must not move money or rewrite an issued request.

Legacy response `amountPaid` on a payment request remains an alias of requestedAmount for compatibility. Financial settlement uses amountReceived and the actual allocations; do not treat that alias as received funds.

## Flaws corrected

1. Clearing the booking primary request omitted the field during serialization. Edits now send explicit null, with a nullable generated API contract.
2. Selecting another request in an existing booking overwrote retreat, agreed price/currency, accommodation and booking type. Existing agreements now remain intact. Stale async request fetches cannot restore a cleared selection.
3. Booking edits accepted missing, foreign-client, wrong-retreat, standalone-service or other-booking requests. New primary associations validate these boundaries; unchanged historical primaries may retain their original retreat after a move.
4. Clearing a request's reverse booking link was discarded by both the controller and Mongoose. It now persists null. Partial request updates no longer apply creation defaults that reset requested amount/full price/type/issue date.
5. Changing an invoice booking link silently moved or unassigned actual payment allocations. Those allocations now stay intact and require the existing explicit payment workflow to change.
6. Request discovery filtered every historical record by the current retreat, hiding issued requests after rescheduling. Explicit booking/payment/history anchors preserve historical visibility with client/context/conflicting-booking checks. Pure primary pointers still require the current retreat. Reads remain read-only.
7. Legacy payment writes marked an entire request paid after any completed partial allocation. All records now use the shared versioned ledger reconciliation.
8. Payment reassignment refreshed only the new request; deletion and joint-receipt collapse reset old requests without considering survivors. Both sides are reconciled against surviving allocations. Collapse also scales the frozen credited request equivalent.
9. Refunds left stale paid date/payment/receipt pointers, or selected the triggering refund/deleted payment as the paid reference. References now come from surviving positive allocations and clear when unsettled.
10. Legacy partially refunded records counted differently in request and booking totals, including a booking query that discarded them before calculation. Net remainders now agree; fully refunded records contribute zero.
11. Manual mark-paid endpoints could accept an unrelated/partial payment and bypass accounting. They now require a completed linked payment and a fully funded ledger, then use shared reconciliation.
12. Requests with recorded payments could change financial ownership/currency; linked requests could be deleted leaving dangling evidence. These operations now reject before changes. Use replacement requests, clear primary links or cancellation as appropriate.
13. Deletion could fail on an unresolved foreign ledger only after removing the payment. Conversion checks now run before deletion.

## How to use after deployment

1. Open a booking and choose Edit. In Payment request, choose Clear selection and Update Booking. Reload: the primary stays empty; issued requests and payment/receipt history remain.
2. To change dates, open the booking's More menu and choose Reschedule booking. Select the retreat, reason and internal note. Optionally check Clear the primary payment request link. It is off by default; the reschedule history records a detached primary. Confirm the move.
3. Open Payments to review prior requests and actual receipt allocations, including records issued for the previous retreat. They do not become new money or duplicate payments.
4. Link a suitable new request through Edit if required. The existing price/currency/accommodation stay unchanged. Use Manage booking price for an intentional price agreement change.
5. A partial payment leaves the request outstanding. Fully funding it marks it paid. Refunds reopen outstanding balances; reassignment/deletion recalculates surviving allocations.
6. Request booking-link edits organize the request only. Use the explicit payment allocation workflow if actual money needs reallocating. Requests that form part of financial/booking history must be preserved.

## Validation and limits

Full API and admin unit suites, both builds, generated contract integrity/tests, real Mongo/Nest/JWT endpoint scenarios, existing request-currency/receipt regression scenarios and desktop/mobile browser workflows are recorded in ../ppvc-902-validation/validation.json.

The fixture owns only disposable loopback data. It uses real financial/booking services and models; external document delivery, provider calls, background scheduling and notifications are disabled or synthetic. Historical production records are not bulk rewritten. An unresolved legacy foreign payment requires a recorded equivalent before affected financial mutation. This change does not replace the existing explicit allocation controls or introduce a new accounting ledger.
