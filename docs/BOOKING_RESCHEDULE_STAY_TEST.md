# Booking retreat moves and stay dates

Full-stay rescheduling replaces check-in/out with destination retreat calendar dates and wall times in Europe/Prague. Missing times default to midnight; invalid/reversed or ambiguous DST times fail before any writes. Boosters move to the unique corresponding ceremony number and keep the existing one-night arrival/day-of-ceremony checkout policy; absent/ambiguous ceremonies reject the move. Existing room, capacity and earlier-retreat restrictions apply.

After opening a booking, choose More → Reschedule booking, destination and reason/note. Arrival/departure times are shown before confirmation. Email remains off by default. Reload to verify dates and open destination Clients → Stay planner.

For older moved full-stay bookings, admins can explicitly select **Align stay dates to current retreat**. It replaces custom full-stay dates too, so review before using. It repeats lifecycle/document/payment-plan synchronization but creates no new reschedule history and sends no email. Rooms must be unassigned first. No automatic bulk repair runs, and no production data has been repaired by this implementation.

Run the mandatory real API/Mongo browser regression from a clean checkout:

1. Start disposable loopback MongoDB and set `TEST_MONGO_URL=mongodb://127.0.0.1:27017` (or your local port).
2. In the matching API checkout: `npm ci && npm run build`.
3. In admin: `npm ci`, then `RESCHEDULE_API_CHECKOUT=/absolute/path/to/api node scripts/run-booking-reschedule-stay-e2e.cjs`.

The runner uses ephemeral API/Vite ports and disposable synthetic databases, fails on missing dependencies and runs both desktop/mobile timezone scenarios without skips. External email/FX/PDF transport and lifecycle delivery callbacks are captured; actual booking persistence, schemas/indexes, JWT/controller permissions, distributed room lock and payment-plan synchronization run locally. API regression: `npm run test:db` includes sibling records, retry/concurrency, partial failure recovery, booster mapping, denied writes and historical correction.
