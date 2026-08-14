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
 * Packaged layout (electron-builder, asar: false): the app files — including
 * `backend/` — are copied to `resources/app/`, so the backend is at
 * `resources/app/backend`. When run unpackaged (`electron .` from the
 * standalone source dir) `process.resourcesPath` IS the app dir, so the
 * backend sits directly under it. Prefer the packaged path, fall back to the
 * dev path.
 */
function backendDir() {
  const packaged = path.join(process.resourcesPath, 'app', 'backend');
  if (fs.existsSync(packaged)) return packaged;
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

/** Ensure the private profile exists; returns the DSH home dir. */
async function ensureProfile() {
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
    await fsp.cp(src, nm, { recursive: true, errorOnExist: false });
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
    backgroundColor: '#0d1117',
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
  win.once('ready-to-show', () => win.show());
  nativeTheme.themeSource = 'dark';

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
    const home = await ensureProfile();
    const profileDir = path.join(home, 'profiles', PROFILE_NAME);
    log(`profile: ${profileDir}`);

    const url = await startBackend(home, profileDir, (code, signal) => {
      if (quitting) return;
      // Unexpected backend death: tell the user and quit.
      dialog.showErrorBox(
        PRODUCT,
        `The harness backend stopped unexpectedly (code ${code}, signal ${signal}).`,
      );
      app.quit();
    }).catch(async (error) => {
      dialog.showErrorBox(PRODUCT, `Failed to start the harness backend: ${error.message}`);
      app.exit(1);
    });
    if (!url) return;

    const win = createWindow(url);
    win.on('closed', () => {
      log('window closed; stopping backend');
      quitting = true;
      stopBackend();
      app.quit();
    });
  } catch (error) {
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
