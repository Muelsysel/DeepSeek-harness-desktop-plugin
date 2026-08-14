# dsh-desktop Context

A DeepSeek Harness plugin that puts the dsh web UI in a Codex-like native window, launched with one click. Development paused at v0.1.3; `docs/spec-archive.md` records the state of play for resuming.

## Language

**Desktop window**:
The Electron BrowserWindow hosting the live dsh web UI over HTTP. Not a re-implementation — it loads the same UI a browser would.
_Avoid_: app, client, shell window

**Codex skin**:
The set of `--dsw-*` design-token overrides injected into the window so the UI reads like Codex. Light (white) by default; the GitHub-dark palette applies when the UI is in dark mode (`theme: codex` or the UI's own dark preference).
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
The self-contained installed app (`apps/standalone/`, packaged by `scripts/make-setup.mjs` into the NSIS setup installer) that bundles the dsh backend + Electron runtime and opens the same window over a private profile under `%APPDATA%\DeepSeek-Harness-Desktop`. It owns the backend lifecycle — closing the window stops it. No Node / pnpm / dsh is needed on the target machine. The plugin delivery (above) remains the integration surface for real profiles.
_Avoid_: standalone plugin, the exe, desktop app build

**Spec archive**:
`docs/spec-archive.md` — the state-of-play record written when development paused (v0.1.3): problem/solution, user stories, implementation and testing decisions, out-of-scope, and resume pointers. Read it (plus `CONTEXT.md` and the ADRs) to restart development quickly.
_Avoid_: the spec, SPEC.md (deleted), requirements doc

**Global skills**:
The mattpocock engineering skills installed at `~/.dsh/skills` (the `user-dsh` layer `dsh-skill-filesystem` scans by default) — available in every project; this repo keeps no local copies (`.agents/`, `.claude/`, `agent/` were removed after the global install).
_Avoid_: local skills, project skills, mattskills copies
