MRR view/edit download acceptance fixture

Requires a built API checkout with dependencies and a disposable loopback MongoDB. Existing API Nest/JWT/download code and production schemas are retained; only storage transport is captured. The fixture exposes synthetic snapshot/download paths on loopback and drops its random database on SIGTERM/SIGINT.

Run from the admin checkout:

```sh
TEST_MONGO_URL=mongodb://127.0.0.1:27017 DOWNLOAD_FIXTURE_SOURCE=/path/to/api TEST_FIXTURE_OUTPUT=/tmp/mrr-download-fixture.json node e2e/fixtures/mrr-view-download.cjs
```

Then run the permanent browser scenarios against a local admin build:

```sh
MRR_VIEW_DOWNLOAD_FIXTURE=/tmp/mrr-download-fixture.json PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_SKIP_WEB_SERVER=1 npx playwright test e2e/mrr-view-whatsapp-download.spec.ts --project=chromium --workers=1
```

An ephemeral fixture port is chosen unless TEST_FIXTURE_PORT is set. No production records, storage or messages are used.
