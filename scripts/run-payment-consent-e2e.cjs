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
  const api = process.env.PAYMENT_CONSENT_API_CHECKOUT,
    cz = process.env.PAYMENT_CONSENT_CZ_CHECKOUT,
    pl = process.env.PAYMENT_CONSENT_PL_CHECKOUT;
  if (!api || !cz || !pl)
    throw Error(
      "Set PAYMENT_CONSENT_API_CHECKOUT (built API), PAYMENT_CONSENT_CZ_CHECKOUT and PAYMENT_CONSENT_PL_CHECKOUT (website react-app folders). Missing dependencies/Mongo fail, never skip.",
    );
  const { createFixture } = require(
    path.resolve(api, "test/payment-consent-policy.fixture.cjs"),
  );
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "payment-consent-"));
  let f, adminServer, czServer, plServer;
  const oldPreview = process.env.REACT_APP_CLIENT_INVOICE_PREVIEW_URL;
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
    czServer = await createServer({
      root: path.resolve(cz),
      configFile: path.resolve(cz, "vite.config.js"),
      server: { host: "127.0.0.1", port: await freePort() },
    });
    await czServer.listen();
    plServer = await createServer({
      root: path.resolve(pl),
      configFile: path.resolve(pl, "vite.config.js"),
      server: { host: "127.0.0.1", port: await freePort() },
    });
    await plServer.listen();
    process.env.REACT_APP_CLIENT_INVOICE_PREVIEW_URL =
      "http://127.0.0.1:" +
      plServer.httpServer.address().port +
      "/clients/payment/admin-preview";
    adminServer = await createServer({
      server: { host: "127.0.0.1", port: await freePort() },
    });
    await adminServer.listen();
    const child = spawn(
      process.execPath,
      [
        require.resolve("@playwright/test/cli"),
        "test",
        "e2e/payment-consent-policy.spec.ts",
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
          PAYMENT_CONSENT_CZ_URL:
            "http://127.0.0.1:" + czServer.httpServer.address().port,
          PAYMENT_CONSENT_PL_URL:
            "http://127.0.0.1:" + plServer.httpServer.address().port,
          PAYMENT_CONSENT_FIXTURE: path.join(folder, "fixture.json"),
        },
      },
    );
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve(signal ? 1 : code));
    });
    if (code) throw Error("Payment-consent browser regression failed: " + code);
  } finally {
    if (czServer) await czServer.close();
    if (plServer) await plServer.close();
    if (oldPreview === undefined)
      delete process.env.REACT_APP_CLIENT_INVOICE_PREVIEW_URL;
    else process.env.REACT_APP_CLIENT_INVOICE_PREVIEW_URL = oldPreview;
    if (adminServer) await adminServer.close();
    if (f) await f.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
