#!/usr/bin/env node
/**
 * Build the NSIS setup installer for the plugin:
 *
 *   node scripts/make-setup.mjs   -> dist/DeepSeek-Harness-Desktop-Setup-<ver>.exe
 *
 * Requires dist/dsh-desktop-plugin (the stage produced by scripts/package.mjs);
 * runs package.mjs first when it is missing. The installer payload is that
 * stage zipped into dist/setup-stage/payload.zip and expanded at install
 * time by setup/desktop-setup.nsi. The NSIS compiler is bundled in
 * tools/nsis (gitignored; fetch from electron-builder-binaries).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const version = pkg.version;

const dist = join(repoRoot, "dist");
const stage = join(dist, "dsh-desktop-plugin");
const setupStage = join(dist, "setup-stage");

function run(command, args, opts = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
}

if (!existsSync(join(stage, "package.json"))) {
  console.log("stage missing - running package.mjs first ...");
  run("node", [join(repoRoot, "scripts", "package.mjs")], { cwd: repoRoot, shell: process.platform === "win32" });
} else {
  // Always re-stage so the payload never goes stale relative to the source.
  console.log("re-staging via package.mjs ...");
  run("node", [join(repoRoot, "scripts", "package.mjs")], { cwd: repoRoot, shell: process.platform === "win32" });
}

console.log("staging payload ...");
rmSync(setupStage, { recursive: true, force: true });
mkdirSync(setupStage, { recursive: true });
// Zip the stage CONTENTS (bin/, scripts/, node_modules/, ...) so the
// installer expands them directly into $INSTDIR.
run(
  "tar",
  ["-a", "-c", "-f", join(setupStage, "payload.zip"), "-C", stage, "."],
  { shell: process.platform === "win32" },
);
const payloadSize = statSync(join(setupStage, "payload.zip")).size;
console.log(`payload: ${join(setupStage, "payload.zip")} (${Math.round(payloadSize / 1024 / 1024)} MB)`);

const makensis = join(repoRoot, "tools", "nsis", "nsis-bundle", "makensis.cmd");
if (!existsSync(makensis)) {
  throw new Error(`NSIS not found at ${makensis} - unzip the nsis bundle from ` +
    "electron-userland/electron-builder-binaries (release nsis@2.0.1) into tools/nsis");
}
console.log(`compiling installer (NSIS) ...`);
run(makensis, [`/DAPP_VERSION=${version}`, join(repoRoot, "setup", "desktop-setup.nsi")], {
  cwd: repoRoot,
  shell: process.platform === "win32",
});
const exe = join(dist, `DeepSeek-Harness-Desktop-Setup-${version}.exe`);
console.log(`setup: ${exe} (${Math.round(statSync(exe).size / 1024 / 1024)} MB)`);
