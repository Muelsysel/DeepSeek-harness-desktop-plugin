# 0004 — Standalone packaged app for non-developer users

> **Superseded (delivery shape)**: the *portable exe* distribution was cancelled; the standalone technology was **revived as the NSIS setup installer's payload** — `scripts/make-setup.mjs` now packages `apps/standalone/` (bundled backend + Electron runtime) into `dist/DeepSeek-Harness-Desktop-Setup-<ver>.exe`. The decision below remains the record of the original choice.

The plugin+launcher delivery (plugin package, bundle patch, installer scripts, one-click launcher) needs a working dsh install, a profile, and a pnpm step. For a non-developer, "double-click one thing and get a window" means a self-contained build. Decision: a **standalone packaged app** — an Electron portable exe that bundles the dsh backend, owns a private DSH home, and opens the same Codex-like window, with no Node/pnpm/profile setup.

This supersedes the original non-goal "no packaged installers (.exe/.msi/.dmg) — a plugin + launcher, not a bundled app", which was written for the plugin deliverable. Both deliveries now exist and share the same shell assets (`desktop/main.cjs` logic, `preload.cjs`, `codex.css`).

## Shape

- Source: `apps/standalone/` — its own package with `main.cjs` (a fork of the plugin's shell that *owns* the backend lifecycle), `backend/` (a plain-layout dsh install: `@deepseek-ai/dsh` CLI + the web bundles), `scripts/build-backend.mjs` (rebuilds the bundled backend), and electron-builder config.
- The app spawns the bundled dsh CLI as a Node child (`ELECTRON_RUN_AS_NODE`), pointed at a **private** profile `desktop` under `%APPDATA%\DeepSeek-Harness-Desktop` (first run copies the bundled `node_modules` in). It parses the `dsh web: http://127.0.0.1:<port>` line the web app prints to learn the OS-assigned port, opens one BrowserWindow (Codex skin, dark), and **closing the window stops the backend and quits**.
- Build: `apps/standalone/scripts/build-backend.mjs` + `electron-builder --win portable` → `dist/exe/DeepSeek-Harness-Desktop-<ver>.exe` (zero-install, self-extracting).
- `scripts/package.mjs` packages the **plugin** delivery as an offline zip (source + built lib + full node_modules); the exe is the **standalone** delivery. The two stay separate.

## Considered Options

- **NSIS installer**: adds install/uninstall, Start-menu entries, file association — more Windows surface to maintain; the portable exe already needs zero install, which fits the "click to launch" promise.
- **Ship only the plugin zip**: still requires the user to have dsh, create a profile, and run `bin\install.cmd` — not "double-click one thing".
- **One Electron app hosting the whole dsh source tree**: heavier than bundling the npm `@deepseek-ai/dsh` release, and duplicates what the profile loader already does.

## Consequences

- Two artifacts to build and verify: the plugin zip and the portable exe. Both are produced by scripts and verified live (window opens, UI serves, skin applied, close stops the backend).
- The standalone owns a private profile, so it never touches the user's `$DSH_HOME` profiles — safe to run alongside a regular `dsh web`.
- First run copies the backend's `node_modules` into the private profile (one-time, tens of seconds).
- The standalone is deliberately a thin launcher: no plugin registry, no `/desktop` command, no shared window manager — the plugin remains the integration surface for real profiles.
