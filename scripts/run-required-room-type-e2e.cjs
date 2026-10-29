const freePort = () => new Promise((resolve,reject)=>{const server=require('node:net').createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawn } = require("node:child_process");
(async () => {
  const api = process.env.REQUIRED_ROOM_API_CHECKOUT,
    ir = process.env.REQUIRED_ROOM_IR_CHECKOUT;
  if (!api || !ir)
    throw Error(
      "Set REQUIRED_ROOM_API_CHECKOUT (built matching API) and REQUIRED_ROOM_IR_CHECKOUT. Missing dependencies/Mongo fail, never skip.",
    );
  const { createFixture } = require(
    path.resolve(api, "test/required-room-type.fixture.cjs"),
  );
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "required-room-type-"));
  let f, adminServer, irServer;
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
    irServer = await createServer({
      root: path.resolve(ir),
      configFile: path.resolve(ir, "vite.config.mts"),
      server: { host: "127.0.0.1", port: await freePort() },
    });
    await irServer.listen();
    const child = spawn(
      process.execPath,
      [
        require.resolve("@playwright/test/cli"),
        "test",
        "e2e/required-room-type.spec.ts",
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
          REQUIRED_ROOM_IR_URL:
            "http://127.0.0.1:" + irServer.httpServer.address().port,
          REQUIRED_ROOM_FIXTURE: path.join(folder, "fixture.json"),
        },
      },
    );
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve(signal ? 1 : code));
    });
    if (code) throw Error("Required-room browser regression failed: " + code);
  } finally {
    if (irServer) await irServer.close();
    if (adminServer) await adminServer.close();
    if (f) await f.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
