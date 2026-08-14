#!/usr/bin/env node
/**
 * Build the standalone backend: a self-contained dsh install under
 * apps/standalone/backend (npm plain layout, so the profile loader can
 * resolve every bundle from the profile's node_modules).
 *
 *   node apps/standalone/scripts/build-backend.mjs
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, "..");
const backendDir = join(appDir, "backend");
const repoRoot = resolve(appDir, "..", "..");

const DEPS = {
  "@deepseek-ai/dsh": "0.1.0-rc.6",
  "@deepseek-ai/dsh-base": "0.1.0-rc.6",
  "@deepseek-ai/dsh-web-app": "0.1.0-rc.6",
};

function run(command, args, opts = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["inherit", "inherit", "inherit"], ...opts });
}

console.log("[backend] writing backend/package.json ...");
mkdirSync(backendDir, { recursive: true });
writeFileSync(
  join(backendDir, "package.json"),
  JSON.stringify(
    {
      name: "dsh-desktop-backend",
      private: true,
      version: "0.1.0",
      dependencies: DEPS,
    },
    null,
    2,
  ) + "\n",
);

console.log("[backend] npm install (plain layout) ...");
run("npm", ["install", "--prefix", backendDir, "--no-audit", "--no-fund"], { shell: process.platform === "win32" });

// npm's --prefix install can leave a junction back to the parent package
// (the standalone app itself) in backend/node_modules; electron-builder
// chokes on it, so drop it if present.
rmSync(join(backendDir, "node_modules", "dsh-desktop-standalone"), { recursive: true, force: true });

// Copy the shared shell assets (skin + preload) next to the app main.
for (const name of ["preload.cjs", "codex.css"]) {
  cpSync(join(repoRoot, "desktop", name), join(appDir, name));
}

console.log("[backend] done.");
