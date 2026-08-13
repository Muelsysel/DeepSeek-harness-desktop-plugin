import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WindowManager,
  buildWindowArgs,
  resolveElectronBinary,
  webUrl,
} from "../lib/desktop.js";

/** A minimal stand-in for node:child_process ChildProcess. */
function makeChild(pid = 4242) {
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

function makeSpawnRecorder() {
  const calls = [];
  return {
    calls,
    fn: (command, args, options) => {
      const child = makeChild(4000 + calls.length);
      calls.push({ command, args, options, child });
      return child;
    },
  };
}

const MAIN_PATH = "C:/plugin/desktop/main.cjs";
const ELECTRON = "C:/plugin/node_modules/electron/dist/electron.exe";

const BASE_OPTIONS = {
  title: "DeepSeek Harness",
  width: 1280,
  height: 800,
  theme: "codex",
  electronArgs: [],
};

test("webUrl builds the loopback URL for a port", () => {
  assert.equal(webUrl(3080), "http://127.0.0.1:3080");
  assert.equal(webUrl(0), "http://127.0.0.1:0");
  assert.equal(webUrl(4321, "127.0.0.1"), "http://127.0.0.1:4321");
});

test("buildWindowArgs orders electronArgs before the window hints", () => {
  const args = buildWindowArgs("http://127.0.0.1:3080", {
    ...BASE_OPTIONS,
    electronArgs: ["--no-sandbox", "--disable-gpu"],
  });
  assert.deepEqual(args, [
    "--no-sandbox",
    "--disable-gpu",
    "--url=http://127.0.0.1:3080",
    "--title=DeepSeek Harness",
    "--theme=codex",
    "--size=1280x800",
  ]);
});

test("buildWindowArgs carries the default theme and custom size", () => {
  const args = buildWindowArgs("http://127.0.0.1:9", {
    ...BASE_OPTIONS,
    theme: "default",
    width: 1024,
    height: 768,
  });
  assert.ok(args.includes("--theme=default"));
  assert.ok(args.includes("--size=1024x768"));
});

test("resolveElectronBinary prefers DSH_DESKTOP_ELECTRON over require()", () => {
  const env = { DSH_DESKTOP_ELECTRON: "C:/custom/electron.exe" };
  let required = false;
  const path = resolveElectronBinary(() => {
    required = true;
    return ELECTRON;
  }, env);
  assert.equal(path, "C:/custom/electron.exe");
  assert.equal(required, false);
});

test("resolveElectronBinary falls back to require('electron')", () => {
  const path = resolveElectronBinary(
    (id) => {
      assert.equal(id, "electron");
      return ELECTRON;
    },
    {},
  );
  assert.equal(path, ELECTRON);
});

test("resolveElectronBinary returns undefined when require throws or returns junk", () => {
  assert.equal(
    resolveElectronBinary(() => {
      throw new Error("module not found");
    }, {}),
    undefined,
  );
  assert.equal(resolveElectronBinary(() => 42, {}), undefined);
  assert.equal(resolveElectronBinary(() => "", {}), undefined);
});

test("open spawns electron with the main script and window args", () => {
  const recorder = makeSpawnRecorder();
  const manager = new WindowManager({
    spawn: recorder.fn,
    electronPath: ELECTRON,
    mainPath: MAIN_PATH,
  });

  const result = manager.open("http://127.0.0.1:3080", BASE_OPTIONS);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.pid, 4000);

  assert.equal(recorder.calls.length, 1);
  const call = recorder.calls[0];
  assert.equal(call.command, ELECTRON);
  assert.equal(call.args[0], MAIN_PATH);
  assert.ok(call.args.includes("--url=http://127.0.0.1:3080"));
  assert.equal(call.options.stdio, "ignore");
  assert.equal(call.options.env, process.env);

  assert.equal(manager.isOpen(), true);
});

test("open reuses the live window instead of spawning a second one", () => {
  const recorder = makeSpawnRecorder();
  const manager = new WindowManager({
    spawn: recorder.fn,
    electronPath: ELECTRON,
    mainPath: MAIN_PATH,
  });

  const first = manager.open("http://127.0.0.1:3080", BASE_OPTIONS);
  const second = manager.open("http://127.0.0.1:3080", BASE_OPTIONS);

  assert.equal(first.ok && first.pid, second.ok && second.pid);
  assert.equal(recorder.calls.length, 1);
});

test("open spawns again after the child exits", () => {
  const recorder = makeSpawnRecorder();
  const manager = new WindowManager({
    spawn: recorder.fn,
    electronPath: ELECTRON,
    mainPath: MAIN_PATH,
  });

  manager.open("http://127.0.0.1:3080", BASE_OPTIONS);
  recorder.calls[0].child.emit("exit", 0);
  assert.equal(manager.isOpen(), false);

  manager.open("http://127.0.0.1:3080", BASE_OPTIONS);
  assert.equal(recorder.calls.length, 2);
});

test("open fails with a clear reason when Electron is unavailable", () => {
  const recorder = makeSpawnRecorder();
  const manager = new WindowManager({
    spawn: recorder.fn,
    electronPath: undefined,
    mainPath: MAIN_PATH,
  });

  const result = manager.open("http://127.0.0.1:3080", BASE_OPTIONS);
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.reason, /Electron binary is unavailable/);
  assert.equal(recorder.calls.length, 0);
  assert.match(manager.lastError ?? "", /unavailable/);
});

test("open fails when spawn throws", () => {
  const manager = new WindowManager({
    spawn: () => {
      throw new Error("ENOENT");
    },
    electronPath: ELECTRON,
    mainPath: MAIN_PATH,
  });

  const result = manager.open("http://127.0.0.1:3080", BASE_OPTIONS);
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.reason, /spawn failed/);
  assert.equal(manager.isOpen(), false);
});

test("close kills the live child and forgets it", () => {
  const recorder = makeSpawnRecorder();
  const manager = new WindowManager({
    spawn: recorder.fn,
    electronPath: ELECTRON,
    mainPath: MAIN_PATH,
  });

  manager.open("http://127.0.0.1:3080", BASE_OPTIONS);
  const child = recorder.calls[0].child;
  manager.close();
  assert.equal(child.killed, true);
  assert.equal(manager.isOpen(), false);
});

test("a spawned-child error event clears the active handle and records the error", () => {
  const recorder = makeSpawnRecorder();
  const manager = new WindowManager({
    spawn: recorder.fn,
    electronPath: ELECTRON,
    mainPath: MAIN_PATH,
  });

  manager.open("http://127.0.0.1:3080", BASE_OPTIONS);
  recorder.calls[0].child.emit("error", new Error("spawn EACCES"));
  assert.equal(manager.isOpen(), false);
  assert.match(manager.lastError ?? "", /EACCES/);
});
