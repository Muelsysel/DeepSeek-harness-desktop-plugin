/** Shared test doubles for the desktop seam suites. */

/** A minimal stand-in for node:child_process ChildProcess. */
export function makeChild(pid = 4242) {
  const handlers = new Map();
  const child = {
    pid,
    exitCode: null,
    killed: false,
    once(event, fn) {
      const list = handlers.get(event) ?? [];
      list.push(fn);
      handlers.set(event, list);
    },
    emit(event, ...args) {
      for (const fn of handlers.get(event) ?? []) fn(...args);
    },
    kill() {
      if (this.killed) return;
      this.killed = true;
      this.exitCode = 0;
      this.emit("exit", 0);
    },
  };
  return child;
}

/** Fake spawn that records calls and returns fresh children. */
export function makeSpawnRecorder(startPid = 4000) {
  const calls = [];
  return {
    calls,
    fn: (command, args, options) => {
      const child = makeChild(startPid + calls.length);
      calls.push({ command, args, options, child });
      return child;
    },
  };
}
