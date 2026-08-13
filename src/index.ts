/**
 * dsh-desktop — the desktop plugin for DeepSeek Harness.
 *
 * Mounted in a web profile, it registers the `/desktop` human command and
 * (optionally) auto-opens a Codex-like native window on boot. The window is an
 * Electron shell that loads the live `dsh web` UI over HTTP, so every feature
 * of the running profile is available in the window by construction — nothing
 * is re-implemented.
 *
 * This module is a pure adapter: every behaviour lives in `./desktop.js`.
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
import z from "@deepseek-ai/schemastery";
import { createWindowManager, mountDesktop, type WindowOptions } from "./desktop.js";

export const name = "desktop";

/** Requires the human-command registry and the live web server. */
export const inject = ["commands", "webServer"];

/** Plugin configuration surface: the window presentation plus lifecycle. */
export interface Config extends WindowOptions {
  /** Open the window automatically as soon as the web server is up. */
  autoOpen: boolean;
  /** Stop the whole profile when the desktop window closes (app mode). */
  exitOnClose: boolean;
}

export const Config: z<Config> = z.object({
  autoOpen: z.boolean().default(false),
  exitOnClose: z.boolean().default(false),
  title: z.string().default("DeepSeek Harness"),
  width: z.natural().min(320).default(1280),
  height: z.natural().min(240).default(800),
  theme: z.union([z.const("codex"), z.const("default")]).default("codex"),
  electronArgs: z.array(z.string()).default([]),
});

export function apply(ctx: Context, config: Config): void {
  mountDesktop(
    ctx,
    config,
    createWindowManager({
      requireFn: createRequire(import.meta.url),
      env: process.env,
      spawn: (command, args, options) => spawn(command, args, options),
    }),
  );
}
