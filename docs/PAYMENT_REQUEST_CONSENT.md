# Payment request consent setting

Create or edit a deposit request. **Require consent before payment** is checked by default, including when the new form is opened with prefilled client/retreat information. Uncheck it when consent is not needed for that request, then save. Reopening the editor preserves the choice.

The public ISCZ Czech and Polish payment pages honor that saved setting. When unchecked, the client goes directly to payment details; no consent, signature, identity change, PDF or email is fabricated. Additional, balance and other non-deposit requests skip deposit consent. When required, the client's acknowledgement boxes remain unchecked. Legacy requests without the setting keep the existing deposit-only default, including null legacy values. Existing signed consent evidence is preserved when the setting changes.

The authenticated **Preview online invoice (admin)** already bypasses the form under PPVC-931. Continue using it for a read-only view of the actual client renderer. A public URL query parameter cannot enable admin preview or waive consent.

## Regression

Build the matching API checkout (`npm run build`), start disposable loopback MongoDB, then in admin:

```
TEST_MONGO_URL=mongodb://127.0.0.1:<port> \
PAYMENT_CONSENT_API_CHECKOUT=/absolute/path/to/api \
PAYMENT_CONSENT_CZ_CHECKOUT=/absolute/path/to/cz/react-app \
PAYMENT_CONSENT_PL_CHECKOUT=/absolute/path/to/pl/react-app \
PAYMENT_CONSENT_ARTIFACT_DIR=/absolute/path/to/artifacts \
node scripts/run-payment-consent-e2e.cjs
```

The no-skip runner starts isolated API/admin/CZ/PL servers and cleans them and the synthetic database afterwards. Consent persistence/public projections use real production MongoDB schemas/indexes and services. Auxiliary room options/configuration reads are synthetic; public Origin/CORS headers are mapped by the local browser test proxy to emulate an allowed production website, without changing production origin restrictions. The actual trusted PL preview renderer is used. External delivery is disabled/captured.

Native API regressions: test/database/payment-consent-policy.test.cjs, included in npm run test:db. Optional boolean schema needs no migration or index changes; historical absent/null values are not backfilled. Deploy API first, then CZ/PL public clients, then admin so the opt-out control is exposed after both public clients can honor it.
