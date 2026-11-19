// Child exitCode is null after a signal exit; signalCode must also be checked.
const running = (child) => child.exitCode === null && child.signalCode === null;
async function stopChildren(children, timeoutMs = 10000) {
  return Promise.all(
    children.map((child) => {
      if (!running(child))
        return Promise.resolve({
          pid: child.pid,
          alreadyExited: true,
          forced: false,
        });
      return new Promise((resolve) => {
        let done = false,
          forced = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve({ pid: child.pid, alreadyExited: false, forced });
        };
        const timer = setTimeout(() => {
          forced = true;
          child.kill("SIGKILL");
          finish();
        }, timeoutMs);
        child.once("exit", finish);
        child.once("error", finish);
        child.kill("SIGTERM");
      });
    }),
  );
}
async function probeFixtureListener(data) {
  const url = new URL(data.url);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password)
    throw Error('Fixture readiness requires a credential-free loopback HTTP URL');
  const port = Number(url.port || 80);
  await new Promise((resolve, reject) => {
    const socket = require('node:net').connect(port, '127.0.0.1', () => {
      socket.end(); resolve();
    });
    socket.setTimeout(2000, () => socket.destroy(Error('Fixture listener timeout')));
    socket.once('error', reject);
  });
  return port;
}
module.exports = { running, stopChildren, probeFixtureListener };
