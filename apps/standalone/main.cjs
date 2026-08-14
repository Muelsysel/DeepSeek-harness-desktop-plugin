'use strict';

/**
 * DeepSeek Harness Desktop - standalone packaged app.
 *
 * A self-contained desktop build: it owns a private DSH home under
 * %APPDATA%\DeepSeek-Harness-Desktop, boots a web profile from the bundled
 * backend (the dsh CLI runs as a node child via ELECTRON_RUN_AS_NODE), and
 * opens one Codex-like BrowserWindow on the live UI. Closing the window
 * stops the backend and quits.
 */

const { app, BrowserWindow, shell, nativeTheme, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { spawn } = require('node:child_process');
const readline = require('node:readline');

const PRODUCT = 'DeepSeek Harness Desktop';
const PROFILE_NAME = 'desktop';
const BUNDLES = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'];

function dataDir() {
  return path.join(app.getPath('appData'), 'DeepSeek-Harness-Desktop');
}

/**
 * Where the bundled dsh backend lives.
 *
 * Two layouts are supported:
 *  - Installed app (setup): `backend/` sits next to this main.cjs.
 *  - Unpackaged dev (`electron .` from the standalone source dir):
 *    `process.resourcesPath` IS the app dir, so the backend sits directly
 *    under it. Prefer the installed layout, fall back to the dev path.
 */
function backendDir() {
  const beside = path.join(__dirname, 'backend');
  if (fs.existsSync(beside)) return beside;
  return path.join(process.resourcesPath, 'backend');
}

// Debug log: only written when DSH_DESKTOP_DEBUG is set. The packaged app has
// no console, so a file log is the only way to see what happened inside.
const DEBUG_LOG = process.env.DSH_DESKTOP_DEBUG
  ? path.join(app.getPath('temp'), 'dsh-desktop-standalone-debug.log')
  : null;
function log(msg) {
  console.log(`[${PRODUCT}] ${msg}`);
  if (!DEBUG_LOG) return;
  try {
    fs.appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    /* logging must never break the app */
  }
}

/** Count files under a directory (follows symlinked dirs once). */
async function countFiles(dir) {
  let n = 0;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) n += await countFiles(path.join(dir, e.name));
    else if (e.isSymbolicLink()) {
      try {
        const target = await fsp.realpath(path.join(dir, e.name));
        n += (await fsp.stat(target)).isDirectory() ? await countFiles(target) : 1;
      } catch {
        /* dangling link: count nothing */
      }
    } else n += 1;
  }
  return n;
}

/**
 * Copy a tree reporting per-file progress. Symlinks are dereferenced (a
 * junction to the portable temp extraction must never be copied verbatim —
 * it would dangle on the next run).
 */
async function copyDirWithProgress(src, dest, onProgress) {
  const total = Math.max(1, await countFiles(src));
  let done = 0;
  async function walk(s, d) {
    await fsp.mkdir(d, { recursive: true });
    const entries = await fsp.readdir(s, { withFileTypes: true });
    for (const e of entries) {
      const sp = path.join(s, e.name);
      const dp = path.join(d, e.name);
      if (e.isDirectory()) {
        await walk(sp, dp);
      } else if (e.isSymbolicLink()) {
        try {
          const target = await fsp.realpath(sp);
          const st = await fsp.stat(target);
          if (st.isDirectory()) await walk(target, dp);
          else {
            await fsp.copyFile(target, dp);
            done += 1;
            onProgress(done, total);
          }
        } catch {
          /* unreadable link: skip */
        }
      } else {
        await fsp.copyFile(sp, dp);
        done += 1;
        onProgress(done, total);
      }
    }
  }
  await walk(src, dest);
}

/** Ensure the private profile exists; returns the DSH home dir. */
async function ensureProfile(onProgress) {
  const home = dataDir();
  const profileDir = path.join(home, 'profiles', PROFILE_NAME);
  await fsp.mkdir(profileDir, { recursive: true });

  const pkgPath = path.join(profileDir, 'package.json');
  await fsp.writeFile(
    pkgPath,
    JSON.stringify(
      {
        name: `dsh-profile-${PROFILE_NAME}`,
        private: true,
        dependencies: {},
        dsh: { profile: { bundles: BUNDLES } },
      },
      null,
      2,
    ) + '\n',
  );
  await fsp.writeFile(path.join(profileDir, 'cordis.yml'), '[]\n');
  const patchPath = path.join(profileDir, 'cordis.patch.yml');
  if (!fs.existsSync(patchPath)) await fsp.writeFile(patchPath, '[]\n');

  // The profile's deps: the packaged backend ships a full node_modules.
  // First run copies it in (a junction to the portable temp resources is not
  // durable across extractions).
  const nm = path.join(profileDir, 'node_modules');
  const src = path.join(backendDir(), 'node_modules');
  if (!fs.existsSync(nm)) {
    log('first run: installing backend dependencies (one-time) ...');
    let lastTick = 0;
    await copyDirWithProgress(src, nm, (done, total) => {
      // Throttle: the splash update is a DOM round-trip, not per-file.
      const now = Date.now();
      if (now - lastTick < 50 && done !== total) return;
      lastTick = now;
      onProgress(done, total);
    });
    log('backend dependencies ready');
  }
  return home;
}

/** Spawn the dsh backend; resolves with its web URL. */
function startBackend(home, profileDir, onExit) {
  const bin = path.join(backendDir(), 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
  const child = spawn(
    process.execPath,
    [
      // The dsh CLI's loader mounts an HMR service that needs Node internals.
      // With plain node it falls back to the node-addon-require-builtin native
      // addon, but that addon does not load under ELECTRON_RUN_AS_NODE — so
      // pass the flag the CLI itself asks for (see its error message).
      '--expose-internals',
      bin,
      '--profile',
      PROFILE_NAME,
      '--port',
      '0',
    ],
    {
      cwd: profileDir,
      env: { ...process.env, DSH_HOME: home, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  backendChild = child;

  child.once('exit', (code, signal) => {
    log(`backend exited (code=${code} signal=${signal})`);
    if (backendChild === child) backendChild = null;
    onExit(code, signal);
  });

  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      log(`backend: ${line}`);
      // The web app prints `dsh web: http://127.0.0.1:<port>` once its server
      // is bound. Prefer that exact line; fall back to any loopback URL in
      // case the banner wording changes.
      const match =
        /dsh web:\s+http:\/\/127\.0\.0\.1:(\d+)/.exec(line) ??
        /http:\/\/127\.0\.0\.1:(\d+)/.exec(line);
      if (match) resolve(`http://127.0.0.1:${match[1]}`);
    });
    child.once('error', (error) => reject(error));
    // safety: if the server never reports a URL, fail after a while
    setTimeout(() => reject(new Error('backend did not report a URL in time')), 60000).unref();
  });
}

function createWindow(url) {
  const win = new BrowserWindow({
    title: PRODUCT,
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => {
    handedOff = true;
    setProgress(100, '启动完成');
    win.show();
    setTimeout(closeSplash, 300);
  });
  nativeTheme.themeSource = 'light';

  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, target) => {
    try {
      if (new URL(target).origin !== new URL(url).origin) {
        event.preventDefault();
        shell.openExternal(target);
      }
    } catch {
      event.preventDefault();
    }
  });

  const cssPath = path.join(__dirname, 'codex.css');
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf8');
    const applySkin = () => {
      win.webContents
        .executeJavaScript(
          `(() => {
            const id = "dsh-desktop-codex-skin";
            if (document.getElementById(id)) return { applied: true };
            const style = document.createElement("style");
            style.id = id;
            style.textContent = ${JSON.stringify(css)};
            (document.head ?? document.documentElement).appendChild(style);
            return { applied: true };
          })()`,
          true,
        )
        .catch(() => {});
    };
    win.webContents.on('did-finish-load', applySkin);
    win.webContents.on('did-navigate', applySkin);
  }

  const loadWithRetry = (attemptsLeft) => {
    if (win.isDestroyed()) return;
    win
      .loadURL(url)
      .then(() => win.webContents.focus())
      .catch(() => {
        if (attemptsLeft > 0) setTimeout(() => loadWithRetry(attemptsLeft - 1), 1000);
      });
  };
  loadWithRetry(90);
  return win;
}

let backendChild = null;
let quitting = false;
let handedOff = false;

// ---------------------------------------------------------------------------
// Startup splash: a small frameless window shown immediately, so the user sees
// progress (bar + percent + status) while the profile and backend boot. The
// main window takes over once the UI is ready to show.
// ---------------------------------------------------------------------------
let splash = null;
let splashReady = null;

function createSplash() {
  splash = new BrowserWindow({
    width: 440,
    height: 300,
    frame: false,
    resizable: false,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  splashReady = new Promise((resolve) => {
    splash.webContents.once('did-finish-load', resolve);
  });
  splash.loadFile(path.join(__dirname, 'splash.html')).catch(() => {});
  splash.once('ready-to-show', () => splash.show());
  splash.on('closed', () => {
    // User closed the splash before the main window took over: cancel.
    if (!handedOff && !quitting) {
      quitting = true;
      stopBackend();
      app.quit();
    }
    splash = null;
  });
  return splashReady;
}

function setProgress(percent, status) {
  if (splash && !splash.isDestroyed()) {
    splash.webContents
      .executeJavaScript(
        `updateProgress(${Math.round(percent)}, ${JSON.stringify(status)})`,
        true,
      )
      .catch(() => {});
  }
  log(`progress ${Math.round(percent)}% ${status}`);
}

function closeSplash() {
  if (splash && !splash.isDestroyed()) splash.destroy();
  splash = null;
}

function stopBackend() {
  const child = backendChild;
  if (child && child.exitCode === null && !child.killed) {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  }
}

// Verification hook: with DSH_DESKTOP_DEBUG_PORT set, expose the window to
// Chrome DevTools Protocol so an external checker can inspect the live UI
// (the plugin shell does the same via its electronArgs config).
if (process.env.DSH_DESKTOP_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.DSH_DESKTOP_DEBUG_PORT);
}

app.whenReady().then(async () => {
  try {
    await createSplash();
    setProgress(4, '正在准备运行环境…');

    const home = await ensureProfile((done, total) => {
      const pct = 6 + 24 * (done / total);
      setProgress(pct, `正在安装后端依赖 ${Math.round(pct)}%…`);
    });
    const profileDir = path.join(home, 'profiles', PROFILE_NAME);
    log(`profile: ${profileDir}`);

    setProgress(30, '正在启动后端服务…');
    // Backend boot time is unpredictable: animate within the boot band while
    // waiting for the URL line, then jump to the handoff phase.
    let bootPct = 30;
    const bootTimer = setInterval(() => {
      bootPct = Math.min(bootPct + 0.8, 75);
      setProgress(bootPct, '正在启动后端服务…');
    }, 200);

    const url = await startBackend(home, profileDir, (code, signal) => {
      if (quitting) return;
      // Unexpected backend death: tell the user and quit.
      closeSplash();
      dialog.showErrorBox(
        PRODUCT,
        `The harness backend stopped unexpectedly (code ${code}, signal ${signal}).`,
      );
      app.quit();
    }).catch(async (error) => {
      clearInterval(bootTimer);
      closeSplash();
      dialog.showErrorBox(PRODUCT, `Failed to start the harness backend: ${error.message}`);
      app.exit(1);
    });
    if (!url) return;
    clearInterval(bootTimer);

    setProgress(80, '正在加载界面…');
    const win = createWindow(url);
    win.on('closed', () => {
      log('window closed; stopping backend');
      quitting = true;
      stopBackend();
      app.quit();
    });
  } catch (error) {
    closeSplash();
    dialog.showErrorBox(PRODUCT, `Startup failed: ${error.message}`);
    app.exit(1);
  }
});

app.on('window-all-closed', () => {
  quitting = true;
  stopBackend();
  app.quit();
});

app.on('will-quit', () => {
  quitting = true;
  stopBackend();
});
