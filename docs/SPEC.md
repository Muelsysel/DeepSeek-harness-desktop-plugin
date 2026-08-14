# Spec — dsh-desktop

Source: the grilling session in `docs/grill.md` (the user was unavailable; every decision there is research-grounded). Scope agreed there.

## Problem

DeepSeek Harness runs as a web UI in the browser. The user wants a desktop-plugin experience: click something → a Codex-like native window opens → the harness's full capability set works inside it.

## Deliverables

1. **`dsh-desktop` plugin package** (this repo root):
   - Host-side Cordis plugin (`name: desktop`, `inject: [commands, webServer]`).
   - Registers the `/desktop` human command: opens (or reuses) the desktop window at the live `http://127.0.0.1:<webServer.port>` URL.
   - `autoOpen` config: opens the window at boot. Default `false`; the bundle row arms it from `DSH_DESKTOP_LAUNCH=1`.
   - Config surface: `autoOpen`, `title`, `width`, `height`, `theme` (`codex` | `default`), `electronArgs`.
2. **Electron shell** (`desktop/`): `main.cjs` (window, load-with-retry, single instance per port, external links → system browser, official DeepSeek whale icon on the window + taskbar), `preload.cjs`, `codex.css` (Codex skin via `--dsw-*` token overrides).
3. **Bundle patch** (`patch/desktop.bundle.yml`): inserts the `desktop` row.
4. **Installer** (`scripts/install-profile.mjs`, `bin/install.cmd`): installs the package into the web profile and appends it to `dsh.profile.bundles` (backup before edit).
5. **One-click launcher** (`bin/dsh-desktop.cmd`): boots the web profile with auto-open armed; on first launch it auto-registers the plugin into the booted profile if missing (`scripts\install-profile.mjs --check`: exit 0 ready / 1 needs install / 2 profile not created yet — the installer creates a minimal profile skeleton on the spot, so a brand-new machine works on the very first click), so a fresh zip extraction is click-to-use without running `bin\install.cmd` first; `bin/uninstall.cmd` removes it.
6. **First-run wizard + root entry points** (`start.cmd`, `create-shortcut.cmd` at the repo/zip root): guided setup `[1/5]` Node check (hard-required ≥ 22.19; wizard blocks older versions) → `[2/5]` DeepSeek Harness (dsh CLI) check — dsh runs via `npx @deepseek-ai/dsh web`, which the launcher executes automatically when missing → `[3/5]` plugin registration → `[4/5]` Desktop shortcut (optional, whale icon; `noshortcut` arg skips it) → `[5/5]` launch. `create-shortcut.cmd` re-creates the Desktop shortcut any time.
7. **Setup installer** (`setup/desktop-setup.nsi` + `scripts/make-setup.mjs`, NSIS, MUI2, SimpChinese/English): installs the package to `%LOCALAPPDATA%\Programs\DeepSeek Harness Desktop` (no admin), expands the payload, creates Desktop + Start Menu shortcuts with the official icon, registers an uninstall entry, and runs the first-run wizard on finish. Built by the NSIS compiler bundled under `tools/` (gitignored; fetched from electron-builder-binaries).
8. **Docs**: `CONTEXT.md`, `docs/grill.md`, `docs/SPEC.md`, `docs/adr/0001..0004`, `README.md`, `AGENTS.md`.
9. ~~**Standalone packaged app**~~ — **cancelled** (replaced by the setup installer, deliverable 7). The code remains in `apps/standalone/` (incl. the startup splash: a frameless 440×300 window showing dependency-install/backend-boot/UI-load progress before handoff) but it is no longer built or shipped.

## Non-goals

- No reimplementation of harness features — the window loads the live profile.
- No client-side UI plugin/button (the `/desktop` command covers in-UI launch).
- The plugin itself is not a bundled app — it stays a plugin + launcher + setup installer; the standalone portable exe (ADR-0004) was cancelled in favor of the setup installer.
- No file:// + IPC transport (not shipped by dsh).

## Acceptance criteria

1. `npm run build` and `npm test` pass (unit tests at the logic seams).
2. With the plugin mounted in a web profile and `DSH_DESKTOP_LAUNCH=1`, booting the profile opens exactly one Electron window, the window shows the dsh UI (Codex skin applied, dark), and the UI is fully interactive (session composer reachable).
3. `/desktop` while a window is open reuses it (no second window).
4. Closing the window does not kill the dsh backend; stopping dsh kills the window.
5. A plain `dsh web` (no env flag) opens no window and keeps the browser flow.
6. The launcher works from a fresh extraction: first click auto-registers the plugin (creating the profile skeleton when none exists) and opens the window; the window carries the official DeepSeek whale icon.
7. The setup installer installs to `%LOCALAPPDATA%`, creates whale-icon shortcuts and an uninstall entry, and the first-run wizard installs DeepSeek Harness when missing, registers the plugin, and launches.

## Seams under test (confirmed with tdd)

- `webUrl(port)` — URL building.
- `buildWindowArgs(url, options)` — argv construction.
- `resolveElectronBinary(requireFn, env)` — binary resolution.
- `WindowManager.open/close/isOpen` — single-instance window lifecycle (injected spawn).
- `mountDesktop(ctx, config, manager)` — command registration, handler outcome, auto-open, teardown.
