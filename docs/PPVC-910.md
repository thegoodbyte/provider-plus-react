# PPVC-910 — Create booking from a paid request

1. Open Payment Requests and select **Paid without bookings**, or open the paid request directly.
2. Select **Create booking**. The action fetches the current request and checks Booking link review before opening the form. It performs no booking/payment writes.
3. If a booking already exists for this client and retreat, open it or choose **Review and link existing booking**. Confirm the relationship through the PPVC-909 workflow instead of creating a duplicate.
4. Otherwise, the existing booking form opens with client, retreat, request, agreed full booking price, currency and supported booster context prefilled. Review the form, then save explicitly.
5. Saving synchronizes the request and its existing payments to the real booking. The API repeats the duplicate/similar-booking checks even if the form was opened directly. Existing receipts and frozen payment equivalents are preserved.

Cancelled/service/additional/multi-participant requests are not offered as ordinary single-client booking creation. Active same-client/same-retreat bookings require review; legitimate separate arrangements use the established staff workflow rather than bypassing the guard. Existing request, reverse-history and allocated-payment references also block duplicates. A similar booking is never silently linked.

This builds on the already implemented PPVC-903 request-first booking changes and PPVC-909 review. Their exact prerequisite source commits are tracked in the shared release ledger. No production push or historical data repair is included.
