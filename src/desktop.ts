/**
 * Desktop-window orchestration, kept free of Cordis so it is unit-testable
 * without booting a harness.
 *
 * @module dsh-desktop/desktop
 */
import type { ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Window presentation options carried from plugin config into the shell. */
export interface WindowOptions {
  /** Window title shown in the native title bar. */
  readonly title: string;
  /** Initial inner width in CSS pixels. */
  readonly width: number;
  /** Initial inner height in CSS pixels. */
  readonly height: number;
  /** `codex` applies the Codex-like skin; `default` keeps the stock UI. */
  readonly theme: "codex" | "default";
  /** Extra argv passed to the Electron binary before the main script. */
  readonly electronArgs: string[];
}

/** Minimal spawn signature the manager needs, injectable for tests. */
export type SpawnFn = (
  command: string,
  args: readonly string[],
  options: { stdio: "ignore"; env: NodeJS.ProcessEnv },
) => ChildProcess;

/** The child handle the manager keeps for one live window. */
export interface WindowHandle {
  /** The spawned Electron process id. */
  readonly pid: number;
  /** The spawned child, for liveness checks and teardown. */
  readonly child: ChildProcess;
}

/** Result of attempting to (re)open the window. */
export type OpenResult =
  | { ok: true; pid: number }
  | { ok: false; reason: string };

/** Structural match of cordis's `Effect` (generator yielding disposers). */
type SyncEffectLike = (() => unknown) | Iterable<() => unknown, void, void>;

/** The subset of the Cordis context the desktop mount needs. */
export interface DesktopCtx {
  readonly webServer: { readonly port: number };
  readonly commands: {
    register(definition: {
      name: string;
      description: string;
      handler: (invocation: unknown) => CommandResult | Promise<CommandResult>;
    }): () => void;
  };
  readonly logger: {
    readonly warn: (message: string) => void;
    readonly info?: (message: string) => void;
  };
  /** Run a Cordis-style effect generator; returns the disposer. */
  effect(execute: () => SyncEffectLike, label?: string): () => Promise<void>;
}

/** Human-command outcome, structurally compatible with dsh-commands. */
export type CommandResult =
  | { kind: "success"; text: string }
  | { kind: "error"; text: string };

/** Build the loopback web URL for a listening port. */
export function webUrl(port: number, host = "127.0.0.1"): string {
  return `http://${host}:${port}`;
}

/**
 * App argv for the Electron main process (everything after the main script
 * path). `--url` is required; the rest are presentation hints. `parentPid`
 * arms the shell's orphan watchdog (the window quits when its dsh parent
 * dies). Electron CLI switches (`options.electronArgs`) are NOT included here
 * — the spawner places them before the main script path, where Chromium
 * expects them.
 */
export function buildWindowArgs(
  url: string,
  options: WindowOptions,
  parentPid?: number,
): string[] {
  return [
    `--url=${url}`,
    `--title=${options.title}`,
    `--theme=${options.theme}`,
    `--size=${options.width}x${options.height}`,
    ...(parentPid === undefined ? [] : [`--parent-pid=${parentPid}`]),
  ];
}

/**
 * Resolve the Electron binary to spawn.
 *
 * `DSH_DESKTOP_ELECTRON` wins when set; otherwise `require("electron")` is
 * asked, which — from a plain Node process — returns the binary path.
 */
export function resolveElectronBinary(
  requireFn: (id: string) => unknown,
  env: NodeJS.ProcessEnv,
): string | undefined {
  const fromEnv = env.DSH_DESKTOP_ELECTRON;
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  try {
    const resolved = requireFn("electron");
    return typeof resolved === "string" && resolved.length > 0 ? resolved : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Single-instance window manager: at most one live Electron window per
 * manager. A second open while one is live reports the existing pid instead
 * of spawning a duplicate.
 */
export class WindowManager {
  readonly #spawn: SpawnFn;
  readonly #electronPath: string | undefined;
  readonly #mainPath: string;
  readonly #parentPid: number | undefined;
  #active: WindowHandle | undefined;
  #lastError: string | undefined;
  #exitHandlers: Array<() => void> = [];

  constructor(options: {
    spawn: SpawnFn;
    electronPath: string | undefined;
    mainPath: string;
    parentPid?: number;
  }) {
    this.#spawn = options.spawn;
    this.#electronPath = options.electronPath;
    this.#mainPath = options.mainPath;
    this.#parentPid = options.parentPid;
  }

  /**
   * Register a handler invoked whenever the live window child exits (user
   * closed it, it crashed, or it was killed). Handlers fire once per exit.
   */
  onExit(handler: () => void): void {
    this.#exitHandlers.push(handler);
  }

  /** The resolved Electron binary, or undefined when unavailable. */
  get electronPath(): string | undefined {
    return this.#electronPath;
  }

  /** The most recent spawn failure message, if any. */
  get lastError(): string | undefined {
    return this.#lastError;
  }

  /** Whether a window child is currently believed to be running. */
  isOpen(): boolean {
    const active = this.#active;
    if (active === undefined) return false;
    return active.child.exitCode === null && !active.child.killed;
  }

  /**
   * Open (or reuse) the desktop window for `url`.
   *
   * @returns the running pid on success; a human-readable reason otherwise.
   */
  open(url: string, options: WindowOptions): OpenResult {
    const electronPath = this.#electronPath;
    if (electronPath === undefined) {
      this.#lastError =
        "the Electron binary is unavailable — run `npm install` in the plugin, or set DSH_DESKTOP_ELECTRON";
      return { ok: false, reason: this.#lastError };
    }
    if (this.isOpen()) {
      const active = this.#active;
      if (active !== undefined) return { ok: true, pid: active.pid };
    }
    const windowArgs = buildWindowArgs(url, options, this.#parentPid);
    let child: ChildProcess;
    try {
      // Electron CLI switches (e.g. --no-sandbox, --remote-debugging-port)
      // must precede the app path; anything after it is an app argument.
      child = this.#spawn(
        electronPath,
        [...options.electronArgs, this.#mainPath, ...windowArgs],
        {
          stdio: "ignore",
          env: process.env,
        },
      );
    } catch (error) {
      this.#lastError = `spawn failed: ${String(error)}`;
      return { ok: false, reason: this.#lastError };
    }
    const pid = child.pid ?? -1;
    this.#active = { pid, child };
    child.once("error", (error) => {
      this.#lastError = `electron exited with an error: ${error.message}`;
      if (this.#active?.child === child) this.#active = undefined;
    });
    child.once("exit", () => {
      if (this.#active?.child === child) this.#active = undefined;
      const handlers = this.#exitHandlers;
      this.#exitHandlers = [];
      for (const handler of handlers) {
        try {
          handler();
        } catch {
          /* a watcher must never break the manager */
        }
      }
    });
    return { ok: true, pid };
  }

  /** Kill the live window child, if any, and forget it. */
  close(): void {
    const active = this.#active;
    if (active !== undefined && active.child.exitCode === null && !active.child.killed) {
      active.child.kill();
    }
    this.#active = undefined;
  }
}

/**
 * Build the plugin's window manager from runtime inputs. `mainPath` defaults
 * to this package's own Electron entry so the plugin surface stays a pure
 * adapter.
 */
export function createWindowManager(options: {
  requireFn: (id: string) => unknown;
  env: NodeJS.ProcessEnv;
  spawn: SpawnFn;
  mainPath?: string;
  parentPid?: number;
}): WindowManager {
  const mainPath =
    options.mainPath ??
    fileURLToPath(new URL("../desktop/main.cjs", import.meta.url));
  return new WindowManager({
    spawn: options.spawn,
    electronPath: resolveElectronBinary(options.requireFn, options.env),
    mainPath,
    parentPid: options.parentPid ?? process.pid,
  });
}

/**
 * Stop the whole profile when the desktop window is the app surface and the
 * user closes it. Reuses the runtime's own SIGTERM path — the profile boot
 * registers a `SIGTERM` listener that disposes the plugin tree gracefully
 * (session persistence drains, subprocesses are cleaned up). A safety net
 * hard-exits shortly after if no handler reacted (e.g. not running under the
 * standard boot).
 */
export function shutdownGracefully(): void {
  try {
    process.emit("SIGTERM");
  } catch {
    /* fall through to the safety net */
  }
  setTimeout(() => process.exit(0), 2000).unref();
}

/**
 * Wire the desktop plugin into a live context: register the `/desktop`
 * command, optionally auto-open on boot, and tear the window down with the
 * context. Extracted from the plugin entry so tests can drive it with fakes.
 */
export function mountDesktop(
  ctx: DesktopCtx,
  config: WindowOptions & { autoOpen: boolean; exitOnClose: boolean },
  manager: WindowManager,
  shutdown: () => void = shutdownGracefully,
): void {
  // Boot diagnostics, only when the debug flag is set.
  if (process.env.DSH_DESKTOP_DEBUG) {
    console.log(
      `[dsh-desktop] apply autoOpen=${String(config.autoOpen)} electron=${manager.electronPath ?? "MISSING"}`,
    );
  }

  // In app mode the window IS the app: closing it stops the backend.
  let exitArmed = false;
  const armExitOnClose = () => {
    if (config.exitOnClose && !exitArmed) {
      exitArmed = true;
      manager.onExit(() => {
        ctx.logger.info?.(`dsh-desktop: window closed; shutting down the profile`);
        shutdown();
      });
    }
  };

  ctx.effect(function* () {
    yield ctx.commands.register({
      name: "desktop",
      description: "Open the DeepSeek Harness desktop window",
      handler: () => {
        const url = webUrl(ctx.webServer.port);
        const opened = manager.open(url, config);
        if (!opened.ok) {
          return { kind: "error", text: `Desktop window unavailable: ${opened.reason}` };
        }
        armExitOnClose();
        return { kind: "success", text: `Desktop window opened → ${url} (pid ${opened.pid})` };
      },
    });

    if (config.autoOpen) {
      const url = webUrl(ctx.webServer.port);
      const opened = manager.open(url, config);
      if (!opened.ok) ctx.logger.warn(`dsh-desktop: auto-open failed: ${opened.reason}`);
      else armExitOnClose();
    }

    yield async () => manager.close();
  }, "desktop lifecycle");
}
