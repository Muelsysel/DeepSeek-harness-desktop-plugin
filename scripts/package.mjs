#!/usr/bin/env node
/**
 * Package the plugin as a ready-to-run zip: source + built lib + the full
 * node_modules (Electron included), so a fresh machine can unzip and run
 * bin\install.cmd / bin\dsh-desktop.cmd with no network step.
 *
 *   node scripts/package.mjs        -> dist/DeepSeek-harness-desktop-plugin-<ver>.zip
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
const stage = join(dist, "dsh-desktop-plugin");

function run(command, args, opts = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
}

console.log("building lib ...");
if (!existsSync(join(repoRoot, "lib", "index.js"))) {
  run("npm", ["run", "build"], { cwd: repoRoot, shell: process.platform === "win32" });
}

console.log("staging files ...");
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

// robocopy: /E copies the tree; /XD excludes dirs. Name-only /XD matches at
// ANY depth (it would also drop node_modules/electron/dist), so pass full
// paths. Exit codes 0-7 are success (1 = files copied); >= 8 is a failure.
// execFileSync throws on non-zero, so capture and reinterpret.
let rc = 0;
try {
  execFileSync(
    "robocopy",
    [
      repoRoot,
      stage,
      "/E",
      "/XD",
      join(repoRoot, ".git"),
      join(repoRoot, ".agents"),
      join(repoRoot, ".claude"),
      join(repoRoot, "agent"),
      join(repoRoot, "scratch"),
      join(repoRoot, "dist"),
      join(repoRoot, "apps"),
      "/XF",
      join(repoRoot, "skills-lock.json"),
      "/NFL",
      "/NDL",
      "/NJH",
      "/NJS",
      "/NC",
      "/NS",
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
} catch (error) {
  rc = error.status ?? 0;
}
if (rc >= 8) throw new Error(`robocopy failed with exit code ${rc}`);

const zipPath = join(dist, `DeepSeek-harness-desktop-plugin-${version}.zip`);
console.log("zipping ...");
rmSync(zipPath, { force: true });
// Windows bsdtar handles zip via -a; fall back to PowerShell Compress-Archive.
try {
  run("tar", ["-a", "-c", "-f", zipPath, "-C", dist, "dsh-desktop-plugin"], { shell: true });
} catch {
  run(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${join(dist, "dsh-desktop-plugin", "*")}' -DestinationPath '${zipPath}' -Force`,
    ],
    { shell: true },
  );
}
const size = statSync(zipPath).size;
console.log(`zip: ${zipPath} (${Math.round(size / 1024 / 1024)} MB)`);
