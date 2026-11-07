# Duplicate payment requests (PPVC-995)

Use Duplicate on a payment request detail page or its row in Payment Requests.
The action prepares a new editable request; it never issues or sends automatically.

Standalone service requests create a separate saved invoice draft and navigate to
its explicit draft ID. All ordered charge/fixed-discount rows, quantities, prices,
title, currency, language, policy code and bill-to details are copied. Existing
service invoices support fixed discounts; this feature does not add new pricing
rules. Current configured payment methods apply instead of copying old payment
URLs. Review the recipient, items and a new due date, then Review request and
Issue payment request. Reload retains the copied draft and later edits. Other
saved drafts and browser recovery copies remain untouched. New draft/selection/
conflict-copy operations keep the draft URL synchronized, including recovery
before the first server save. Discard uses the existing draft lifecycle.

Retreat requests open the existing new-request form with a deliberate allowlist
of pricing, ordered charge/percentage-discount/fixed-discount/info rows and
client/booking/retreat context. Automatic active-booking balance defaults are
suppressed for duplication. Staff can review/change the fields and Create Request.
A fresh invoice number is generated normally. Existing balance-request uniqueness
and canonical financial validation still apply; duplication cannot bypass them.
The regular form retains its existing save/navigation behavior; saved recoverable
invoice drafts apply to standalone service invoices.

The allowlists exclude database/line IDs, invoice numbers, hashes, one-use Revolut
links, paid/cancelled state, paid dates, payment/receipt/linked-request associations,
settled amounts, consent acceptance, sent history, frozen FX and issuance keys.
New service copies use a new private draft UUID. Double clicks are guarded; an
ambiguous save verifies/reuses that UUID instead of creating another draft.
Normal draft issuance remains idempotent. Issuing another request records no
money and does not credit a booking. Original invoices and receipts are unchanged.

No API runtime, permission, schema or index changes are required. API commits for
this feature contain only portable test fixtures and database regressions using
production services/schemas/indexes, signed JWTs and RolesGuard. Currency-provider
responses and external email transport are synthetic/captured; no provider sends
or production financial data are used. Browser tests use the real local API/Mongo
for saved drafts, source reads and issuance; unrelated shell and retreat-form
lookup reads are synthetic. Build the API before starting the browser fixture.

Run `npm test -- --runInBand`, `npm run build`, and paired contract checks in admin.
Run API `TEST_MONGO_URL=mongodb://127.0.0.1:27017 npm run test:db`. The browser runner
requires `DUPLICATE_REQUEST_API_CHECKOUT` pointing to that built API checkout and
`TEST_MONGO_URL`; run `node scripts/run-payment-request-duplication-e2e.cjs`.
The runner fails if dependencies/Mongo/browser tests fail and cleans its fixture.
No deployment is included in implementation handoff. Reverting the UI leaves
existing owned drafts and requests intact; do not delete financial records.
