# Booking bedroom assignment (PPVC-824)

The booking editor previously read rooms only from an already-populated `retreat.houseId.bedrooms` array. A raw house ID or partial house object therefore produced an empty Bedroom picker even though the retreat had a configured house.

The editor now resolves raw/partial house references through the existing authenticated Houses API. Complete populated house records work without an extra fetch. Active named bedrooms are listed, loading/error/retry states are explicit, and missing house/room configuration has a clear explanation. Late house responses cannot overwrite a new retreat selection. Changing the retreat clears the prior bedroom choice. Existing saved rooms that no longer match the house are retained with a warning rather than silently deleted.

Choosing **Not assigned** now sends an explicit empty `roomNumber`, allowing the existing update API to clear an assignment; the old `undefined` value disappeared from the PATCH body. No API/schema or permission change is needed. Availability, occupancy and valid room selection remain enforced by the existing backend.

After deployment:

1. Open Add New Booking, select the booking type, client and retreat.
2. Wait for the retreat's house bedrooms to load, then choose a Bedroom. Rooms are scoped to the selected retreat's house.
3. Save the booking and reopen Edit Booking; the room remains selected.
4. To remove it, select Not assigned and Update Booking.
5. If the house read fails, use Retry bedrooms. If no house or active named rooms are configured, update the retreat/house configuration first.

Validation:

```sh
npm run build
npm test -- --runInBand src/components/useBookingHouse.test.tsx src/components/BookingEditorForm.retreatOptions.test.tsx src/components/BookingEditorForm.retreatDates.test.ts
SMOKE_PORT=43824 npx playwright test -c playwright.smoke.config.ts smoke/booking-bedrooms.spec.ts
```

17 unit tests and7 browser tests pass. The browser tests exercise the actual built booking editor using synthetic stateful API fixtures, assert create/update payloads and saved values after reload, and intercept all external requests. They do not prove real database persistence or make production booking/financial changes. Unit coverage also checks late-response races and wrong-house responses.

Status investigation: Jira history records Next For Work → In Progress on2026-10-15 at20:09:19 America/New_York under the shared Martin Halla account. Before this fix there was no comment/claim, matching local ticket implementation or release-ledger entry explaining that transition. The actor account does not identify which agent/person moved it. The ticket was taken over and completed explicitly; future handoff is Ready to Push.
