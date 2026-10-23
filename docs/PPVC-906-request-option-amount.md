# PPVC-906 — amount in scratchpad request choices

Implemented locally; not pushed or deployed.

Open Payment scratchpad → a receipt → Match receipt. Search the Payment request selector by client or request number. Each option now starts with its request number and requested amount/currency, followed by the client and status. For example: #1352 · Requested: 5,100.50 PLN · Synthetic Payer · pending. The amount remains in the selected value. Placing it before the client name keeps it visible on narrow screens.

The label uses requestedAmount, falling back only to the legacy request amountPaid alias when requestedAmount is absent. It does not substitute the full booking quote or actual received funds. Explicit zero is 0.00; absent/invalid amounts say Requested amount unavailable. Currency and two decimal places are shown.

Search, relationship selection and staff approval continue as before. This change performs no financial writes and changes no request/payment amounts.

Validation: the scratchpad unit suite, frontend build and desktop/mobile browser scenarios (1440px/390px) cover same-client requests with different amounts, selected labels, zero/legacy/missing values, searching and no reconciliation without approval. Evidence: ../ppvc-906-validation/validation.json. Browser API responses are synthetic; no production data was accessed beyond the Jira ticket/screenshot.
