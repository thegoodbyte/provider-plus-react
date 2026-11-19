const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { spawn, spawnSync } = require("node:child_process"),
  { once } = require("node:events"),
  path = require("node:path");
const { running, stopChildren } = require("./coverage-process.cjs");
async function child(code) {
  const p = spawn(process.execPath, ["-e", code], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  await once(p, "message");
  return p;
}
test("already-signalled children do not swallow an original failed-gate exception", async () => {
  const p = await child("process.send('ready');setInterval(()=>{},1000)");
  const exited = once(p, "exit");
  p.kill("SIGTERM");
  await exited;
  assert.equal(p.exitCode, null);
  assert.equal(p.signalCode, "SIGTERM");
  assert.equal(running(p), false);
  await assert.rejects(async () => {
    try {
      throw Error("original gate failed");
    } finally {
      const result = await stopChildren([p], 500);
      assert.equal(result[0].alreadyExited, true);
      assert.equal(result[0].forced, false);
    }
  }, /original gate failed/);
});
test("cooperative fixtures are awaited and stop without a forced kill", async () => {
  const p = await child(
    "process.on('SIGTERM',()=>process.exit(0));process.send('ready');setInterval(()=>{},1000)",
  );
  const result = await stopChildren([p], 500);
  assert.equal(result[0].forced, false);
  assert.equal(p.exitCode, 0);
  assert.equal(running(p), false);
});
test("an unresponsive fixture is explicitly marked as forced cleanup", async () => {
  const p = await child(
    "process.on('SIGTERM',()=>{});process.send('ready');setInterval(()=>{},1000)",
  );
  const exited = once(p, "exit");
  const result = await stopChildren([p], 100);
  await exited;
  assert.equal(result[0].forced, true);
  assert.equal(p.signalCode, "SIGKILL");
});
test("missing required coverage configuration fails closed before starting fixtures", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "run-coverage-resolution.cjs")],
    { env: { PATH: process.env.PATH }, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TEST_API_CHECKOUT required/);
});
