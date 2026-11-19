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
module.exports = { running, stopChildren };
