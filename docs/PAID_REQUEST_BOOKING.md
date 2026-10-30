# Received payment to booking

Recommended flow:
1. Record the incoming transfer once in Payment scratchpad.
2. Select its payment request and **Confirm payment from scratchpad**. This records the actual payment and refreshes request settlement. If the payment already exists, choose **Existing payment** and link it instead.
3. Stay on the matched receipt. Under **Payment recorded — next, the booking**, choose **Create booking**. Review the client, retreat, room, dates and full agreed price, then save. The existing request/payments are linked automatically and the booking balance is refreshed.
4. The saved booking opens. Returning to/reloading the receipt offers **Open booking**.

A paid deposit is not the full booking price or proof that the booking is fully paid. A missing full price must be entered in the booking form; the deposit is never copied into that field. Creating from an existing request disables automatic new payment-plan requests for this save. No email is sent by these steps.

Other supported paths: a paid request in Payment requests can create the booking using the same checked action. Booking link review offers creation when no existing candidate exists. If a booking already exists, review/link it instead of creating another. Standalone services, additional fees and multi-person allocations are outside single-booking creation.

## Regression checks

Build the matching API checkout first (`npm run build`). Start a disposable local MongoDB. Then, in the admin checkout:

```
TEST_MONGO_URL=mongodb://127.0.0.1:<port> \
PAID_BOOKING_API_CHECKOUT=/absolute/path/to/api \
PAID_BOOKING_ARTIFACT_DIR=/absolute/path/to/screenshots \
node scripts/run-paid-request-booking-e2e.cjs
```

The runner starts isolated API/admin servers, uses real MongoDB production schemas/indexes and canonical payment/booking writers, and cleans up its database and servers. Missing dependencies/Mongo fail rather than skip. Both desktop/mobile journeys must pass. Mail/document delivery boundaries are captured. Native regression: `test/database/guided-scratchpad.test.cjs` in the API, included in `npm run test:db`.
