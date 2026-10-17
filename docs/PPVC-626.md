# Booster browser regression scenario (PPVC-626)

Run against the local production build:

```sh
npm run build
SMOKE_PORT=43626 npx playwright test -c playwright.smoke.config.ts smoke/booster-booking.spec.ts
```

The three scenarios in `smoke/booster-booking.spec.ts` open the real booking editor through its lazy-loaded admin route. They cover both ceremony choices, calendar dates in America/New_York, the outbound ceremony ID/number and arrival/departure payload, and retained values after reopening and reloading the editor. The negative scenario confirms a missing ceremony record blocks submission without creating a booking.

The browser uses synthetic client/retreat records and a stateful intercepted API. Reload checks exercise the UI against saved fixture state; they do not assert real database persistence. Every external request is fulfilled locally. No real bookings, financial changes, emails or other production messages are created.
