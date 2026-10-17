# Invoice link visit history and notifications (PPVC-783)

After deployment:

1. Open Account and tools → Currency converter → Invoice visits.
2. Set **Invoice visit recipient email** to the intended recipient (confirmed for this ticket: `info@ibogaspirit.cz`). Enable **Email me when an invoice link is visited** and save. Recipient and enable switch live in database configuration, not application constants. Defaults are off with no recipient; deployment does not silently start sending.
3. Open a valid public invoice link. On its admin payment-request view, scroll to **Invoice link visits** and click **Refresh visits**. Service payment requests show the same history.
4. Each row shows first seen time for the window, server-resolved IP, browser/OS inference, language, email-queue status, user agent, request origin and referrer origin. Forwarded IP chains are retained separately and labelled unverified. Full referrer paths/query strings are never stored, so invoice tokens are not copied into telemetry.

A durable MongoDB collection stores visit windows separately from payment requests. Repeated requests for the same invoice, server IP/forwarded chain and user agent in the same fixed 30-minute UTC bucket are deduplicated by a unique index. This suppresses browser retries/fallback endpoint requests, but visits around a bucket boundary can create two rows. Browser/OS and bot detection are best-effort header inference, not proof of identity. HEAD requests are excluded. Recognizable bots, link previews and prefetches are recorded but do not notify.

Tracking covers GET/POST `/public/invoices/:hash`, legacy `/payment-requests/public/invoices/:hash`, `/payment-requests/public/deposit/:hash`, and public service-payment requests. Invalid links and admin detail/history reads do not create visits. Agreement/consent actions and authenticated portal-only payment detail loads are not counted as public invoice-link opens. Existing public origin checks and service rate limits remain in place. Tracking failure does not turn a valid invoice into an error.

Only authenticated admin/medical staff can read history; only admin can change configuration. Results page at25 records with a total count. Public invoice responses never include this history, recipient or deduplication key. Technical IP/UA information is rendered as text, bounded in size, and never used as trusted identity.

Human visit events snapshot the configured recipient before enqueueing. Notifications use the existing CommunicationsService/email queue, respect outbound email controls and skip automatic CC. No client medical information or public invoice token is included in the email. A durable pending/failed event can be reclaimed by a one-minute worker with a two-minute lease, ten-minute retry delay and maximum three attempts. Turning emails off also stops pending dispatch. Queued means accepted by the existing email queue, not confirmed delivery. As with other external queue handoffs, a crash between successful enqueue and recording the result can cause a duplicate email on retry; delivery is not claimed to be exactly once. Exhausted failures remain visible in history. Disabled/bot events are not emailed retroactively.

The app records the server-resolved `req.ip`. It does not globally trust user-controlled forwarded headers. On a reverse-proxied deployment this may be a proxy IP; the separately labelled forwarded chain can provide additional context without claiming verified origin. No location lookup, fingerprinting, cookies or browser-storage tracking is added.

Validation commands:

```sh
# API
npm run build
npm test -- --runInBand src/payments/invoice-visits.service.spec.ts src/payments/payment-requests.controller.spec.ts
# Disposable mongod must already be listening on 127.0.0.1:27053.
node test/invoice-visits.integration.cjs --serve
# Admin, separate terminal
npm run build
npm test -- --runInBand src/components/InvoiceVisits.test.tsx src/components/PaymentRequestEditorPage.test.tsx src/components/ServicePaymentRequestPage.test.tsx
SMOKE_PORT=43783 npx playwright test -c playwright.smoke.config.ts smoke/invoice-visits.spec.ts
```

Integration uses a newly named `ppvc783_test_*` localhost database, real Mongoose models/indexes/service and a fake outbound queue. It tests concurrent unique-window dedupe, bots, disabled settings, recipient selection, retry leases/exhaustion, invalid hashes and pagination. The local Nest fixture exposes the actual controllers with a fixture-only auth guard and the production RolesGuard. Browser E2E simulates public invoice HTTP requests and uses the actual built admin views/settings against that API/database. All other requests are intercepted. No AppModule, .env, production DB, SMTP/Gmail or real email queue is used. Ctrl+C closes the fixture and drops only its own disposable database. Stop the separately started disposable mongod after testing.
