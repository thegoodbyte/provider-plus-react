# Payment filters and booking confirmations

In Payments, combine Booking link = Without a booking and Payment request link = Without a PR to find recorded money that still needs its relationships finished. The filters are independent: a request is not proof of a booking.

Additional filters: with booking/PR, unavailable booking record, payment status, payment method, currency, inclusive UTC payment dates, minimum/maximum amount and unfinished payment updates. Existing text search still applies. Choose currency when comparing amounts; ranges apply in each payment's own currency. Invalid dates/ranges show feedback. Clear all payment filters also clears search. Filters stay in the URL for reloads, links and browser navigation; rapid changes merge instead of restoring cleared selections.

A valid, active same-client booking offers **Booking confirmation**. It opens the booking with the existing **Preview PDF** and **Review email with PDF attachment** tools and a **Return to filtered payments** link. On mobile, find Review email under More. Opening it does not generate a PDF or send email; use the existing tools explicitly after checking booking details and recipient. Missing/foreign/cancelled booking links offer review instead. Without a booking, **Create / link booking** opens the existing payment editor so a real booking is created/linked first.

Payment and booking lists are read fresh. A load failure offers retry and cannot appear as a successful empty list. No payment, request, booking, confirmation history or email is mutated by filtering or navigation. No API/schema/index migration.

Regression: focused filter/component unit tests and `e2e/payment-list-filters.spec.ts`. The browser fixture supplies synthetic GET responses and aborts/counts every non-GET request; desktop/mobile cases must pass with zero writes. Existing confirmation PDF/email unit regressions run in the full admin suite. Database mutation tests do not apply to this read-only change.
