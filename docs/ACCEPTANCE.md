# Acceptance — dsh-desktop

Process: the mattpocock flow (`grill-me` → `to-spec` → `tdd` → `code-review`), run autonomously — the user invoked the flow and left the implementation to this agent. Decisions are recorded in `docs/grill.md`; the contract in `docs/SPEC.md`.

## Automated checks

| Check | Result |
|---|---|
| `npm run build` (tsc) | pass |
| `npm run typecheck` | pass |
| `npm test` (node --test) | 22/22 pass (seams per SPEC) |

## Live verification (this machine, real dsh 0.1.0-rc.6)

1. **One-click launch** — `bin\dsh-desktop.cmd` boots `dsh web` and opens exactly one Electron window (title "DeepSeek Harness"); works via both the PATH `dsh` branch and the `npx` fallback branch.
2. **Codex skin** — CDP-verified in the live window: `body[data-ds-dark-theme]` set, `--dsw-alias-bg-base: #0d1117`, `--dsw-alias-brand-primary: #5498ff`, body background `rgb(13,17,23)`; preload bridge present (`window.dshDesktop.isDesktop`), real DSH boot present (`window.__DSH_BOOT__`).
3. **All features by construction** — the window loads the live `http://127.0.0.1:<webServer.port>` UI; nothing is re-implemented.
4. **Plain `dsh web` (no env)** — server up, **no** window (browser-first preserved).
5. **Graceful stop** — killing dsh tears the window down (Cordis effect disposer).
6. **Hard stop** — `taskkill /F` on the dsh process: the window self-quits via the `--parent-pid` orphan watchdog (verified).
7. **Port safety** — launcher defaults to `--port 0` (OS-assigned), never colliding with an existing 3080.
8. **Install/uninstall** — `scripts/install-profile.mjs` installs (`link:` + bundle append, package.json backed up) and removes (`--remove`) into `$DSH_HOME/profiles/web`; the real web profile is installed and verified.

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
- Screenshot of the running window: `scratch/window-shot.png`.
- Repo: commits `7b3d3dd`, `f2b8b2c`, `84bb79d` on `master`.
