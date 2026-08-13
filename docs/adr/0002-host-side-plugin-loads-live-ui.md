# 0002 — Host-side plugin; the window loads the live web UI

The plugin is a host-side Cordis plugin mounted as a bundle row in the web profile. It spawns the window at `http://127.0.0.1:<webServer.port>` — the URL of the running profile itself — so "all current features" is satisfied by construction, not by reimplementation.

## Considered Options

- **Client-side plugin (button in the UI)**: would need the client build pipeline (tsdown, `DSH_BUILD_FACE`) and still must reach the host to spawn anything — higher cost, no functional gain over the `/desktop` human command the host row registers.
- **file:// + IPC bridge**: the web-server source mentions an Electron file:// shape, but it is not shipped in the npm release; loading over HTTP is the documented, working path.

## Consequences

The plugin is web-profile-only (it injects the `webServer` service). Mounting it in a non-web profile fails loudly at load, which is the intended contract.
