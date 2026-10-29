# Required Shared or Private room choice

Screening submissions (admin and IR) require an active accommodation choice classified as Shared or Private. Private bathroom options remain detailed stable keys. Bookings require a known room type before creation, inherited from a selected payment request or known screening preference when available. No Shared default is invented. The admin editor preloads a known screening choice without overwriting an explicit choice.

Existing unspecified records remain readable. Operational partial booking actions remain possible; editing room details requires resolving the unknown choice. No schema/index migration or guessed bulk backfill runs. Booking choice and screening preference remain separate: changing one never silently rewrites the other or changes a physical allocation/price.

Clean-checkout regression:

1. Start disposable loopback MongoDB. Set `TEST_MONGO_URL=mongodb://127.0.0.1:27017` or your local port.
2. Install/build matching API (`npm ci && npm run build`), and install admin/IR dependencies.
3. From admin run `REQUIRED_ROOM_API_CHECKOUT=/absolute/path/to/api REQUIRED_ROOM_IR_CHECKOUT=/absolute/path/to/IR node scripts/run-required-room-type-e2e.cjs`.

The runner starts ephemeral API/admin/IR ports, exercises desktop/mobile screening save/reload, booking create/edit/reload and IR submission, and fails rather than skipping missing services. All records are synthetic. Actual native schemas/indexes, services, JWT/controller permissions and room validation run. Contract eligibility is captured as an already-approved synthetic gate; JWT staff approval remains active. PDF regeneration/delivery, FX and lifecycle delivery are captured boundaries. Native cases are included in API `npm run test:db`.

Deploy API, admin and IR together after required production release gates. No deployment or production data repair is performed by implementation.
