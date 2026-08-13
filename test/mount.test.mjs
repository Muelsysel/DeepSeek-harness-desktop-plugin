import { test } from "node:test";
import assert from "node:assert/strict";
import { WindowManager, mountDesktop } from "../lib/desktop.js";
import { makeSpawnRecorder } from "./helpers.mjs";

const MAIN_PATH = "C:/plugin/desktop/main.cjs";
const ELECTRON = "C:/plugin/node_modules/electron/dist/electron.exe";

/**
 * A Cordis-shaped fake context. `effect` runs the generator eagerly and
 * collects the yielded disposers, then hands them back through `dispose()`.
 */
function makeCtx({ port = 3080, warnings = [] } = {}) {
  const registrations = [];
  const disposers = [];
  const ctx = {
    webServer: { port },
    commands: {
      register(definition) {
        registrations.push(definition);
        return () => {};
      },
    },
    logger: { warn: (message) => warnings.push(message) },
    effect(execute, label) {
      const iterator = execute();
      let step = iterator.next();
      while (!step.done) {
        disposers.push(step.value);
        step = iterator.next();
      }
      return () => {
        for (const disposer of [...disposers].reverse()) {
          if (typeof disposer === "function") disposer();
        }
      };
    },
  };
  return { ctx, registrations, disposers };
}

const BASE_CONFIG = {
  autoOpen: false,
  title: "DeepSeek Harness",
  width: 1280,
  height: 800,
  theme: "codex",
  electronArgs: [],
  exitOnClose: false,
};

function makeManager(recorder) {
  return new WindowManager({
    spawn: recorder.fn,
    electronPath: ELECTRON,
    mainPath: MAIN_PATH,
  });
}

test("mountDesktop registers a /desktop command with a description", () => {
  const { ctx, registrations } = makeCtx();
  mountDesktop(ctx, BASE_CONFIG, makeManager(makeSpawnRecorder()));

  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].name, "desktop");
  assert.match(registrations[0].description, /desktop window/i);
});

test("the command handler opens the window at the live server URL", async () => {
  const recorder = makeSpawnRecorder();
  const { ctx, registrations } = makeCtx({ port: 4321 });
  mountDesktop(ctx, BASE_CONFIG, makeManager(recorder));

  const result = await registrations[0].handler({
    commandId: "c1",
    agent: {},
    rawInput: "",
    signal: new AbortController().signal,
  });

  assert.equal(result.kind, "success");
  assert.match(result.kind === "success" ? result.text : "", /http:\/\/127\.0\.0\.1:4321/);
  assert.match(result.kind === "success" ? result.text : "", /pid 4000/);
  assert.equal(recorder.calls.length, 1);
  assert.ok(recorder.calls[0].args.includes("--url=http://127.0.0.1:4321"));
});

test("the command handler reports an error when Electron is missing", async () => {
  const recorder = makeSpawnRecorder();
  const { ctx, registrations } = makeCtx();
  const manager = new WindowManager({
    spawn: recorder.fn,
    electronPath: undefined,
    mainPath: MAIN_PATH,
  });
  mountDesktop(ctx, BASE_CONFIG, manager);

  const result = await registrations[0].handler({
    commandId: "c2",
    agent: {},
    rawInput: "",
    signal: new AbortController().signal,
  });

  assert.equal(result.kind, "error");
  assert.match(result.kind === "error" ? result.text : "", /unavailable/i);
  assert.equal(recorder.calls.length, 0);
});

test("autoOpen spawns the window once at mount time", () => {
  const recorder = makeSpawnRecorder();
  const { ctx } = makeCtx({ port: 3080 });
  mountDesktop(ctx, { ...BASE_CONFIG, autoOpen: true }, makeManager(recorder));

  assert.equal(recorder.calls.length, 1);
  assert.ok(recorder.calls[0].args.includes("--url=http://127.0.0.1:3080"));
});

test("autoOpen=false does not spawn at mount time", () => {
  const recorder = makeSpawnRecorder();
  const { ctx } = makeCtx();
  mountDesktop(ctx, BASE_CONFIG, makeManager(recorder));
  assert.equal(recorder.calls.length, 0);
});

test("autoOpen failure is logged as a warning, not thrown", () => {
  const warnings = [];
  const { ctx } = makeCtx({ warnings });
  const manager = new WindowManager({
    spawn: makeSpawnRecorder().fn,
    electronPath: undefined,
    mainPath: MAIN_PATH,
  });
  mountDesktop(ctx, { ...BASE_CONFIG, autoOpen: true }, manager);

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /auto-open failed/);
});

test("effect teardown closes the window child", () => {
  const recorder = makeSpawnRecorder();
  const { ctx, disposers } = makeCtx();
  mountDesktop(ctx, { ...BASE_CONFIG, autoOpen: true }, makeManager(recorder));

  const child = recorder.calls[0].child;
  for (const disposer of [...disposers].reverse()) {
    if (typeof disposer === "function") disposer();
  }
  assert.equal(child.killed, true);
});

test("exitOnClose shuts the profile down when the window closes", () => {
  const recorder = makeSpawnRecorder();
  const { ctx } = makeCtx();
  let shutdownCalled = 0;
  const manager = makeManager(recorder);
  mountDesktop(
    ctx,
    { ...BASE_CONFIG, autoOpen: true, exitOnClose: true },
    manager,
    () => {
      shutdownCalled += 1;
    },
  );

  assert.equal(shutdownCalled, 0);
  recorder.calls[0].child.emit("exit", 0);
  assert.equal(shutdownCalled, 1);
});

test("exitOnClose=false leaves the profile running when the window closes", () => {
  const recorder = makeSpawnRecorder();
  const { ctx } = makeCtx();
  let shutdownCalled = 0;
  const manager = makeManager(recorder);
  mountDesktop(
    ctx,
    { ...BASE_CONFIG, autoOpen: true, exitOnClose: false },
    manager,
    () => {
      shutdownCalled += 1;
    },
  );

  recorder.calls[0].child.emit("exit", 0);
  assert.equal(shutdownCalled, 0);
});

test("exitOnClose arms through the /desktop command too", async () => {
  const recorder = makeSpawnRecorder();
  const { ctx, registrations } = makeCtx();
  let shutdownCalled = 0;
  const manager = makeManager(recorder);
  mountDesktop(
    ctx,
    { ...BASE_CONFIG, exitOnClose: true },
    manager,
    () => {
      shutdownCalled += 1;
    },
  );

  await registrations[0].handler({
    commandId: "c3",
    agent: {},
    rawInput: "",
    signal: new AbortController().signal,
  });
  recorder.calls[0].child.emit("exit", 0);
  assert.equal(shutdownCalled, 1);
});
