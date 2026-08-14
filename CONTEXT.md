# dsh-desktop Context

A DeepSeek Harness plugin that puts the dsh web UI in a Codex-like native window, launched with one click.

## Language

**Desktop window**:
The Electron BrowserWindow hosting the live dsh web UI over HTTP. Not a re-implementation — it loads the same UI a browser would.
_Avoid_: app, client, shell window

**Codex skin**:
The set of `--dsw-*` design-token overrides injected into the window so the UI reads like Codex (GitHub-dark palette, blue accent).
_Avoid_: theme, dark mode, reskin

**Bundle row**:
A config row a bundle patch inserts into a profile's plugin tree. The desktop plugin is mounted as the `desktop` bundle row.
_Avoid_: plugin entry, config entry

**Human command**:
A `/slash` command registered on the harness command registry, dispatched without a model turn. The plugin registers `/desktop`.
_Avoid_: slash command, command, action

**Auto-open**:
Opening the desktop window at boot instead of on command. Driven by the `DSH_DESKTOP_LAUNCH` environment flag so a plain `dsh web` keeps browser-first behavior.
_Avoid_: auto-launch, launch on start

**Launcher**:
`bin/dsh-desktop.cmd` — the one-click entry that boots the web profile with auto-open armed.
_Avoid_: shortcut, start script

**Window manager**:
The single-instance tracker for the spawned Electron child: at most one live window per backend, reused across opens.
_Avoid_: window controller, spawner

**Standalone app**:
The self-contained portable exe (`apps/standalone/` + electron-builder) that bundles the dsh backend and opens the same window over a private profile under `%APPDATA%\DeepSeek-Harness-Desktop`. It owns the backend lifecycle — closing the window stops it. The plugin delivery (above) remains the integration surface for real profiles.
_Avoid_: standalone plugin, the exe, desktop app build
