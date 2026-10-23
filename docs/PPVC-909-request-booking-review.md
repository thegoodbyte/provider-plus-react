# PPVC-909 — Review and link payment requests to existing bookings

The “Paid without bookings” filter checks saved request and line-item links. A booking created separately can exist even when that request has no forward link. Booking primary requests, request history and allocated payments can also record the relationship in the opposite direction.

## Staff workflow

1. Open **Payment Requests → Booking link review**, or select **Review booking links** on an unlinked request. The dedicated view includes unpaid and paid retreat requests, so discovery does not depend on knowing request #1392 in advance.
2. Search by request number or client. Inspect the request and the linked **Client bookings** tab.
3. Candidate bookings distinguish existing booking/payment references from **same client and retreat** suggestions. A suggestion never establishes a relationship by itself.
4. Inspect the candidate booking and choose **Link request … to booking …** only after checking the records. Tick the confirmation box, then select **Confirm booking link**.
5. Refresh the request: its booking number is now linked. The request disappears from review once the saved allocation is consistent.

The action preserves the booking’s primary request and adds the request to its history. It attaches only that request’s unallocated or already-identical payments. It does not create bookings, payments or receipts; change request status; reprice amounts; fetch FX rates; or send notifications. Existing frozen booking-currency allocations are required for foreign-currency payments. A staff audit entry records the link. An incomplete request/history/payment link remains in review. A failure-injection test verifies that repeating the same action safely resumes an interrupted link; choosing another booking concurrently cannot overwrite the first forward link.

Cancelled records, another client/retreat, conflicting forward/reverse/payment references, currency mismatches and incompatible joint allocations require manual review. Fully allocated joint requests are not misrepresented as needing a single primary booking. Partially allocated joint requests need individual review. Standalone services and events are excluded.

## Verification and deployment

Pure classification/guard tests, real Mongo/Nest/JWT integration, full API/frontend unit suites, builds, API contract regeneration/checks and desktop/mobile Chromium workflow tests use disposable synthetic records. Real integration verifies read-only discovery, permissions, explicit confirmation, unchanged monetary fields, unchanged record counts, audited/idempotent linking and competing booking choices.

No production records (including the real request #1392) were modified during implementation. Staff can review and link that request using this workflow after deployment. This ticket does not claim that the person’s existing booking is the correct one without reviewing its client, retreat and payment records.
