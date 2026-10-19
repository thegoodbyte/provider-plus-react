# PPVC-891: authoritative booking financial summary

Booking reads, the staff payment panel, IbogaReady and new booking confirmation PDFs use the server's version 1 financial summary. The agreed booking price is preserved; requests are never receipts. No migration or historical repair runs automatically.

## Staff use
1. Open a booking and its Payments section. Agreed price, gross receipts, refunds, net paid, balance and credit are shown in the booking currency.
2. Expand **Ledger reconciliation · read only** to compare the old cached paid value with the linked-ledger calculation and its source classification.
3. **Reconciliation required** means missing historical links or missing recorded conversion. An old cached amount remains visible for compatibility, explicitly unverified; it does not establish paid-in-full. Do not infer receipt of money from a payment request.
4. Use existing explicit payment/refund/linking actions for confirmed corrections. Refresh afterwards. Reading a history/report no longer links payments or updates balances/workflow state.
5. Generate a new confirmation PDF to use the current summary. Earlier stored PDFs remain historical documents; new server PDFs use unique object keys and append version metadata.

## Client use
Open My Retreat or Final Payment and refresh after a recorded payment/refund. Historical uncertainty is shown in English, Czech or Polish; refunds and credit are displayed separately. Client ownership remains based on the authenticated account, never a supplied booking/client ID.

## Read contract and reconciliation report
- `GET /payments/booking/:bookingId/financial-summary`: existing finance roles (admin/medical_staff), private/no-store.
- `GET /payments/financial-reconciliation?after=<booking-id>&limit=100`: admin only, private/no-store, at most 200 rows; follow `nextCursor` until null. All rows include booking ID/number, cached/calculated values, currency, source state, mismatch and reason. No updates, requests, messages or repair are performed.
- `contractVersion: 1`: `price`, `currency`, `grossReceived`, `refunded`, `netPaid`, `balance`, `overpayment`, `paidInFull`, `state`; `priceAgreement` preserves itemized agreements. `calculated` always contains linked-ledger values, even when display uses a historical cache for compatibility.
- `sourceState`: `verified_ledger` (including a successful zero result), `unreconciled_history` (cached funds without completed/refunded linked evidence), or `missing_conversion`. `cachedAmountPaid`, `discrepancy`, `mismatchReason` support classification before retiring compatibility.
- `provenance` retains original amount/currency, recorded booking-currency amount/source/date and USD snapshots. `recordedUsdSettlement` retains the existing separate USD settlement calculation for mixed currencies where available; no current rate is invented to repair a missing historical conversion. Missing booking-currency conversion stays explicitly unresolved.
- Completed allocations count once by booking ID or legacy hash; pending/failed/cancelled records do not count. Legacy refunded records contribute gross/refund history, not net receipts. Converted partial refunds reduce recorded converted value proportionally. Joint receipts use allocation rows, never the parent receipt total.
- PPVC-776 remains the owner of generated cross-repository contracts. Its future generation can consume this named, versioned response; PPVC-837 should consume this endpoint rather than calculate another balance.

## Verification
Unit/contract coverage includes zero price, partial/full/overpayment, refunds, status exclusions, joint allocations, legacy hydrated hash links, currency conversion/provenance, stale caches and empty historical ledgers. Isolated Nest-controller/Mongo integration compares the same booking across staff/portal/new PDFs through payment/refund/reload, checks access restrictions and snapshots that reads do not mutate finance records. S3 is in memory and JWT identity is injected for the fixture; the actual role guard is retained. Browser checks use built frontends, the real isolated financial API and stubs for unrelated shell APIs. No production records or real messages are touched.

The broad API suite has existing environment/policy failures reproduced on the unchanged production baseline. Exact results and limitations are in the workspace PPVC-891 validation evidence and release ledger. This implementation does not authorize deployment or waive release gates.
