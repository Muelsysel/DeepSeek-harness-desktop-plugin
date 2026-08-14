import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// install-profile.mjs --check is the read-only verdict the one-click
// launcher (bin\dsh-desktop.cmd) uses to decide whether a fresh extraction
// needs auto-registering before boot. Exit codes: 0 = ready, 1 = needs
// install, 2 = profile not created yet.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(repoRoot, "scripts", "install-profile.mjs");

function makeHome() {
  return mkdtempSync(join(tmpdir(), "dsh-profile-check-"));
}

function check(home, profile = "web") {
  return spawnSync(process.execPath, [script, "--check", "--profile", profile], {
    encoding: "utf8",
    env: { ...process.env, DSH_HOME: home },
  });
}

function writeProfile(home, bundles) {
  const dir = join(home, "profiles", "web");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    `${JSON.stringify(
      {
        name: "dsh-profile-web",
        private: true,
        dependencies: {},
        dsh: { profile: { bundles } },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return dir;
}

test("--check: profile missing -> exit 2", () => {
  const home = makeHome();
  try {
    const r = check(home);
    assert.equal(r.status, 2);
    assert.match(r.stdout, /profile missing/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("--check: not registered -> exit 1", () => {
  const home = makeHome();
  try {
    writeProfile(home, ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"]);
    const r = check(home);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /not installed/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("--check: registered in bundles but not linked -> exit 1", () => {
  const home = makeHome();
  try {
    // bundle entry present, but no node_modules/dsh-desktop link yet
    writeProfile(home, ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-desktop"]);
    const r = check(home);
    assert.equal(r.status, 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("--check: registered + linked + built -> exit 0", () => {
  const home = makeHome();
  try {
    const dir = writeProfile(home, [
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "dsh-desktop",
    ]);
    mkdirSync(join(dir, "node_modules", "dsh-desktop"), { recursive: true });
    const r = check(home);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /installed/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
