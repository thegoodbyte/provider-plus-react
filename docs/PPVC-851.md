# Related record links (PPVC-851)

Open an existing payment, booking, or payment request and scroll to **Related records** at the bottom. Each link opens the exact related item, rather than its list or a search. Labels show the client number/name, booking number, payment-request number, payment number or retreat code when available.

The section includes the record's direct relationships, linked payment requests, and client/booking/payment references on joint allocations or request line items. Duplicates, missing IDs and self-links are omitted. Allocation IDs are never treated as payment IDs. Populated references and clientDetails/bookingDetails/retreatDetails are supported only when they match the linked ID. Raw references are looked up for display numbers; an unavailable optional lookup leaves a generic direct link rather than an invented number. The current admin/medical/staff/user route prefix is retained, and existing destination authorization still applies. Standalone service requests use their dedicated detail route.

No payment amounts, allocations, booking data or permissions change. Links on an existing payment editor describe the saved record, not unsaved form edits.

Validation:

```sh
npm run build
npm test -- --runInBand src/components/RelatedRecords.test.tsx src/components/PaymentRequestEditorPage.test.tsx src/components/BookingDetailShell.test.tsx
SMOKE_PORT=43851 npx playwright test -c playwright.smoke.config.ts smoke/related-records.spec.ts
```

The browser suite renders the actual built pages and follows payment→client, booking→payment request and payment request→payment links. It uses synthetic, intercepted API responses and never reads or modifies production records. It verifies browser navigation, not database persistence. Unit coverage checks direct destinations, label enrichment, role prefixes, service requests, duplicate references, mismatched metadata, absent IDs, self links and unavailable lookups.
