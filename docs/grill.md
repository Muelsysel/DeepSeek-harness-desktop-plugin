# Grill log — dsh-desktop

The user invoked the mattpocock grilling flow ("grill me 那一套 skill") and then left: *"我要去休息了… 这是我唯一一次和你的对话… 实现方式由你决定"*. This log records the grilling session run in their place — the design tree, round by round, with every decision answered from research instead of silently assumed. Each answer cites the evidence it was grounded on; a later agent or the user can dispute any of them.

The front door: `/grill-me` on the goal "a desktop plugin for DeepSeek Harness: click to open a Codex-like window that can do everything the harness can".

## Round 1 — frontier (nothing settled yet)

**Q1. What is the deliverable shape?** A desktop *plugin* in the DSH sense is a Cordis plugin package mounted into a profile; "click to launch a window" then means: boot the web profile → a native window opens (or `/desktop` opens it).
➡️ Host-side Cordis plugin shipped as a bundle (`dsh.bundle`), installed with `dsh plugin add` / one installer script. *Evidence: architecture doc — "every part of the product is a plugin… you extend dsh by mounting a plugin beside the others"; profile/bundle mechanics in app-boot.*

**Q2. Which profile must it mount into?** The window hosts the *web UI*, which only the web profile serves.
➡️ The web profile only. The plugin injects the `webServer` service, so mounting elsewhere fails loudly — a documented contract. *Evidence: `dsh-web-app` composition; `webServer` row is web-only.*

**Q3. What does "界面类似codex" (Codex-like UI) mean concretely?** Codex's look is: dark GitHub-ish palette, blue accent, sidebar + composer layout. The dsh web UI already has the layout; the gap is palette and chrome.
➡️ A Codex skin = design-token overrides (`--dsw-alias-*` under `body[data-ds-dark-theme]`) + dark native theme. Not a UI fork. *Evidence: frontend bundle exposes 351 `--dsw-*` tokens; theme boots via `data-ds-dark-theme`.*

**Q4. What does "能够实现目前的所有功能" (all current features) require?** Reimplementing every feature is absurd; the window must host the real running profile.
➡️ The window loads the live `http://127.0.0.1:<port>` UI — all features by construction. *Evidence: `webServer.port` service; `localWebUrl` in dsh-web-app.*

**Q5. Native window technology?** dsh is Node-only; the UI is served over HTTP; the shell must add a window.
➡️ Electron: pure-JS shell, no toolchain, works on this Windows host, supports CSS injection. *Evidence: ADR-0001 (alternatives: Wails+SEA needs Go; Edge app-mode is the user's browser; webview bindings are fragile native builds).*

**Q6. How does the user "click to launch"?** One-click should not require typing commands.
➡️ A launcher `.cmd` that boots `dsh web` with auto-open armed (`DSH_DESKTOP_LAUNCH=1`), plus the `/desktop` human command in the UI. *Evidence: commands registry is surfaced by `ui-commands` in the web UI.*

## Round 2 — frontier after Round 1

**Q7. Should the window auto-open on every `dsh web`?** No — plain browser use must stay browser-first.
➡️ Auto-open is opt-in via the launcher's env flag; `dsh web` alone opens nothing. *Evidence: bundle patch reads `process.env.DSH_DESKTOP_LAUNCH === '1'`.*

**Q8. Where does Electron live?** A plugin that spawns Electron needs the binary resolvable from the profile's node_modules.
➡️ `electron` is a dependency of the plugin package; `require('electron')` from the plugin returns the binary path; `DSH_DESKTOP_ELECTRON` overrides for resilience. *Evidence: npm `electron` returns the exe path when required from plain Node.*

**Q9. Port conflict: the harness GUI already occupies 3080 here.** The window must follow the real port.
➡️ The plugin reads `ctx.webServer.port` (OS-assigned when `--port 0`) and passes it as `--url`; the Electron main retries loading until the backend answers. *Evidence: `webServer.port` is the listened port.*

**Q10. Single window per backend?** Spawning one window per `/desktop` click would stack windows.
➡️ One window per backend: the plugin tracks the live child; Electron's single-instance lock is keyed per-port userData so multiple dsh instances still each get one window. *Evidence: `requestSingleInstanceLock` + `app.setPath('userData', …instance-<port>)`.*

**Q11. How is it tested and accepted?** The mattpocock flow demands tests and review, not just code.
➡️ Unit tests at the logic seams (URL/args/electron resolution/window manager/command mount) via `node --test`; then a live boot of a scratch web profile with the plugin mounted, verifying the window opens and the UI serves; then the code-review skill's two-axis review. *Evidence: tdd and code-review skills.*

## Frontier empty — session over

No question remains whose prerequisites are settled but unanswered. Decisions are recorded in `docs/adr/0001..0003`, the vocabulary in `CONTEXT.md`, and the agreed scope in `docs/SPEC.md`.
