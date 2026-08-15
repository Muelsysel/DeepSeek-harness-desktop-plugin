# DeepSeek Harness Desktop

> [中文](README.md) · English

Put DeepSeek Harness into a native desktop window: **double-click to launch**, and the window hosts the live UI of your current `dsh web` profile — agent sessions, tools, plan, goal, subagent, workflow… everything works out of the box. Nothing is re-implemented.

> Everything is a plugin — this repo is the "window".

![Main UI](docs/screenshot.png)

## Features

- 🖱️ **One-click launch**: desktop shortcut or the in-install launcher — double-click to get the window (white/light by default, dark Codex skin optional)
- 🪟 Native Electron window loading the live UI at `http://127.0.0.1:<port>`
- ⌨️ Type `/desktop` in the web UI to open/reuse the window (one window per backend)
- 🔗 External links open in the system browser
- 🛑 **Closing the window stops the backend** (installer version); without `DSH_DESKTOP_LAUNCH`, plain `dsh web` stays browser-first
- 🚀 **Startup splash**: an instant whale progress window (initializing the backend / loading the UI) hands off to the main window when ready
- 🐋 Official DeepSeek whale icon everywhere (window, taskbar, shortcuts, installer)

## Getting started

### Option 1: install via git clone (recommended — always the latest code)

Run these in a terminal (Node.js ≥ 22.19 **required**; git needed; clone to a path without spaces):

```bat
git clone https://github.com/Muelsysel/DeepSeek-Harness-Desktop.git
cd DeepSeek-Harness-Desktop
start.cmd
```

`start.cmd` automatically: first build (`npm install` + `npm run build`) → checks Node.js → checks DeepSeek Harness → **registers the plugin** (installs it into `$DSH_HOME\profiles\web`) → **creates the Desktop shortcut** (whale icon) → launches the window. No file edits needed. The window opens and is ready to use; for everyday use afterwards, double-click the **「DeepSeek Harness 桌面版」** icon on your Desktop (or `bin\dsh-desktop.cmd`, or `/desktop` in the web UI).

> To update to the latest code later: `git pull`, then re-run `start.cmd` (registration is idempotent and the shortcut is refreshed).
> You can also build manually first: `npm install && npm run build && start.cmd`.

### Option 2: zip portable version (no install, no git needed)

Three steps: **download → one command → use**.

1. Download `DeepSeek-harness-desktop-plugin-<version>.zip` from [GitHub Releases](https://github.com/Muelsysel/DeepSeek-Harness-Desktop/releases) and extract it (Node.js ≥ 22.19 **required**; pnpm is auto-installed during registration)
2. Open a terminal (any directory) and run one line — replace `<extract-path>` with your actual extraction location (or just double-click root `start.cmd` — same effect):

   ```bat
   cd /d "<extract-path>" && start.cmd
   ```

   This single command automatically: checks Node.js → checks DeepSeek Harness → **registers the plugin** (installs it into `$DSH_HOME\profiles\web`) → **creates the Desktop shortcut** (whale icon) → launches the window. No file edits needed.
3. The window opens and is ready to use. For everyday use afterwards, double-click the **「DeepSeek Harness 桌面版」** icon on your Desktop (or `bin\dsh-desktop.cmd`, or `/desktop` in the web UI).

> Already installed? Re-running this command is safe — registration is idempotent and the shortcut is refreshed. Moved the extraction? Re-run it once to rebuild the shortcut for the new location.

### Option 3: setup.exe installer (bundled backend, no environment needed)

1. Download `DeepSeek-Harness-Desktop-Setup-<version>.exe` from [GitHub Releases](https://github.com/Muelsysel/DeepSeek-Harness-Desktop/releases)
2. Run it (no admin required); the app launches automatically when the install finishes
3. **No Node.js / pnpm / DeepSeek Harness needed** — the backend and the Electron runtime are bundled; the first launch shows progress (built-in dependency init), then it opens instantly

Install location: `%LOCALAPPDATA%\Programs\DeepSeek-Harness-Desktop` (no spaces). **Launch entries**: Desktop shortcut (whale icon), Start Menu entry, and a `DeepSeek Harness Desktop.lnk` inside the install folder — any of the three works. Private data lives in `%APPDATA%\DeepSeek-Harness-Desktop` (your `$DSH_HOME` profiles are untouched); **closing the window exits the app**.

### Option 4: manual install into an existing dsh profile (advanced)

Prereq: Node.js ≥ 22.19 (**required**), pnpm (auto-installed during registration).

```bat
:: 1) install into the web profile (registers the plugin + creates the Desktop shortcut)
bin\install.cmd

:: 2) launch every time afterwards (equivalent to DSH_DESKTOP_LAUNCH=1 dsh web)
bin\dsh-desktop.cmd
```

What `bin\install.cmd` does:

1. Adds this plugin as a `link:` dependency of `$DSH_HOME\profiles\web` via pnpm
2. Appends `dsh-desktop` to the profile's `dsh.profile.bundles` (idempotent, with backup)
3. The bundle patch (`patch\desktop.bundle.yml`) inserts the `desktop` row; `autoOpen` is driven by `DSH_DESKTOP_LAUNCH`
4. Creates the Desktop shortcut "`DeepSeek Harness 桌面版`" (whale icon)

> You can skip `bin\install.cmd`: `bin\dsh-desktop.cmd` checks registration on first click (`install-profile.mjs --check`: 0 ready / 1 needs install / 2 profile not created yet) and registers once before booting (creating the minimal profile skeleton when needed) — but the Desktop shortcut still needs `bin\install.cmd` or `create-shortcut.cmd`.

Usage summary:

| Entry | Description |
|---|---|
| `cd /d "<extract-path>" && start.cmd` | **One command** (works from any directory; or just double-click root `start.cmd`): Node check → dsh check → register plugin → auto-create Desktop shortcut → launch window |
| `bin\install.cmd` (one-time) | Register the plugin + create the Desktop shortcut only (no window launch) |
| Desktop "DeepSeek Harness 桌面版" shortcut | Double-click to open the window (no console) |
| setup.exe installer | Bundled backend: no Node/pnpm/dsh needed, splash progress, instant after first init; three launch entries (Desktop / Start Menu / install folder) |
| `create-shortcut.cmd` (root) | Create/rebuild the desktop shortcut any time (correct for your extraction path) |
| `bin\dsh-desktop.cmd` | One-click launcher: `dsh web` + auto window (extra args allowed, e.g. `--port 3180`); auto-registers on first run |
| `/desktop` in the web UI | Open/reuse the desktop window for the current backend |
| `bin\uninstall.cmd` | Remove the plugin from the profile (package.json backed up) |

> Without `DSH_DESKTOP_LAUNCH`, plain `dsh web` keeps its browser-only behavior — no window pops up.
> Port: the launcher defaults to `--port 0` (OS-assigned, never collides with 3080); set `DSH_DESKTOP_PORT` to pin a port, or pass `--port 3180` directly.

## Configuration (plugin version)

Plugin config is overridden at the profile's patch layer (e.g. write a `desktop` row in `cordis.patch.yml`):

| Field | Default | Description |
|---|---|---|
| `autoOpen` | `false` | Auto-open the window at boot (the launcher sets it via env) |
| `title` | `DeepSeek Harness` | Window title |
| `width` / `height` | `1280` / `800` | Initial window size |
| `theme` | `default` | `default` = white/light look; `codex` = dark Codex skin |
| `electronArgs` | `[]` | Extra argv passed to Electron (e.g. `--no-sandbox`) |

Environment: `DSH_DESKTOP_LAUNCH=1` enables auto-open; `DSH_DESKTOP_TITLE` overrides the title; `DSH_DESKTOP_ELECTRON` pins the electron binary (fallback); `DSH_DESKTOP_DEBUG=1` writes a debug log to `%TEMP%\dsh-desktop-debug.log`.

## Building from source

```bat
:: Plugin zip (tsc build + offline zip: source + lib + node_modules, extract and run)
npm install
npm run build
node scripts\package.mjs        :: → dist\DeepSeek-harness-desktop-plugin-<version>.zip

:: setup.exe installer (NSIS: self-contained app — bundled dsh backend + Electron + splash,
:: no Node/pnpm/dsh on the target machine; downloads the NSIS compiler to tools\ on first build)
node scripts\make-setup.mjs     :: → dist\DeepSeek-Harness-Desktop-Setup-<version>.exe
```

Dev commands: `npm run build` / `npm run typecheck` / `npm test` (`node --test`).

## Project structure

```
src/           Plugin logic (Cordis plugin: /desktop command, auto-open, window manager)
desktop/       Electron shell (main.cjs / preload.cjs / codex.css skin / splash.html)
patch/         The bundle row inserted into the profile
bin/           One-click launch / install / uninstall scripts + official icon
apps/standalone/ Self-contained desktop app source (backend-owning main.cjs + bundled backend/, packaged into setup.exe)
scripts/       Install scripts, offline packaging (package.mjs), installer build (make-setup.mjs), shortcuts (make-shortcut.ps1)
setup/         NSIS installer script (desktop-setup.nsi)
DeepSeek Harness 桌面版.lnk  Root shortcut (script-free, send it to the desktop)
start.cmd      Root first-run wizard (zip entry point)
create-shortcut.cmd  Root one-shot desktop-shortcut creator
tools/         Local NSIS compiler (gitignored, auto-downloaded by the build)
docs/          ADR decision records + screenshot
```

## License

MIT
