# AGENTS.md

dsh-desktop is a DeepSeek Harness plugin: an Electron shell around the live dsh web UI. Read `CONTEXT.md` for vocabulary before touching behavior. Development is paused at v0.1.3 — `docs/spec-archive.md` is the state-of-play archive for resuming; architecture decisions live in `docs/adr/0001..0004`.

## Layout

- `src/index.ts` — the plugin surface (`name`/`inject`/`Config`/`apply`); thin glue only.
- `src/desktop.ts` — all real logic (`WindowManager`, `mountDesktop`, URL/argv/electron resolution). This is where behavior lives and where tests point.
- `desktop/main.cjs`, `desktop/preload.cjs`, `desktop/codex.css` — the Electron shell; plain CJS on purpose (the package is ESM).
- `patch/desktop.bundle.yml` — the bundle row that mounts the plugin into a profile.
- `scripts/install-profile.mjs`, `bin/*.cmd`, `start.cmd`, `create-shortcut.cmd` — install/launch/uninstall/shortcut helpers.
- `apps/standalone/` — the self-contained packaged app (ADR-0004): own `main.cjs` (backend-owning fork of the shell), bundled `backend/` (built by `scripts/build-backend.mjs`), shared `preload.cjs` + `codex.css`. `scripts/make-setup.mjs` assembles it into the NSIS setup installer → `dist/DeepSeek-Harness-Desktop-Setup-<ver>.exe`.
- `scripts/package.mjs` — offline plugin zip (source + built lib + node_modules) → `dist/DeepSeek-harness-desktop-plugin-<ver>.zip`. `dist/` is gitignored build output.
- `test/*.test.mjs` — `node --test` suites at the logic seams in `src/desktop.ts`.

## Commands

- `npm run build` — tsc to `lib/`. Always run before tests or installs.
- `npm test` — `node --test` (auto-discovers `test/`).
- `npm run typecheck` — tsc `--noEmit`.
- `node scripts/install-profile.mjs --profile web` — install into the web profile.

## Rules

- Keep `src/index.ts` a pure adapter: no logic that isn't a one-line call into `src/desktop.ts`.
- Never import `electron` at plugin runtime — only resolve its binary path and spawn it. The window must die with the profile, never hold it open.
- Test through `WindowManager`'s injected `spawn` — never spawn real Electron in unit tests.
- The web profile's port is `ctx.webServer.port` (may be OS-assigned); never hard-code 3080 in code.
- Every behavior change updates the seams under test; a changed hard-to-reverse decision gets an ADR.
- Work in the mattpocock flow: grilling → spec → tickets → tdd → code-review.

## Skills

The mattpocock engineering skills are installed **globally** at `~/.dsh/skills` (the `user-dsh` layer `dsh-skill-filesystem` scans by default) — there are no project-local copies in this repo. They are available in every project, this one included. Re-run the installer only if the global install is lost.
