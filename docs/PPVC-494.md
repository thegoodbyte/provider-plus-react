# PPVC-494 — Payment-first booking overview

The ticket has no written description or acceptance criteria. Both attached screenshots (10837, 10838) show a payment-first main area, client/confirmation/date sidebar and three collapsed detail sections. The implementation follows that reference using the current payment controls.

## How to use after deployment

1. Open a booking. The default Overview tab starts with Payments: booking price, received/outstanding USD settlement, payment progress, requests and history.
2. Record a payment opens the existing shared payment editor with this booking/client selected. New request and Create balance request use the existing request workflow; price management, linking existing payments and payment actions remain available. Merely opening the overview does not record money or send anything.
3. The right sidebar shows client/contact, referral, accommodation, confirmation state and dates. Edit opens the linked client editor. Send confirmation / Send again uses the existing confirmation flow. On mobile the sidebar follows the main content.
4. Open Requirements next up, Retreat information or Booking dates using Show (or Enter/Space on the focused summary); Hide collapses it. Requirements links to the full Requirements tab, displays loading/error/retry states and does not claim completion if loading failed. All three sections start collapsed.
5. The Payments tab remains available. It and Overview reuse exactly the same payment manager, calculations and actions. Payment updates refresh the canonical booking and requirements. Booster summaries and booking dates use the actual booster overnight dates, independently of the containing retreat dates.
6. The existing Activity, Medical, Documents and other tabs remain accessible through the booking navigation.

## Validation

- Strict TypeScript and Vite production build passed; existing chunk-size/circular import warnings remain.
- 24 tests passed: overview composition and actions, collapsed sections, requirements error handling, confirmation history, client/referral/accommodation data, booster dates, existing payment-management behavior and financial status selectors.
- Four Playwright journeys passed against the built frontend with synthetic intercepted API responses: desktop/mobile navigation and equal balances between Overview/Payments, read-only viewing, keyboard disclosure opening, payment-editor routing, overpayment credit after reload and booster dates.
- API write calls were monitored in the navigation journeys; none occurred. Browser fixtures do not verify real database persistence or change production records.
- Desktop/mobile screenshots are saved in ppvc-494-validation. Payment history retains the existing local horizontal scrolling when needed; the page itself does not overflow horizontally.

Frontend only; implemented locally, not pushed or deployed.
