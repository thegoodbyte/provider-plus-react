# PPVC-890 — one booking-scoped entry EKG decision

The API owns the entry EKG decision. Staff booking requirements, staff client medical details, the retreat workflow summary/detail, and the IR roadmap/upload screen consume that decision. There is no persisted second status system. Liver panels and other requirements keep their existing behavior.

## How to use it

1. Open a booking in RE and choose **Requirements**. The EKG row shows its current server state, deadline, and links for the current evidence/review. Refresh after an upload or review.
2. Open the client's **Medical** tab to see the EKG status separately for each active booking. Stored file history is evidence history; it does not independently indicate approval.
3. Open the retreat workflow medical summary/detail. The EKG state is the same booking decision. IR shows the corresponding localized badge in the roadmap and current EKG upload section.
4. Upload using the existing EKG upload flow. **Uploaded** means a file was received; it does not mean medically accepted. Submit it for review using the existing review flow. The state becomes **Awaiting review**.
5. If a reviewer requests a correction, replace the evidence through the existing upload flow. The old approval/review cannot approve the replacement. The new evidence returns to uploaded/awaiting review until its own review is completed.
6. Explicit waivers and not-applicable requirements remain distinct. A source failure shows **Status unavailable**; the booking tab shows an unknown badge rather than counting it as missing or complete. Retry/refresh after the source recovers.

## Read contract and access

- Staff: `GET /booking-flow/bookings/:bookingId/requirement-projection/ekg` (JWT; admin, medical staff, assigned medical advisor).
- IR: `GET /client-portal/requirements/:bookingId/ekg` (client JWT, booking ownership, existing contract gate).
- Version 1 includes booking/key, applicability/required, state/label, due date, current evidence ID/version, current review result and next-action hint. The hint does not authorize a write; existing upload/review endpoints and permissions remain authoritative.
- States: missing, uploaded, awaiting_review, accepted, caution, correction_needed, declined, expired, waived, not_applicable, unavailable.
- No file URLs, review notes, medical values or client names are returned. Client responses omit internal comparisons. Restricted review-group tokens cannot use this broad booking read; assigned advisors cannot inspect unassigned current evidence.
- The retreat summary batches projection inputs across bookings. GETs only query; they do not materialize requirements, repair links, send messages or mutate records.
- Replacement chains and current original-file upload times constrain review matching. A bound manual decision remains valid only for its linked evidence and review time; replacements also require the exact recorded evidence version. Existing deadlines and validity windows are read unchanged.
- Contract copies in API, RE and IR must remain byte-identical until PPVC-776 generates them.

## Comparison, rollout and bounded rollback

Deploy API support before either consumer. Keep all three changes together in the release inventory. No production deployment has been performed for this ticket.

`EKG_PROJECTION_MODE=compare` returns the mapped legacy decision to consumers and adds a staff-only comparison with the canonical decision. Inspect the same booking endpoint/retreat summary using approved staff access before switching to `canonical` (the default). Comparison performs no writes. Compare explicit waivers/not-applicable and replacements as well as ordinary missing/accepted cases; do not treat a legacy approval on old evidence as validation of the canonical rule.

`EKG_PROJECTION_MODE=legacy` retains the same v1 endpoint/consumer contract while selecting the legacy adapter. It is an explicit temporary EKG-only rollback, not automatic fallback on a failed source. Remove the override after resolving discrepancies. No row deletion/backfill or other requirement migration is needed. Reverting consumer commits requires coordinating all three repositories; never remove the API endpoint while deployed consumers still call it.

## Validation and limits

Full repository unit suites and production builds pass in API, staff and IR. The isolated synthetic Mongo/Nest/JWT fixture exercises actual projection, workflow-summary and artifact-replacement services, authentication/roles/ownership/contract denial, all lifecycle transitions and unchanged record counts across repeated reads. Browser checks use the built staff and portal applications against that local fixture at desktop/mobile sizes, with unrelated APIs stubbed. They do not send real uploads, emails or notifications or verify production/S3. The independent full production release gates and live deployment checks still apply before release. General IR retry UX is PPVC-892.
