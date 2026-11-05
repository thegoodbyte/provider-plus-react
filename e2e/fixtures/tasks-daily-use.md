# Daily Tasks regression

Use the existing disposable API/Mongo fixture described in [ibogaready-requests.md](ibogaready-requests.md).
Build the candidate API before starting its fixture. Build and serve the staff app and IR on available local ports.
Set `CLIENT_SUPPORT_FIXTURE` to its output file, `CLIENT_SUPPORT_IR_URL` to the local portal URL and `PLAYWRIGHT_BASE_URL` to the local staff app URL.

```sh
PLAYWRIGHT_SKIP_WEB_SERVER=1 npx playwright test e2e/tasks-daily-use.spec.ts e2e/ibogaready-request-lifecycle.spec.ts --project=chromium --workers=1 --retries=0
```

All four cases must execute. Missing fixture skips are not success. The shared fixture is reset per case; run with one worker. `CLIENT_SUPPORT_ARTIFACT_DIR` optionally selects the screenshot folder.

Daily-use cases at desktop/phone widths cover required client selection before creation, real saved ownership, sibling isolation, generic creation, editing, status save/reload, rejected-save recovery, durable sprint creation/assignment and no page-wide overflow. The mobile board must not live inside a collapsed nested scrollbar; Edit is tested for pointer reachability. Support cases cover client editing/retry/removal, staff replies, private-note isolation and captured resolution emails. Browser routes retain actual Tasks/support controllers/services and Mongo production schemas/indexes; unrelated shell/client-picker reads use synthetic data matching fixture identities. One PATCH is deliberately rejected before reaching the API to test recovery. No production writes, provider delivery or WhatsApp sending.

API persistence checks with the same disposable Mongo server:

```sh
node --test test/database/task-identity.test.cjs test/database/client-support.test.cjs test/database/client-support-lifecycle.test.cjs
```

Set `TEST_MONGO_URL` and run these from the API checkout after building it.
