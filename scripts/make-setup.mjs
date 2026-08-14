#!/usr/bin/env node
/**
 * Build the NSIS setup installer for the self-contained desktop app:
 *
 *   node scripts/make-setup.mjs
 *     -> dist/DeepSeek-Harness-Desktop-Setup-<ver>.exe
 *
 * The installer ships the standalone-style app (ADR-0004, revived as an
 * installed app): a bundled dsh backend + the Electron runtime + the shell
 * with startup splash. No Node / pnpm / dsh installation is required on the
 * target machine - the app boots its own backend under ELECTRON_RUN_AS_NODE
 * into a private profile, and closes the backend when the window closes.
 *
 * Assembly:
 *   1. build the bundled backend (apps/standalone/scripts/build-backend.mjs)
 *   2. stage dist/standalone-app/: shell, backend/, electron runtime, icon
 *   3. zip it as the installer payload (expanded by setup/desktop-setup.nsi)
 *   4. compile the NSIS installer (compiler under tools/, gitignored)
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const version = pkg.version;

const dist = join(repoRoot, "dist");
const appDir = join(dist, "standalone-app");
const setupStage = join(dist, "setup-stage");

function run(command, args, opts = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
}

console.log("building the bundled backend ...");
run("node", [join(repoRoot, "apps", "standalone", "scripts", "build-backend.mjs")], {
  cwd: repoRoot,
  shell: process.platform === "win32",
});

console.log("assembling the standalone app bundle ...");
rmSync(appDir, { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });

const sa = join(repoRoot, "apps", "standalone");
// Shell + assets (build-backend.mjs has refreshed preload/codex/icon in apps/standalone)
for (const name of ["main.cjs", "package.json", "preload.cjs", "codex.css", "splash.html", "icon.png"]) {
  cpSync(join(sa, name), join(appDir, name));
}
// Shortcut helpers: make-shortcut.ps1 (reused as-is) + the hidden launcher
// vbs it points at + the official icon.
cpSync(join(repoRoot, "scripts", "make-shortcut.ps1"), join(appDir, "scripts", "make-shortcut.ps1"));
cpSync(join(sa, "bin", "launch-hidden.vbs"), join(appDir, "bin", "launch-hidden.vbs"));
cpSync(join(repoRoot, "bin", "dsh-desktop.ico"), join(appDir, "bin", "dsh-desktop.ico"));
// Bundled backend
cpSync(join(sa, "backend"), join(appDir, "backend"), { recursive: true });
// Electron runtime (binaries only)
cpSync(join(repoRoot, "node_modules", "electron", "dist"), join(appDir, "electron"), { recursive: true });
const appSize = Math.round(statSync(appDir).size / 1024 / 1024);
console.log(`app bundle: ${appDir} (${appSize} MB unpacked)`);

console.log("staging payload ...");
rmSync(setupStage, { recursive: true, force: true });
mkdirSync(setupStage, { recursive: true });
run("tar", ["-a", "-c", "-f", join(setupStage, "payload.zip"), "-C", appDir, "."], {
  shell: process.platform === "win32",
});
const payloadSize = statSync(join(setupStage, "payload.zip")).size;
console.log(`payload: ${join(setupStage, "payload.zip")} (${Math.round(payloadSize / 1024 / 1024)} MB)`);

const makensis = join(repoRoot, "tools", "nsis", "nsis-bundle", "makensis.cmd");
if (!existsSync(makensis)) {
  throw new Error(`NSIS not found at ${makensis} - unzip the nsis bundle from ` +
    "electron-userland/electron-builder-binaries (release nsis@2.0.1) into tools/nsis");
}
console.log("compiling installer (NSIS) ...");
run(makensis, [`/DAPP_VERSION=${version}`, join(repoRoot, "setup", "desktop-setup.nsi")], {
  cwd: repoRoot,
  shell: process.platform === "win32",
});
const exe = join(dist, `DeepSeek-Harness-Desktop-Setup-${version}.exe`);
console.log(`setup: ${exe} (${Math.round(statSync(exe).size / 1024 / 1024)} MB)`);
