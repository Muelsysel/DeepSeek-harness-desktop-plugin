# Acceptance — dsh-desktop

Process: the mattpocock flow (`grill-me` → `to-spec` → `tdd` → `code-review`), run autonomously — the user invoked the flow and left the implementation to this agent. Decisions are recorded in `docs/grill.md`; the contract in `docs/SPEC.md`.

## Automated checks

| Check | Result |
|---|---|
| `npm run build` (tsc) | pass |
| `npm run typecheck` | pass |
| `npm test` (node --test) | 30/30 pass (seams per SPEC) |

## Live verification (this machine, real dsh 0.1.0-rc.6)

1. **One-click launch** — `bin\dsh-desktop.cmd` boots `dsh web` and opens exactly one Electron window (title "DeepSeek Harness"); works via both the PATH `dsh` branch and the `npx` fallback branch.
2. **Codex skin** — CDP-verified in the live window: `body[data-ds-dark-theme]` set, `--dsw-alias-bg-base: #0d1117`, `--dsw-alias-brand-primary: #5498ff`, body background `rgb(13,17,23)`; preload bridge present (`window.dshDesktop.isDesktop`), real DSH boot present (`window.__DSH_BOOT__`).
3. **All features by construction** — the window loads the live `http://127.0.0.1:<webServer.port>` UI; nothing is re-implemented.
4. **Plain `dsh web` (no env)** — server up, **no** window (browser-first preserved).
5. **Graceful stop** — killing dsh tears the window down (Cordis effect disposer).
6. **Hard stop** — `taskkill /F` on the dsh process: the window self-quits via the `--parent-pid` orphan watchdog (verified).
7. **Port safety** — launcher defaults to `--port 0` (OS-assigned), never colliding with an existing 3080.
8. **Install/uninstall** — `scripts/install-profile.mjs` installs (`link:` + bundle append, package.json backed up) and removes (`--remove`) into `$DSH_HOME/profiles/web`; the real web profile is installed and verified.
9. **Auto-register on first launch** — `bin\dsh-desktop.cmd` checks registration via `scripts\install-profile.mjs --check` (exit 0 ready / 1 needs install / 2 profile not created) and registers once before booting when missing (pnpm `link:` + bundle append). Verified: `--check` exit codes unit-tested; the launcher flow exercised end-to-end against a throwaway `DSH_HOME` with a stub `dsh` on PATH — unregistered profile → auto-registered then booted; already-registered profile → fast path with no re-install; missing profile → the installer creates the minimal skeleton (bundles `dsh-base` + `dsh-web-app`) and registers, so a brand-new machine opens the window on the very first click.
10. **First-run wizard** — root `start.cmd` walks `[1/5]` Node check (≥ 22.19 hard-required, wizard blocks older) → `[2/5]` DeepSeek Harness check (run via `npx @deepseek-ai/dsh web`; the launcher auto-fetches when missing) → `[3/5]` register → `[4/5]` Desktop shortcut (skipped with `noshortcut`) → `[5/5]` launch. E2E-verified headlessly (stub `dsh`, temp `DSH_HOME`): steps print in order, registration completes, launch fires.
11. **Setup installer (NSIS)** — `setup\desktop-setup.nsi` + `scripts\make-setup.mjs` (compiler bundled under gitignored `tools/`). Silent-install round-trip verified on this machine: `/S /D=<temp>` installs the full tree (`bin/`, `scripts/`, `node_modules/electron`, `start.cmd`, whale `bin\dsh-desktop.ico`; payload expanded, `payload.zip` removed) in ~14 s, creates the Desktop shortcut (Chinese name, whale icon via `make-shortcut.ps1`), Start Menu entries and the `dev.dsh.desktop` uninstall entry; `/S` uninstall removes the tree, both shortcut sets and the registry entry (with `DSH_HOME` pointed at a temp dir so the real profile is untouched).
12. **Official icon everywhere** — window + taskbar icon set in the Electron shell (`desktop\main.cjs` BrowserWindow `icon` + `app.setAppUserModelId`); shortcut, Start Menu, installer and uninstaller all carry `bin\dsh-desktop.ico` (official DeepSeek whale). The cancelled standalone exe (ADR-0004) is no longer built or shipped.

## Standalone app (ADR-0004) — live verification (this machine, portable exe)

1. **Build** — `apps/standalone/scripts/build-backend.mjs` produces the bundled backend; `electron-builder --win portable` produces `dist/exe/DeepSeek-Harness-Desktop-0.1.0.exe` (~110 MB).
2. **First run** — the exe creates its private home under `%APPDATA%\DeepSeek-Harness-Desktop`, copies the bundled backend `node_modules` into `profiles/desktop` (one-time, ~25 s), boots `dsh web` on an OS-assigned port, and opens exactly one window; the backend URL is detected from the `dsh web: http://127.0.0.1:<port>` line (e.g. `http://127.0.0.1:60536`).
3. **Window content** — CDP-verified in the live window: dsh UI loaded (`window.__DSH_BOOT__` present, `document.title` "DeepSeek Harness", HTTP 200), dark theme + Codex tokens (`body[data-ds-dark-theme]`, `--dsw-alias-bg-base: #0d1117`, `--dsw-alias-brand-primary: #5498ff`, body background `rgb(13,17,23)`), preload bridge present (`window.dshDesktop.isDesktop`). Screenshot: `docs/screenshot.png`.
4. **Private home** — the standalone never touches `$DSH_HOME` profiles (runs under its own `%APPDATA%` home with `--port 0`).
5. **Close stops the backend** — closing the window terminates the backend child and exits the app; the port stops answering and no dsh process remains.
6. **Backend HMR compatibility** — the backend child runs under `ELECTRON_RUN_AS_NODE` with `--expose-internals` (the dsh CLI's loader needs Node internals for its HMR service; the `node-addon-require-builtin` fallback does not load in Electron-as-node, which first surfaced as `failed to apply loader entry … (cordis-plugin-hmr): --expose-internals is required for HMR service`).
7. **Startup splash** — a frameless 440×300 splash (`splash.html` + official icon) shows the boot pipeline and hands off to the main window once the UI is ready to show. CDP-verified live (this machine, unpacked build, `DSH_DESKTOP_DEBUG`): the splash target (`file://…/splash.html`) is present from launch; the main-window target (`http://127.0.0.1:<port>/`) appears at handoff; the debug log shows the full sequence `progress 30% 正在启动后端服务…` → animated 31–36% → `progress 80% 正在加载界面…` (the instant the `dsh web: http://127.0.0.1:61997` line lands) → `progress 100% 启动完成`. The first-run band (backend-dependency copy with per-file progress, 6–30%) was exercised on this machine too (profile + `node_modules` created at first run).

## Code review — two axes (per the code-review skill)

### Standards

Compliant: ESM `name`/`inject`/`Config`/`apply`; schemastery config; `ctx.effect` lifecycle with window teardown; command results `{kind:'success'|'error', text}`; port from `ctx.webServer.port`; tests use injected `spawn` only; Electron only resolved as a binary path.

Findings (all addressed in commit 84bb79d):
- adapter purity — diagnostics and manager construction moved into `src/desktop.ts`; `src/index.ts` is now a pure adapter; `Config extends WindowOptions` (single field source, divergent defaults reconciled).
- doc drift — `codex.css` and ADR-0003 now document the `executeJavaScript` `<style>` mechanism (and why `insertCSS` was abandoned).
- single owner of the bundle-list mutation — `--remove` mode in `install-profile.mjs`; `bin/uninstall.cmd` routes through it.
- origin-based (not prefix) navigation guard; parent-pid watchdog; Electron switches before app path; `test/helpers.mjs`; preload version dropped; unused `dsh-invariants` dep removed; dead `--dsh` param removed.

### Spec

Verdict: contract substantially met — every deliverable and all five spec seams are present and test-covered. Findings (all addressed):
- (a)1 hard-stop teardown gap → parent-pid orphan watchdog, verified live.
- (a)2/(c)2 insertCSS vs implementation drift → docs aligned with the actual mechanism.
- (c)1 prefix-based navigation guard → origin-based comparison.
- (c)3 config/shell size mismatch → shell clamps aligned with config floors.
- (c)4 hard-coded preload version → removed.
- (c)5 electronArgs after app path → now placed before the main script.
- (b) scope-creep items (debug env, `DSH_DESKTOP_TITLE`, `DSH_DESKTOP_PORT`/`--port 0`): retained deliberately as documented launcher conveniences (README); preload `version` dropped as speculative.

## Final state

- Plugin installed into the real `web` profile (`dsh.profile.bundles` includes `dsh-desktop`; `package.json.bak` backup exists).
- Main-UI screenshot: `docs/screenshot.png`.
- Distribution artifacts (gitignored `dist/`): `DeepSeek-harness-desktop-plugin-0.1.1.zip` (~149 MB offline plugin zip) and `DeepSeek-Harness-Desktop-Setup-0.1.1.exe` (~150 MB NSIS setup installer), both on the GitHub release `v0.1.1`. The standalone portable exe is cancelled (not shipped).
- Repo: commits `7b3d3dd`..`HEAD` on `master`.
