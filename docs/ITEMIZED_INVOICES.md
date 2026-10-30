# Itemized requests and invoices

Payment Requests offers booking requests and standalone itemized requests. Use Document kind to filter them. A client profile also provides New itemized request / invoice with that client preselected.

## Billing setup and use

1. Open Payment Requests → Service & policy settings. Configure Invoice seller: legal name, billing address, optional email/registration/tax ID, and exact tax wording. Tax wording must be supplied before invoice issuance; no tax status or rates are assumed.
2. Open New standalone service request. Choose an existing client or One-off billing recipient. One-offs require a billing name/email; invoices additionally require an address. Optional company registration/tax details belong to the bill-to snapshot and can differ from the client's profile. No fake client or booking is created.
3. Enter title, currency, due date, catalog/custom items, quantities/unit prices, fixed discounts and terms. Review and issue the payment request. This creates one payment request/private link and sends no email.
4. On the request, check or enter Billing recipient details. Preview invoice PDF downloads a DRAFT without issuing anything. Issue invoice freezes the seller, recipient, items, totals, terms, reference and issuance timestamp. The invoice number is INV-{unique payment request display number}, separate from the payment request reference; retries/concurrent clicks reuse the same snapshot.
5. Download invoice PDF, or copy its private link. Send payment request opens the existing explicit email composer and includes the invoice link after issuance. Revoking/replacing the request's private link also revokes/replaces the PDF link. Anyone given the bearer link can read the bill-to identity/address/contact on that invoice; keep it private.
6. Record payment records actual received money against the same request; issuing/downloading never marks it paid. Partial/full settlement and audited refunds update the payment request while leaving the issued invoice untouched. One-off recipient payments and refunds retain no client/retreat/booking association.

Issued invoices cannot be silently overwritten or cancelled through the request endpoints. Original documents remain retained; use audited financial correction/refund workflows. A credit-note/replacement-invoice editor, VAT calculations, electronic tax filing and jurisdiction-specific tax compliance automation are not introduced. Configured wording is supplied by the business. The invoice shows the issued amount; live paid/outstanding information stays on its payment request.

Legacy standalone requests remain usable; missing bill-to details can be entered at invoice issuance without rewriting the original request snapshot. Existing retreat/deposit/balance and private website pages are unchanged. This adds no collections or indexes and performs no historical backfill; existing display-number uniqueness supplies the invoice identity. Rollback preserves additive snapshots; an older client may not display them and must not be used to issue/cancel their invoices.

## Local regression checks

Build API, then run `TEST_MONGO_URL=mongodb://127.0.0.1:27017 npm run test:db`. In admin run full Jest, build and contract checks. For desktop/mobile real API/Mongo browser tests: `TEST_MONGO_URL=mongodb://127.0.0.1:27017 ITEMIZED_INVOICE_API_CHECKOUT=/absolute/path/to/built/api node scripts/run-itemized-invoice-e2e.cjs`. Missing dependencies fail the runner; it does not skip. Optional ITEMIZED_INVOICE_ARTIFACT_DIR saves screenshots/PDFs. Fixtures are synthetic with actual production schemas, indexes, task-independent billing services and HTTP guards; FX/email boundaries are stubbed. Native tests cover issuance concurrency/retry, later audit failure recovery, legacy absent/null preservation, sibling isolation, duplicate constraints, one-off settlement/refunds and private link/role access. `node test/service-invoice-pdf.fixture.cjs <output-folder>` generates a multilingual multipage PDF for visual inspection.

Deploy API before admin. No production push or automatic sending is authorized by implementation.
