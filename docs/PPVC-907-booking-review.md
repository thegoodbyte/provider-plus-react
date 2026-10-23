# PPVC-907 — Booking review after scratchpad reconciliation

1. Open Payments → Scratchpad and choose **Booking review**.
2. Use the existing date, currency, provider, account and search filters. Results are paginated; the selected view survives refresh.
3. **Review booking creation** identifies a positive, reconciled retreat payment without a valid booking allocation. Open **Review request** and check the client and retreat. If a booking is needed, use the existing Bookings → Add Booking workflow and select the request.
4. **Review existing booking** provides links to bookings referenced by the request, its history, a legacy booking hash, or the same client and retreat. Inspect these before creating another booking. A same-retreat match is a suggestion, not an inferred allocation.
5. **Check payment purpose** identifies client-only, additional or cancelled-request receipts which may not require a retreat booking. **Check client/booking/request link** requires investigation of missing or inconsistent records first.
6. Refresh after resolving the booking allocation. Once the payment is allocated to an existing booking belonging to its client, it leaves this view.

The view uses the actual payment/request relationship, not a captured request-number hint. It does not create bookings, attach payments, change balances, repair records or send notifications. Fully refunded receipts, standalone services and event requests are excluded. Partially refunded receipts with a positive remainder remain eligible. Existing bookings, including historical/cancelled records, are shown for review rather than silently duplicated.

The overview totals retain their existing meaning: logged receipts across the current ordinary filters, independent of the selected status view. They are not the booking-review subtotal or bank balance.

Validation: full API/frontend unit suites, both production builds, API contract check, real Mongo/Nest integration (refund exclusions, pagination, resolution and read-only snapshots), and Chromium desktop/mobile tests using disposable synthetic records. No production data was used or changed.

## Follow-up: payment request links and client-prefilled creation

- Payment requests list now has a Booking column. Both the list and request details show confirmed booking numbers as links; joint-request line items show each distinct linked booking. Unlinked requests explicitly say **No booking linked**. Raw legacy IDs use **View linked booking** rather than inventing a number.
- Select **Client bookings** on a payment request or scratchpad Booking review row to open that client's **Bookings** tab.
- Select **Add Booking** on the client Bookings tab. The existing booking form loads with that client preselected (including their current client record in the picker). Choose the retreat and, where applicable, the payment request, review the details, then save explicitly.
- The client ID stays in the URL so a browser reload preserves the preselection. No personal information is copied into the URL. Opening these pages never creates a booking or attaches payments.
