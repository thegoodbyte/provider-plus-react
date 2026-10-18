# PPVC-570 — offer spare ceremony places as boosters

PPVC-572 already provides Booster Offers in RE and the public `/clients/booster/schedule` page. PPVC-626 already covers ceremony-specific reservation creation/reload. PPVC-730 room-occupancy visualization is separate work and is not duplicated here.

This follow-up closes gaps found in that implementation:

- Remaining places are `max(0, min(offer capacity − active boosters for this ceremony, retreat capacity − active regular bookings − active boosters for this ceremony))`. Regular bookings reduce every ceremony. A booster reduces its own ceremony, with legacy ceremony-number matching when its ceremony ID is missing. Both cancellation spellings release capacity. Unpublished, sold-out, cancelled-retreat and missing-retreat offers are excluded from public availability.
- Price and currency can be saved together on each offer. Failed updates display an error and do not falsely publish an offer.
- Partial updates use runtime DTO validation and Mongoose validators. Both creation and updates check chronological windows and matching retreat/ceremony identity.
- Date/time inputs explicitly use Europe/Prague. Naive form inputs are converted to actual instants by the API; timestamps with an explicit offset retain their instant. Existing stored instants are preserved and displayed in Prague time; no historical migration guesses old intentions.

## Staff workflow after deployment

1. Open Retreat Operations → Booster Offers.
2. Search/select a retreat. Choose the ceremony whose spare places you want to offer. The existing form suggests available capacity and arrival/departure windows; new offers start unpublished.
3. Set the arrival/departure windows in Prague time and the maximum booster places you want to sell.
4. Enter price and currency, then choose **Save price**. Other fields save as edited. Check any error before continuing.
5. Check **Published** to list remaining places on the public booster schedule; uncheck it to hide the offer.
6. To reserve an agreed place, use Bookings → Add Booking, select the client and retreat, choose Booster and the matching ceremony, and confirm the arrival/departure window and agreed price before saving. Existing booking validation and medical/readiness workflows continue to apply.
7. Reload Booster Offers to see current remaining places. Regular or ceremony-specific booster bookings reduce availability automatically at the next API read; cancelled bookings reopen it. The public page fetches this API when opened/reloaded. This is an inquiry-led schedule, not a payment or atomic booking hold.

## Verification

Focused API/frontend tests, both production builds, real-Mongo service checks, and Playwright checks cover this follow-up. Browser pricing/publishing tests use actual business services and schemas with disposable MongoDB and synthetic staff authentication; existing PPVC-626 booking tests use a stateful synthetic API fixture. No production records or messages are created. Full deployed authentication and external contact/invitation services are outside these checks.

Validation artifacts live in workspace `ppvc-570-validation`. Implementation is committed locally for Push Review, not deployed.
