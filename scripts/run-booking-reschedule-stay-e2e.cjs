// Mandatory standalone regression: missing API checkout/MongoDB fails, never skips.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn } = require("node:child_process");
(async () => {
  const api = process.env.RESCHEDULE_API_CHECKOUT;
  if (!api)
    throw Error(
      "Set RESCHEDULE_API_CHECKOUT to the built API checkout with test/booking-reschedule-stay.fixture.cjs",
    );
  const { createFixture } = require(
    path.resolve(api, "test/booking-reschedule-stay.fixture.cjs"),
  );
  const folder = fs.mkdtempSync(
    path.join(os.tmpdir(), "booking-reschedule-stay-"),
  );
  let f, vite;
  try {
    f = await createFixture();
    await f.app.listen(0, "127.0.0.1");
    fs.writeFileSync(
      path.join(folder, "fixture.json"),
      JSON.stringify({
        url: "http://127.0.0.1:" + f.app.getHttpServer().address().port,
        ids: f.ids,
        tokens: f.tokens,
      }),
    );
    const { createServer } = await import("vite");
    vite = await createServer({ server: { host: "127.0.0.1", port: 0 } });
    await vite.listen();
    const url = "http://127.0.0.1:" + vite.httpServer.address().port;
    const child = spawn(
      process.execPath,
      [
        require.resolve("@playwright/test/cli"),
        "test",
        "e2e/booking-reschedule-stay.spec.ts",
        "--project=chromium",
        "--workers=1",
        "--retries=0",
        "--reporter=line",
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          PLAYWRIGHT_SKIP_WEB_SERVER: "1",
          PLAYWRIGHT_BASE_URL: url,
          RESCHEDULE_STAY_FIXTURE: path.join(folder, "fixture.json"),
        },
      },
    );
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve(signal ? 1 : code));
    });
    if (code) throw Error("Reschedule browser regression failed: " + code);
  } finally {
    if (vite) await vite.close();
    if (f) await f.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
