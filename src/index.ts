/**
 * dsh-desktop — the desktop plugin for DeepSeek Harness.
 *
 * Mounted in a web profile, it registers the `/desktop` human command and
 * (optionally) auto-opens a Codex-like native window on boot. The window is an
 * Electron shell that loads the live `dsh web` UI over HTTP, so every feature
 * of the running profile is available in the window by construction — nothing
 * is re-implemented.
 *
 * @module dsh-desktop
 */
import type { Context } from "@deepseek-ai/cordis";
// Load the Context service augmentations so `ctx.commands` and
// `ctx.webServer` are typed as the injected services they are at runtime.
import type { CommandRuntime } from "@deepseek-ai/dsh-commands";
import type { WebServer } from "@deepseek-ai/dsh-host-webserver";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { WindowManager, mountDesktop, resolveElectronBinary } from "./desktop.js";

export const name = "desktop";

/** Requires the human-command registry and the live web server. */
export const inject = ["commands", "webServer"];

/** Plugin configuration surface. */
export interface Config {
  /** Open the window automatically as soon as the web server is up. */
  autoOpen: boolean;
  /** Window title shown in the native title bar. */
  title: string;
  /** Initial window width in CSS pixels. */
  width: number;
  /** Initial window height in CSS pixels. */
  height: number;
  /** `codex` applies the Codex-like skin; `default` keeps the stock UI. */
  theme: "codex" | "default";
  /** Extra argv passed to the Electron binary. */
  electronArgs: string[];
}

export const Config: z<Config> = z.object({
  autoOpen: z.boolean().default(false),
  title: z.string().default("DeepSeek Harness"),
  width: z.natural().min(320).default(1280),
  height: z.natural().min(240).default(800),
  theme: z.union([z.const("codex"), z.const("default")]).default("codex"),
  electronArgs: z.array(z.string()).default([]),
});

export function apply(ctx: Context, config: Config): void {
  const require = createRequire(import.meta.url);
  const mainPath = fileURLToPath(new URL("../desktop/main.cjs", import.meta.url));
  const manager = new WindowManager({
    spawn: (command, args, options) => spawn(command, args, options),
    electronPath: resolveElectronBinary(require, process.env),
    mainPath,
  });

  // Boot diagnostics: only when DSH_DESKTOP_DEBUG is set (used by tests and
  // the desktop shell's debug mode).
  if (process.env.DSH_DESKTOP_DEBUG) {
    console.log(
      `[dsh-desktop] apply autoOpen=${String(config.autoOpen)} electron=${manager.electronPath ?? "MISSING"}`,
    );
  }

  mountDesktop(
    ctx,
    {
      autoOpen: config.autoOpen,
      title: config.title,
      width: config.width,
      height: config.height,
      theme: config.theme,
      electronArgs: config.electronArgs,
    },
    manager,
  );
}
