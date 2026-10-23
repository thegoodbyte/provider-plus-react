# PPVC-911 — Partial payments and overpayments against one invoice

For a 3,800 PLN invoice with 1,500 PLN received on one day and 2,500 PLN on another:

1. Open the payment request and select **Record payment**.
2. Enter **1,500 PLN** and its actual received date, then save. The request shows 1,500 PLN received and 2,300 PLN remaining.
3. Select **Record payment** again. Record the second transfer as **2,500 PLN** with its own actual date; do not replace the first payment or change the invoice to match the transfer.
4. **Payments against this request** now lists both payments and shows invoice 3,800 PLN, received 4,000 PLN, remaining 0 PLN and **overpaid 200 PLN**. Each transfer retains its own receipt and amount. The original invoice remains 3,800 PLN.
5. Review the extra money with the client. If refunding it, use the established audited payment refund workflow on the relevant payment. A recorded 200 PLN refund changes net received to 3,800 PLN and clears the overpayment. No refund, credit transfer or invoice modification happens automatically.

The section derives totals from completed payments and recorded refunds, using saved request/booking currency equivalents rather than current rates. Pending/failed payments do not count. Missing foreign-currency equivalents produce an error requiring review rather than an invented total. Read-only settlement does not repair or change financial records.

Record payment remains available for a non-cancelled request even when already paid, allowing genuine later receipts to be recorded. A new payment keeps its own current/entered date rather than copying the previous payment date. Payment mutations invalidate cached request data, so returning to the request displays the new state.

The normal service-request workflow remains separate. Verification uses synthetic disposable records and does not change production money.
