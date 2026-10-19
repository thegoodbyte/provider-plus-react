# PPVC-893 — bounded referral report reads (PPVC-800)

The admin report now reads booking history in indexed cursor pages, rather than loading all bookings, clients and retreats in one query. The admin waits for every page before presenting balances. There is no date cutoff and older unpaid bookings remain included. A failed later page rejects the whole result; incomplete balances are never presented as final.

## Contract and financial behavior

- New admin-only endpoint: `GET /referrals/report/pages?cursor=…&asOf=…&limit=…`. JWT and existing admin role guard apply. Returns `{rows,nextCursor,asOf}`. Default 200 bookings per page; valid page size 1–500; at most one lookahead booking is fetched.
- Cursors advance over booking `_id`, including pages that contain no credited referrals. The admin fetches until `nextCursor:null`; an empty attributed page is not the end of history. Invalid/cyclic pages or changed boundaries reject the full client read.
- Related client, retreat, referral, paid-expense and payment reads use only page booking/client IDs. Historical first-booking aggregation returns one record per relevant client, preserving registration-date/created-date fallback and booking-number ordering. Mixed legacy string/ObjectId client references are grouped as one identity. Cancelled bookings remain excluded.
- Paid commission snapshots, disabled future repeat credit, explicit partner attribution, first completed payment dates and payout currencies retain existing rules. A 10,000-booking fixture compares the complete new result with the pinned previous implementation, including partner-scoped results.
- Payout quotes request only the explicitly selected booking IDs (up to the existing DTO limit of 500); first-ever booking attribution still uses historical context, so selecting a later inherited booking cannot grant it credit.
- The old `/referrals/report` array contract and partner portal use a complete-result compatibility reader over the same bounded pages. They still accumulate their full output, and the admin ultimately stores all report rows for its existing filters/totals. This bounds database/API page work, not total history traversal or all consumer memory. It is not a claim that generating every historical row is constant-time.
- `asOf` is a fixed upper ObjectId boundary generated at read start (next second). It prevents following indefinitely later inserts; it is **not a transactional snapshot**. Updates/deletes or backdated/custom IDs during loading may affect results; refresh after edits/payouts as before.

## Indexes and measured evidence

Added booking indexes: `{clientId:1,status:1}`, `{status:1}`, `{referralPartnerId:1,clientId:1}`. Added payment indexes: `{bookingId:1,status:1,paymentDate:1}` and `{bookingHash:1,status:1,paymentDate:1}`. Existing payout booking/status index is reused; no duplicate expense index is added.

Standalone Mongo executionStats on the synthetic 10,000-booking fixture:

| Query | Keys examined | Documents examined | Returned |
| --- | ---: | ---: | ---: |
| Mid-history page (200 + lookahead) | 201 | 201 | 201 |
| One client's historical bookings | 3 | 2 | 2 |
| Selective pending status | 1 | 1 | 1 |
| Explicit referral partner | 10 | 10 | 10 |
| Booking's completed payment | 1 | 1 | 1 |

Every measured winning plan uses IXSCAN and no COLLSCAN. The main page uses the existing `_id` index; the added indexes serve selective history/status/partner/payment lookups. A low-selectivity status filter is not guaranteed to use an index: the Mongo planner decides from actual data. Historical aggregation can still examine all bookings for the selected clients; it does not assume a truncated first booking. Synthetic execution plans and unchanged output are evidence of the scoped reads, not measured production wall-clock speedups.

## Staff use after deployment

1. Open Referrals → Partners or Commissions and clients. The existing screen waits until the complete report has loaded.
2. Use the existing partner/retreat/package filters and record payouts as before. Old unpaid balances remain available without changing a date range.
3. If a page fails, the summary displays Unavailable rather than a partial balance. Use Retry summary after recovery; it restarts the complete read.
4. The partner portal retains its full history/allowlisted response. No partner account or access policy changes.

## Rollout / rollback

Deploy API support before the admin consumer. The new consumer needs `/report/pages`; the legacy array endpoint remains compatible. Existing Mongoose schema-index initialization creates the additive indexes when enabled. If production disables automatic index creation, verify/create these exact additive definitions as part of the authorized release using normal database operations. Do not call `syncIndexes`, drop unrelated indexes or assume source definitions prove production indexes exist. No production index build has been performed here.

Rollback the admin consumer first; the old endpoint remains present. API rollback requires checking that deployed consumers no longer depend on the page endpoint. Added non-unique indexes can remain during rollback; no record deletion/backfill is required.

## Validation / reproduction

API: 250 suites / 2,657 tests and snapshot; build. Admin: 269 suites / 1,615 tests; build. The focused financial fixtures retain their in-memory histories for fee rules; the new integration test exercises actual Mongo pagination, mixed IDs, attribution, paid rows, first payment and explain plans. Two browser checks use the built admin with the real guarded fixture for complete totals across 50 pages and an explicit later-page failure on mobile.

After building the API, start an isolated Mongo on loopback **27093** and run:

```sh
PPVC893_RESULT=/tmp/ppvc893-result.json node test/referral-report-pages.integration.cjs
```

The script uses and drops only `ppvc893_test_*`. Optional `REFERRAL_BASELINE_SERVICE` points to a compiled previous `ReferralsService` module for exact result comparison. Use `--serve` and `PPVC893_FIXTURE=/tmp/ppvc893-fixture.json` to retain the guarded synthetic API on **4893**; SIGTERM closes it and drops the test database. With the built admin preview on **4894**:

```sh
SMOKE_BASE_URL=http://127.0.0.1:4894 PPVC893_FIXTURE=/tmp/ppvc893-fixture.json \
  node node_modules/@playwright/test/cli.js test -c playwright.smoke.config.ts smoke/referral-report-pages.spec.ts
```

Detailed local evidence: workspace `ppvc-893-validation/validation.json`, `integration-result.json` and query plans. Browser unrelated APIs are stubbed, FX is deterministic, and no real payout or outbound message is sent. No production data, index builds, query plans, topology or live performance was inspected. Normal release/live checks still apply. PPVC-895 provides future latency observations; PPVC-894 owns initial bundle reduction.
