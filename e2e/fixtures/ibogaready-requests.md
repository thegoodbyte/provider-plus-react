# IbogaReady request lifecycle regression

Run `npm run test:db` from the matching API checkout with `TEST_MONGO_URL` pointing to a disposable loopback MongoDB. Its native client-support-lifecycle cases are automatic, use production schemas/indexes and test identity/privacy/revision/notification invariants.

For browser regression, build the matching API, admin and IR checkouts first. Never rebuild API dist while its fixture is running. Start a disposable MongoDB, then from the API checkout run:

```sh
TEST_MONGO_URL="$TEST_MONGO_URL" TEST_FIXTURE_OUTPUT="$CLIENT_SUPPORT_FIXTURE" node test/client-support.fixture.cjs
```

`CLIENT_SUPPORT_FIXTURE` must be an absolute output filename. This existing synthetic fixture starts real guarded support controllers/services, seeds its own random database and captures email at the transport boundary. It drops its database on normal SIGINT/SIGTERM. No production credentials or data needed.

Start local admin/IR previews on available ports. From admin, set `PLAYWRIGHT_BASE_URL` to the admin URL, `CLIENT_SUPPORT_IR_URL` to the IR URL and `CLIENT_SUPPORT_FIXTURE` to the file above. Then run:

```sh
PLAYWRIGHT_SKIP_WEB_SERVER=1 npx playwright test e2e/ibogaready-request-lifecycle.spec.ts e2e/staff-focus-chooser.spec.ts --project=chromium --workers=1 --retries=0
```

Optional `CLIENT_SUPPORT_ARTIFACT_DIR` chooses screenshot destination. The native journey covers create/edit/lost-response retry/reload, sibling isolation, staff progress email, internal-note privacy, resolution email and confirmed removal. Focus tests use read-only synthetic queue reads and verify navigation/preferences, not payment or medical decisions. All four dedicated cases must execute: a missing fixture skips native cases and is not a passing gate. Provider inbox delivery and WhatsApp sending are not exercised.

For concurrent broad runs alongside `client-support.spec.ts`, start a second support fixture with a different output/port and set `IBOGAREADY_REQUEST_FIXTURE` for the lifecycle file. Keep `CLIENT_SUPPORT_FIXTURE` for the legacy support file. Both use production services/indexes but must not reset the same database concurrently. Standalone sequential runs may use the fallback `CLIENT_SUPPORT_FIXTURE`.
