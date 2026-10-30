# Link a request to money already recorded

In Payment requests, choose **Link existing payment** on the request row (admin only). Search by optional amount and inclusive UTC date range, using the same payment picker as scratchpad. The request client/currency stay fixed even with Match any. Payments recorded from scratchpad are included.

Select a payment, check its client/transaction/booking, tick confirmation and choose **Confirm existing payment link**. The existing payment is attached and request settlement/booking balance refresh through the existing canonical linking service. Partial payments remain partial. Nothing is recorded twice and no email is sent. Cancel/search does not change money.

An interrupted refresh keeps the selection: retry the same link. If the link succeeds but the grid cannot refresh, close/reload before another action. Already linked payments are disabled; a durable pending same-request link can still be resumed. Other-request, wrong-client/currency, refund, currency-adjustment, split, unfinished-edit and incompatible-booking cases cannot be linked here.

The scratchpad workflow is preserved. It uses the same filters/results component, while retaining its receipt/provider/amount/account/provenance restrictions. Linking a PR to a scratchpad-created payment does not attach a second scratchpad receipt.

## Local regression

Build the matching API checkout first. Start disposable loopback MongoDB, then in admin:

```
TEST_MONGO_URL=mongodb://127.0.0.1:<port> \
REQUEST_EXISTING_PAYMENT_API_CHECKOUT=/absolute/path/to/api \
REQUEST_EXISTING_PAYMENT_ARTIFACT_DIR=/absolute/path/to/screenshots \
node scripts/run-request-existing-payment-e2e.cjs
```

The runner starts isolated API/admin servers and cleans up its database/servers. Missing dependencies fail rather than skip. Both desktop/mobile journeys use real MongoDB and canonical services; mail boundaries are disabled and auxiliary UI configuration reads are synthetic. Native regressions live in API test/database/scratchpad-payment-search.test.cjs and are included in npm run test:db.
