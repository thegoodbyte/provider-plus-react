const freePort = () =>
  new Promise((resolve, reject) => {
    const server = require("node:net").createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn } = require("node:child_process");
(async () => {
  const api = process.env.PAID_BOOKING_API_CHECKOUT;
  if (!api)
    throw Error(
      "Set PAID_BOOKING_API_CHECKOUT to the built matching API. Missing dependencies/Mongo fail, never skip.",
    );
  const { createFixture } = require(
    path.resolve(api, "test/paid-request-booking.fixture.cjs"),
  );
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "paid-booking-"));
  let f, adminServer;
  try {
    f = await createFixture();
    await f.app.listen(0, "127.0.0.1");
    fs.writeFileSync(
      path.join(folder, "fixture.json"),
      JSON.stringify({
        url: "http://127.0.0.1:" + f.app.getHttpServer().address().port,
        ids: f.ids,
        tokens: f.tokens,
        invite: f.invite,
      }),
    );
    const { createServer } = await import("vite");
    adminServer = await createServer({
      server: { host: "127.0.0.1", port: await freePort() },
    });
    await adminServer.listen();
    const child = spawn(
      process.execPath,
      [
        require.resolve("@playwright/test/cli"),
        "test",
        "e2e/paid-request-booking.spec.ts",
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
          PLAYWRIGHT_BASE_URL:
            "http://127.0.0.1:" + adminServer.httpServer.address().port,
          PAID_BOOKING_FIXTURE: path.join(folder, "fixture.json"),
        },
      },
    );
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve(signal ? 1 : code));
    });
    if (code) throw Error("Paid-booking browser regression failed: " + code);
  } finally {
    if (adminServer) await adminServer.close();
    if (f) await f.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
