#!/usr/bin/env node
/**
 * Install (or update) the dsh-desktop plugin into a dsh profile.
 *
 *   node scripts/install-profile.mjs [--profile <name>] [--dsh <path>]
 *
 * Steps:
 *   1. resolve the profile directory under $DSH_HOME/profiles/<name>
 *   2. install this package into the profile with pnpm (`file:` dependency)
 *   3. append `dsh-desktop` to the profile's `dsh.profile.bundles` list
 *      (idempotent), backing up package.json first
 *   4. print what was done and how to launch
 *
 * The bundle row itself lives in patch/desktop.bundle.yml; auto-open is driven
 * by DSH_DESKTOP_LAUNCH so `dsh web` stays browser-first by default.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { profile: "web", dsh: undefined, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--profile") out.profile = argv[++i];
    else if (arg === "--dsh") out.dsh = argv[++i];
    else if (arg === "--help" || arg === "-h") out.help = true;
  }
  return out;
}

function dshHome() {
  return process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? process.env.HOME ?? ".", ".dsh");
}

function profileDir(name) {
  return join(dshHome(), "profiles", name);
}

/** Run a command, returning trimmed stdout. */
function run(command, args, opts = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
}/** Append `dsh-desktop` to the profile's bundles list, idempotently. */
function ensureBundle(profilePkgPath) {
  const pkg = JSON.parse(readFileSync(profilePkgPath, "utf8"));
  const bundles = pkg.dsh?.profile?.bundles;
  if (!Array.isArray(bundles)) {
    throw new Error(`profile package.json at ${profilePkgPath} has no dsh.profile.bundles array`);
  }
  if (bundles.includes("dsh-desktop")) return false;
  bundles.push("dsh-desktop");
  copyFileSync(profilePkgPath, `${profilePkgPath}.bak`);
  writeFileSync(profilePkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return true;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("usage: node scripts/install-profile.mjs [--profile web] [--dsh <path-to-dsh>]");
    return;
  }

  const profile = profileDir(args.profile);
  if (!existsSync(profile)) {
    throw new Error(`profile directory not found: ${profile} (set DSH_HOME if needed)`);
  }

  const packageJsonPath = join(profile, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`profile has no package.json: ${packageJsonPath}`);
  }

  // 1. install this package into the profile (pnpm add link:<repo>)
  //    `link:` (not `file:`) so local installs stay live with the source —
  //    `file:` copies the package into pnpm's store, which goes stale the
  //    moment the repo changes.
  console.log(`installing dsh-desktop into profile "${args.profile}" (${profile}) ...`);
  try {
    // Windows resolves .cmd shims only through a shell.
    run("pnpm", ["add", `link:${repoRoot}`], { cwd: profile, shell: process.platform === "win32" });
  } catch (error) {
    throw new Error(`pnpm add failed: ${String(error.stdout ?? error)}`);
  }

  // 2. register the bundle
  const added = ensureBundle(packageJsonPath);
  console.log(added ? "appended dsh-desktop to dsh.profile.bundles (backup: package.json.bak)" : "dsh-desktop already in dsh.profile.bundles");

  console.log("\nDone. Launch with:");
  console.log(`  1. one-click:  ${join(repoRoot, "bin", "dsh-desktop.cmd")}`);
  console.log("  2. command:    /desktop inside the web UI");
  console.log("  3. plain boot: dsh --profile " + args.profile + " web");
}

try {
  main();
} catch (error) {
  console.error(`install-profile: ${error.message}`);
  process.exitCode = 1;
}
