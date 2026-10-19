# Medical work sessions

1. Sign in as an administrator. Open Work modes from the Focused work sidebar section or account menu.
2. Enter Medical processing for focused navigation. Payment and retreat modes are unavailable in this delivery.
3. Check A/B/C queue counts. Start the first five actionable entries, select a small batch with checkboxes, or start all actionable work (maximum 5000 entries).
4. Work on the current item. Open its source editor to make actual medical changes. The Medical work mode banner returns to the saved session, and the source URL includes return context.
5. Refresh after saving domain changes. Work resolved elsewhere is counted separately from your reviewed outcomes.
6. If an explicit operational review is appropriate, choose its reason and enter a short operational note without medical details. This records an audited review; it does not perform clinical approval or send a packet.
7. Skip or block unresolved work with a reason and next action. These remain separate from reviewed work; Retry item explicitly reopens eligible skipped/blocked entries.
8. New arrivals remain outside the original batch. Select them and choose Add selected arrivals when ready.
9. At an empty step, continue to the next step, take a break, or finish. Steps never switch automatically. Waiting for an advisor reply does not count as an actionable response.
10. Refresh, sign in again, or return on another device with the same account to resume the saved mode/session. Recent sessions are listed in Work modes. Notes that have not been saved remain only in the current page; save errors preserve them and the position. A conflict requires Refresh current records before retrying.
11. Finish explicitly confirms any unresolved work and makes the session read-only. Exit work mode restores ordinary navigation without deleting progress.

The foundation links existing editors. The complete medical action flow is tracked separately in PPVC-836; payments, retreat review, timers and delegation remain in PPVC-837–840. API must ship before admin. This implementation has not been deployed.

For isolated persisted-data browser checks, start the API's `test/work-modes.fixture.cjs` with disposable loopback Mongo on 27085. Build/preview admin at 127.0.0.1:4854 and run `npx playwright test --config=playwright.work-modes.config.ts`. The dedicated config sets WORK_MODES_FIXTURE to the local fixture metadata; the ordinary browser suite skips this fixture-only spec without that variable. Work-mode operations and artifact reads use the real fixture; unrelated page-shell lookups are stubbed.
