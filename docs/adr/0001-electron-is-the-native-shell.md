# 0001 — Electron is the native shell

The desktop window is an Electron `BrowserWindow` spawned by the plugin, because dsh's plugin tree runs only on Node and the web UI is only served over HTTP; Electron is the smallest native shell that hosts a Chromium view of that HTTP UI with zero toolchain dependencies.

## Considered Options

- **Wails v3 + Node SEA** (the omdsh-dev/deepseek-harness-desktop approach): native but requires Go toolchains and a full SEA packaging pipeline — out of scope for a plugin that must install with one command.
- **System-browser app mode** (`msedge --app=`): zero install, but depends on the user's browser and gives no CSS injection or window control.
- **webview bindings**: native module builds (node-gyp) are fragile across platforms.

## Consequences

Electron ships a full Chromium (~100 MB install). The window inherits the running profile's features by loading its live URL — nothing is re-implemented.
