# 0004 — Standalone packaged app for non-developer users

> **Superseded (delivery shape)**: the *portable exe* distribution was cancelled; the standalone technology was **revived as the NSIS setup installer's payload** — `scripts/make-setup.mjs` now packages `apps/standalone/` (bundled backend + Electron runtime + splash) into `dist/DeepSeek-Harness-Desktop-Setup-<ver>.exe`, installed to `%LOCALAPPDATA%\Programs\DeepSeek-Harness-Desktop`. The decision below remains the record of the original choice.

The plugin+launcher delivery (plugin package, bundle patch, installer scripts, one-click launcher) needs a working dsh install, a profile, and a pnpm step. For a non-developer, "double-click one thing and get a window" means a self-contained build. Decision: a **standalone packaged app** — a self-contained build that bundles the dsh backend, owns a private DSH home, and opens the same Codex-like window, with no Node/pnpm/profile setup.

This supersedes the original non-goal "no packaged installers (.exe/.msi/.dmg) — a plugin + launcher, not a bundled app", which was written for the plugin deliverable. Both deliveries now exist and share the same shell assets (`desktop/main.cjs` logic, `preload.cjs`, `codex.css`).

## Shape (final)

- Source: `apps/standalone/` — its own package with `main.cjs` (a fork of the plugin's shell that *owns* the backend lifecycle), `backend/` (a plain-layout dsh install: `@deepseek-ai/dsh` CLI + the web bundles), `scripts/build-backend.mjs` (rebuilds the bundled backend).
- The app spawns the bundled dsh CLI as a Node child (`ELECTRON_RUN_AS_NODE` + `--expose-internals`), pointed at a **private** profile `desktop` under `%APPDATA%\DeepSeek-Harness-Desktop` (first run copies the bundled `node_modules` in). It parses the `dsh web: http://127.0.0.1:<port>` line the web app prints to learn the OS-assigned port, opens one BrowserWindow (light by default; `theme: codex` opts into the dark Codex skin) with a startup splash, and **closing the window stops the backend and quits**.
- Build: `apps/standalone/scripts/build-backend.mjs` + `scripts/make-setup.mjs` (NSIS, compiler under gitignored `tools/`) → `dist/DeepSeek-Harness-Desktop-Setup-<ver>.exe` (installed app with Desktop/Start-Menu/in-install launchers and an uninstall entry). The cancelled `electron-builder --win portable` path was removed in v0.1.2.
- `scripts/package.mjs` packages the **plugin** delivery as an offline zip (source + built lib + full node_modules); the setup exe is the **standalone** delivery. The two stay separate.

## Considered Options

- **Portable exe (original choice)**: zero-install, self-extracting — but brittle as a delivery shape (temp extraction each run, no uninstall surface), so it was cancelled and replaced by the NSIS installed-app form below.
- **NSIS installer (final)**: adds install/uninstall, Start-menu and Desktop entries, an in-install launcher, and a registry uninstall entry; the bundled backend + Electron runtime still mean no Node/pnpm/dsh on the target machine. The portable exe's "click to launch" promise survives via the shortcuts.
- **Ship only the plugin zip**: still requires the user to have dsh, create a profile, and run `bin\install.cmd` — not "double-click one thing".
- **One Electron app hosting the whole dsh source tree**: heavier than bundling the npm `@deepseek-ai/dsh` release, and duplicates what the profile loader already does.

## Consequences

- Two artifacts to build and verify: the plugin zip and the setup installer. Both are produced by scripts and verified live (window opens, UI serves, skin applied, close stops the backend).
- The standalone owns a private profile, so it never touches the user's `$DSH_HOME` profiles — safe to run alongside a regular `dsh web`.
- First run copies the backend's `node_modules` into the private profile (one-time, tens of seconds), shown on the startup splash.
- The standalone is deliberately a thin launcher: no plugin registry, no `/desktop` command, no shared window manager — the plugin remains the integration surface for real profiles.
