# PPVC-858 — Simplified scratchpad and request/client matching

## Using the feature after deployment

1. Open Payments → Scratchpad → New receipt. Enter the received date, amount, currency and provider. Receiving account is hidden and is no longer required.
2. Optionally enter payer name, Transaction ID, Phone number, payment request number and notes. Transaction ID replaces the two former transaction/reference inputs for new capture. The phone field preserves international prefixes and formatting (up to 50 characters).
3. Save receipt. Open its details or Edit receipt to review/change the phone number; reload retains it. Existing account and transfer-reference data are preserved and remain available in historical receipt details/audit information.
4. Choose Match receipt from View or the row action. Search Payment request by request number, invoice number or client name/number. Selecting a request fills its client and booking. Alternatively, search/select the Client directly. Recording or searching alone never assigns a payment or changes balances.
5. Existing-payment results reload for the selected client and payment request while keeping the original amount, currency and provider constraints. This can find older eligible payments beyond the initial unfiltered limit of 50. Cancelled requests are omitted. A lookup failure offers Retry matching payments and blocks confirmation until reviewed results load.
6. Review the selected relationships and explicitly confirm conversion or choose an existing payment. Linking with incomplete account metadata requires checking the original transaction and confirming it. Known account mismatches are still rejected, and unknown receipt accounts never overwrite an existing payment's known account. The existing retry/idempotency and reconciliation locks remain in place.

Phone numbers are stored on scratchpad receipts and audit history. This does not modify a client's phone number or send messages.

## Validation

Both API and frontend production builds passed. 122 focused API/payment tests and 14 frontend component tests passed. All 14 desktop/mobile browser journeys passed. Real standalone MongoDB integration exercises optional fields, formatted phone persistence/search/audit, historical field retention, concurrent unknown-account duplicate capture, conversion, explicit existing-payment linking, known-account preservation, candidate filtering and the existing auth/retry/currency invariants. Browser tests use the actual isolated API/database with synthetic data on desktop and mobile. Test email provider rejects all messages; no production records are touched.

Commands:

- API: npm run build; npm test -- --runInBand scratchpad.validation.spec.ts payments.service.spec.ts
- Integration: SCRATCHPAD_MONGO_PORT=27058 node test/payment-scratchpad.integration.cjs
- Frontend: npm run build; npm test -- --runInBand src/components/PaymentScratchpadPage.test.tsx
- Browser: SCRATCHPAD_FIXTURE_PATH=/tmp/ppvc858-fixture.json SMOKE_PORT=43858 npx playwright test -c playwright.smoke.config.ts smoke/scratchpad-fields.spec.ts smoke/payment-scratchpad.spec.ts smoke/payment-scratchpad-crud.spec.ts

Implemented locally; not pushed or deployed. Deploy API and frontend together (API first) because the new form sends an empty account value and phone storage requires the new schema.
