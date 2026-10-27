# Partial received-payment regression

Build the paired API checkout. Start a disposable standalone MongoDB on loopback (production indexes remain enabled). `TEST_MONGO_URL` must contain only a loopback server URL, without a database name or credentials; fixture databases have random names and are dropped on exit.

In the API checkout:

```
TEST_MONGO_URL=mongodb://127.0.0.1:27017 node --test test/database/partial-receipt-allocation.test.cjs
TEST_MONGO_URL=mongodb://127.0.0.1:27017 TEST_FIXTURE_OUTPUT=/tmp/partial-receipt-fixture.json node test/partial-receipt.fixture.cjs
```

Keep the fixture alive for browser checks, then stop it with SIGTERM. It runs real Nest/JWT/controllers/services/Mongo schemas and indexes; FX quotes are synthetic and external delivery/PDF generation is disabled. No production data is used.

In the admin checkout, build, then run:

```
npm run build
PARTIAL_RECEIPT_FIXTURE=/tmp/partial-receipt-fixture.json npm run test:smoke -- partial-receipt-allocation.spec.ts
```

The tests check 7,600 PLN received, 3,800 allocated to booking A with a visible 3,800 unused reserve, then allocation of that reserve to booking B. They reload and inspect payment/receipt views at desktop/mobile widths, verify persisted booking balances and receipt identity, reject over-allocation, and ensure only two allocation mutations occur.
