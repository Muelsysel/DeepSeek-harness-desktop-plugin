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
2. **Electron shell** (`desktop/`): `main.cjs` (window, load-with-retry, single instance per port, external links → system browser), `preload.cjs`, `codex.css` (Codex skin via `--dsw-*` token overrides).
3. **Bundle patch** (`patch/desktop.bundle.yml`): inserts the `desktop` row.
4. **Installer** (`scripts/install-profile.mjs`, `bin/install.cmd`): installs the package into the web profile and appends it to `dsh.profile.bundles` (backup before edit).
5. **One-click launcher** (`bin/dsh-desktop.cmd`): boots the web profile with auto-open armed; on first launch it auto-registers the plugin into the booted profile if missing (`scripts\install-profile.mjs --check`: exit 0 ready / 1 needs install / 2 profile not created yet), so a fresh zip extraction is click-to-use without running `bin\install.cmd` first; `bin/uninstall.cmd` removes it.
6. **Docs**: `CONTEXT.md`, `docs/grill.md`, `docs/SPEC.md`, `docs/adr/0001..0004`, `README.md`, `AGENTS.md`.
7. **Standalone packaged app** (`apps/standalone/`, ADR-0004): a portable Electron exe that bundles the dsh backend and opens the same Codex-like window over a private profile under `%APPDATA%\DeepSeek-Harness-Desktop`. Closing the window stops the backend. Built by `apps/standalone/scripts/build-backend.mjs` + `electron-builder --win portable` → `dist/exe/DeepSeek-Harness-Desktop-<ver>.exe`. No Node/pnpm/profile setup.
   - **Startup splash** (`splash.html` + `icon.png`): a frameless 440×300 window shows progress while booting — profile/dependency install (6–30%), backend boot (animated 30–75%), UI load (80%) — then hands off to the main window (100%) once the UI is ready to show. First-run dependency copy reports per-file progress; symlinks are dereferenced (a junction to the portable temp extraction would dangle on the next run). Closing the splash before handoff cancels startup.

## Non-goals

- No reimplementation of harness features — the window loads the live profile.
- No client-side UI plugin/button (the `/desktop` command covers in-UI launch).
- The plugin itself is not a bundled app — it stays a plugin + launcher; the standalone exe (deliverable 7, ADR-0004) is a separate, self-contained delivery for non-developer users.
- No file:// + IPC transport (not shipped by dsh).

## Acceptance criteria

1. `npm run build` and `npm test` pass (unit tests at the logic seams).
2. With the plugin mounted in a web profile and `DSH_DESKTOP_LAUNCH=1`, booting the profile opens exactly one Electron window, the window shows the dsh UI (Codex skin applied, dark), and the UI is fully interactive (session composer reachable).
3. `/desktop` while a window is open reuses it (no second window).
4. Closing the window does not kill the dsh backend; stopping dsh kills the window.
5. A plain `dsh web` (no env flag) opens no window and keeps the browser flow.
6. The standalone exe boots the bundled backend and opens exactly one window on the live UI (Codex skin, dark); closing the window stops the backend and exits; it never touches `$DSH_HOME` profiles (private `%APPDATA%` home).
7. On launch the standalone shows a frameless splash with a progress bar (dependency install → backend boot → UI load) and hands off to the main window once the UI is ready; closing the splash before handoff cancels startup.

## Seams under test (confirmed with tdd)

- `webUrl(port)` — URL building.
- `buildWindowArgs(url, options)` — argv construction.
- `resolveElectronBinary(requireFn, env)` — binary resolution.
- `WindowManager.open/close/isOpen` — single-instance window lifecycle (injected spawn).
- `mountDesktop(ctx, config, manager)` — command registration, handler outcome, auto-open, teardown.
