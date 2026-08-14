#!/usr/bin/env node
/**
 * Install (or remove) the dsh-desktop plugin into/from a dsh profile.
 *
 *   node scripts/install-profile.mjs [--profile <name>] [--remove|--check]
 *
 * Install steps:
 *   1. resolve the profile directory under $DSH_HOME/profiles/<name>
 *   2. install this package into the profile with pnpm (`link:` dependency)
 *   3. append `dsh-desktop` to the profile's `dsh.profile.bundles` list
 *      (idempotent), backing up package.json first
 *   4. print what was done and how to launch
 *
 * `--check` is read-only: exit 0 = registered and loadable, 1 = needs
 * install, 2 = profile not created yet (used by bin\dsh-desktop.cmd to
 * auto-register a fresh extraction on first launch).
 *
 * With `--remove`, step 2/3 are inverted: the bundle entry is dropped (with a
 * backup) and the package is removed via pnpm. This is the single owner of
 * the bundle-list mutation — bin/uninstall.cmd routes through here.
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
const PLUGIN_NAME = "dsh-desktop";

function parseArgs(argv) {
  const out = { profile: "web", remove: false, check: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--profile") out.profile = argv[++i];
    else if (arg === "--remove") out.remove = true;
    else if (arg === "--check") out.check = true;
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
}

/** Append `dsh-desktop` to the profile's bundles list, idempotently. Returns whether a backup was written. */
function ensureBundle(profilePkgPath) {
  const pkg = JSON.parse(readFileSync(profilePkgPath, "utf8"));
  const bundles = pkg.dsh?.profile?.bundles;
  if (!Array.isArray(bundles)) {
    throw new Error(`profile package.json at ${profilePkgPath} has no dsh.profile.bundles array`);
  }
  if (bundles.includes(PLUGIN_NAME)) return false;
  bundles.push(PLUGIN_NAME);
  copyFileSync(profilePkgPath, `${profilePkgPath}.bak`);
  writeFileSync(profilePkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return true;
}

/** Drop `dsh-desktop` from the profile's bundles list, idempotently. Returns whether a backup was written. */
function dropBundle(profilePkgPath) {
  const pkg = JSON.parse(readFileSync(profilePkgPath, "utf8"));
  const bundles = pkg.dsh?.profile?.bundles;
  if (!Array.isArray(bundles) || !bundles.includes(PLUGIN_NAME)) return false;
  pkg.dsh.profile.bundles = bundles.filter((name) => name !== PLUGIN_NAME);
  copyFileSync(profilePkgPath, `${profilePkgPath}.bak`);
  writeFileSync(profilePkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return true;
}

/**
 * --check: is the plugin registered in the profile and loadable?
 * "Registered" means the bundle entry exists, the pnpm link resolves, and the
 * built lib is present. Prints a one-word status; the exit code is the
 * verdict: 0 = ready, 1 = needs install, 2 = profile not created yet (the
 * first `dsh web` boot creates it; the next click registers).
 */
function checkInstalled(profile, packageJsonPath) {
  if (!existsSync(profile) || !existsSync(packageJsonPath)) {
    console.log("profile missing");
    process.exitCode = 2;
    return;
  }
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } catch {
    console.log("not installed");
    process.exitCode = 1;
    return;
  }
  const bundles = pkg.dsh?.profile?.bundles;
  const registered = Array.isArray(bundles) && bundles.includes(PLUGIN_NAME);
  const linked = existsSync(join(profile, "node_modules", PLUGIN_NAME));
  const built = existsSync(join(repoRoot, "lib", "index.js"));
  const ready = registered && linked && built;
  console.log(ready ? "installed" : "not installed");
  process.exitCode = ready ? 0 : 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("usage: node scripts/install-profile.mjs [--profile web] [--remove|--check]");
    return;
  }

  const profile = profileDir(args.profile);
  const packageJsonPath = join(profile, "package.json");

  // --check: report status without touching anything (used by the launcher).
  if (args.check) {
    checkInstalled(profile, packageJsonPath);
    return;
  }

  if (!existsSync(profile)) {
    throw new Error(`profile directory not found: ${profile} (set DSH_HOME if needed)`);
  }
  if (!existsSync(packageJsonPath)) {
    throw new Error(`profile has no package.json: ${packageJsonPath}`);
  }

  if (args.remove) {
    console.log(`removing dsh-desktop from profile "${args.profile}" (${profile}) ...`);
    const dropped = dropBundle(packageJsonPath);
    console.log(dropped ? "dropped dsh-desktop from dsh.profile.bundles (backup: package.json.bak)" : "dsh-desktop not in dsh.profile.bundles");
    try {
      run("pnpm", ["remove", PLUGIN_NAME], { cwd: profile, shell: process.platform === "win32" });
      console.log("removed dsh-desktop package from the profile");
    } catch {
      console.log("pnpm remove skipped (package may already be gone; run: pnpm --dir <profile> remove dsh-desktop)");
    }
    return;
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
