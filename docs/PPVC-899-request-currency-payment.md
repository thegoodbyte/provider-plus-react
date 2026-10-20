# PPVC-899 — record a payment in a different currency from its request

Implemented locally; no production push, deployment or financial data edits.

## Staff usage

1. Open a payment request and choose to record its payment, or use Payments → Add Payment and select the request. The booking payment form has the same request-conversion controls.
2. Enter the **actual received amount and currency**. For example, enter **100 EUR** against a **1000 PLN** request. Do not enter the PLN equivalent as the received EUR amount.
3. The request-currency panel appears when the currencies differ. Choose **Automatic dated ECB rate**, or **Confirmed bank or manual equivalent**.
4. Automatic mode previews the dated rate, published rate date, source and equivalent. The server obtains and stores the authoritative dated quote when saving. A weekend may use the previous published rate.
5. For a confirmed bank conversion, enter the credited equivalent (for example **425 PLN**), source (such as a Revolut/bank confirmation reference) and conversion date. The effective rate is shown as **1 EUR = 4.25 PLN**. No automatic quote may overwrite a manual entry. If dated rates are unavailable, use this evidenced manual option.
6. Save the payment as completed when the funds have actually been received. The request remains **1000 PLN**; this example credits **425 PLN** and leaves **575 PLN** outstanding. The actual receipt remains **100 EUR**. Pending payments do not settle the request.
7. Reopen the payment to see the stored equivalent/source/date. Payments history shows the received currency alongside the request credit; receipt PDFs also distinguish these amounts. The booking ledger receives the same saved credit when its currency matches the request.
8. A note/status edit keeps the historical conversion. Changing a manual payment's amount/currency requires reconfirming the equivalent/source/date; the form clears stale values. Refunds reverse the original credited amount proportionally using its historical conversion, rather than today's rate.

Supported receipt/request currencies: EUR, PLN, CZK and USD. Standalone service requests also accept a different receipt currency while keeping their existing immutable-allocation/refund workflow.

## Stored financial contract

`amount`/`currency` and receipt totals describe actual funds. `requestCurrency` is bound to the selected request on the server. `requestCurrencyAmount`, `requestCurrencyExchangeRate`, `requestCurrencyExchangeMode`, `requestCurrencyExchangeSource` and `requestCurrencyExchangeDate` are the saved request credit. Automatic amounts/rates/source are calculated server-side; a supplied automatic amount cannot override the quote. Manual equivalents must be positive, finite amounts with at most two decimal places, a 3–500 character source, and a valid date.

No request price/currency is changed. Partial/full/refund totals are derived from completed allocations in request currency using an optimistic settlement revision so an older reconciliation cannot overwrite a newer total. Existing explicit legacy booking-currency equivalents remain usable; unresolved historical foreign-currency entries require staff review before another receipt/payment is created. No backfill or automatic reinterpretation of old payments is performed.

Booking currencies different from both request and receipt retain a separate booking conversion. This work covers individual allocations; existing joint/split receipt restrictions are retained. Manual historical request conversion does not bypass the system's separate USD valuation dependency.

## Verification and limitations

- Payment API unit/domain coverage includes actual dated versus manual conversion, source/date validation, partial/full/refund amounts, same-currency behavior, currency settlement preference and PDF presentation.
- Disposable real Mongo/Nest/JWT checks cover EUR receipts against PLN/CZK/USD requests, booking and standalone contexts, unchanged request amounts/currencies, saved metadata/receipts, partial/full status, proportional refunds, immutable standalone records, note preservation, rejection of stale manual edits, concurrent receipts, unresolved legacy preflight, invalid manual input and dated FX outages before financial writes.
- Desktop/mobile browser flows (1440px/390px) save/reopen actual persisted payment data and verify manual recovery from a dated quote outage. Shell lookups are stubbed; payment endpoints use the fixture. Screenshots are in the sibling validation folder.
- Both builds and relevant tests pass. The full admin run passes 268 suites/1612 tests; final affected checks include the additional conversion component tests. Full API has the same 32 failures in eight unrelated suites reproduced on untouched production `eb10a397d9dac6878d414e274d7f7c124268edc3` (baseline evidence `ppvc-821-validation/api-baseline.json`). These remain a release gate. No live production/provider verification.

For local integration, build the API, start disposable Mongo on 127.0.0.1:27089, and run `node test/request-currency.fixture.cjs`, then `node test/request-currency.integration.cjs`. The fixture uses synthetic rates and suppresses external document delivery; actual receipts/payments/requests/bookings persist locally. Its counters start at the existing production numbering floor. SIGTERM the fixture before stopping Mongo to drop its disposable database. Browser tests use `PPVC899_FIXTURE` pointing to the generated sibling validation descriptor, plus the local admin URL.

Deploy API before frontend. Shared evidence: `ppvc-899-validation/validation.json`.
