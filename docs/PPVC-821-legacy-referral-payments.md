# PPVC-821 — historical referral payment compatibility

Implementation only; not deployed. The separately authorized October 15 correction of the five JNO-08-22-26 expenses is already recorded in the shared release ledger. This change does not repeat it or write production financial data.

## Staff workflow

1. Open Referrals → Commissions and clients. Filter the partner and retreat.
2. A legacy paid expense with explicit matching booking, partner and retreat IDs appears as paid, using its stored amount, currency and date. Canonical allocations take precedence if the same expense also has an older booking link.
3. A whole-retreat payment without booking allocations displays a single allocation-review notice and links to the source expense. It does not mark arbitrary bookings as paid, even when the amount equals the commission estimate. Affected unpaid bookings are excluded from payable totals and payment selection.
4. A partially allocated payment preserves the explicitly paid bookings, displays the unallocated balance in the original payment currency, and blocks additional payout for that partner/retreat until reviewed. Unknown historical FX and inconsistent identifiers/duplicate allocations require review too.
5. Open Referrals → Payment history for the original payment totals, date, currency, source expense and allocation state. Totals remain separated by currency. The register counts expenses once; the commission view does not add a second copy of the payment.
6. For unresolved history, verify transfer evidence, partner, retreat and any existing booking links. Have staff reconcile the existing expense and retain the original values/provenance. Do not create a second payment or invent per-booking allocations. There is no new automatic allocation or financial correction action in this change.
7. Refresh after an authorized reconciliation. Fully allocated records return to the normal paid view. Financial fields/deletion on historical paid referral records are protected; notes/reference corrections remain available.

## Technical behavior

Only paid, actual, non-void records qualify. Partner/retreat metadata accepts populated IDs, ObjectIds and strings. Vendor text, transfer references, inbound client payments, and matching totals are never allocation evidence. Planned/pending/foreign-partner expenses do not count as paid. Canonical plus direct representation of one expense is counted once. Multiple expenses or repeated allocation lines for a booking trigger review instead of last-record-wins.

The report indexes booking/group candidates once and caches per-booking resolution. Quote and create endpoints reject unresolved/paid selections independently; creation stays inside the existing referral-payment lock and idempotency flow. Booking attribution changes cannot bypass existing legacy payment evidence. There is no data migration and no new outbound payment or notification integration.

## Validation

- API domain suites cover report/payment/bookings/expense guards, direct/canonical precedence, partial/whole/duplicate records, excluded statuses, provenance and currencies.
- Disposable real Mongo/Nest/JWT fixture validates exact PLN 4500 across five bookings, unchanged historical expenses after blocked payout requests, permissions, unrelated/planned isolation and successful idempotent ordinary payout.
- Browser tests at 1440px and 390px exercise persisted paid rows after reload, one whole-payment notice, disabled duplicate payout actions, payment-history/source links, and partial allocations.
- Full API suite has 32 failures in 8 unrelated suites; the exact same failures reproduce on untouched production commit eb10a397d9dac6878d414e274d7f7c124268edc3. See shared ppvc-821-validation logs. They remain a production release gate.
- Admin full unit suite: 268 suites / 1611 tests passed. Both builds passed. No production deployment verification.

Local fixture: start a disposable mongod at 127.0.0.1:27087, run `npm run build`, then `node test/legacy-referral-payments.fixture.cjs`. Run `node test/legacy-referral-payments.integration.cjs`; the fixture writes its synthetic JWT descriptor to the sibling validation directory. SIGTERM the fixture before stopping Mongo so its database is dropped. Browser tests use `PPVC821_FIXTURE` pointing to that descriptor and the local admin URL. Unrelated shell lookups are stubbed; referral endpoints run against the real fixture. FX is deterministic fixture data, not a live rate provider.

Release preparation must reconcile this report change with pending PPVC-893 pagination work; neither local implementation supersedes the other.
