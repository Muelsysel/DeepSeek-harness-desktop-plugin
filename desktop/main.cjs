'use strict';

/**
 * dsh-desktop Electron main.
 *
 * Spawned by the dsh-desktop plugin as:
 *   electron.exe main.cjs --url=http://127.0.0.1:<port> [--title=...] [--theme=codex] [--size=WxH]
 *
 * It opens one BrowserWindow hosting the live dsh web UI, applies the
 * Codex-like skin when asked, keeps external links in the system browser, and
 * retries the load until the backend answers (the window often boots before
 * the server has finished binding its routes).
 */

const { app, BrowserWindow, shell, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

/** Parse `--key=value` argv into a plain options object. */
function parseArgs(argv) {
  const out = {
    url: undefined,
    title: 'DeepSeek Harness',
    theme: 'codex',
    width: 1280,
    height: 800,
  };
  for (const arg of argv) {
    const match = /^--([a-z][a-z0-9-]*)=(.*)$/i.exec(arg);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2];
    if (key === 'url') out.url = value;
    else if (key === 'title') out.title = value;
    else if (key === 'theme') out.theme = value === 'default' ? 'default' : 'codex';
    else if (key === 'size') {
      const size = /^(\d+)x(\d+)$/.exec(value);
      if (size) {
        out.width = Number(size[1]);
        out.height = Number(size[2]);
      }
    }
  }
  return out;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.url) {
  console.error('dsh-desktop: --url is required');
  app.exit(1);
}

// Debug log: only written when DSH_DESKTOP_DEBUG is set. stdio of a
// plugin-spawned window is /dev/null, so file logging is the only way to
// see what happened inside the shell.
const DEBUG_LOG = process.env.DSH_DESKTOP_DEBUG
  ? path.join(app.getPath('temp'), 'dsh-desktop-debug.log')
  : null;
function log(msg) {
  if (!DEBUG_LOG) return;
  try {
    fs.appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    /* logging must never break the window */
  }
}
log(`main started argv=${JSON.stringify(process.argv.slice(2))} theme=${opts.theme}`);

// One userData dir per backend port, so two dsh instances never fight over
// the single-instance lock or shared local storage.
let port = '0';
try {
  port = new URL(opts.url).port || '0';
} catch {
  /* keep the fallback port key */
}
app.setPath('userData', path.join(app.getPath('appData'), 'dsh-desktop', `instance-${port}`));

if (opts.theme === 'codex') {
  nativeTheme.themeSource = 'dark';
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Another window for this backend is already up — ask it to focus.
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => app.quit());
}

let win = null;

function createWindow() {
  const isCodex = opts.theme === 'codex';
  win = new BrowserWindow({
    title: opts.title,
    width: opts.width,
    height: opts.height,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: isCodex ? '#0d1117' : '#ffffff',
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

  // Anything the UI tries to open in a new window goes to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Stay inside the dsh UI; navigation away opens the system browser.
  win.webContents.on('will-navigate', (event, target) => {
    if (target !== opts.url && !target.startsWith(opts.url)) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });

  if (isCodex) {
    const cssPath = path.join(__dirname, 'codex.css');
    if (fs.existsSync(cssPath)) {
      const css = fs.readFileSync(cssPath, 'utf8');
      // Inject by appending a <style> tag and re-apply on every committed
      // navigation, so the skin survives the boot race (error page first,
      // real page after retry) and any later reload. executeJavaScript binds
      // to the document that is current at each event.
      const applySkin = () => {
        log('applySkin fired');
        win.webContents
          .executeJavaScript(`(() => {
            const id = "dsh-desktop-codex-skin";
            if (document.getElementById(id)) return { applied: true, already: true };
            const style = document.createElement("style");
            style.id = id;
            style.textContent = ${JSON.stringify(css)};
            (document.head ?? document.documentElement).appendChild(style);
            return { applied: true, hasHead: !!document.head };
          })()`, true)
          .then((result) => log(`applySkin result=${JSON.stringify(result)}`))
          .catch((error) => log(`applySkin error=${error && error.message}`));
      };
      win.webContents.on('did-finish-load', () => { log('event did-finish-load'); applySkin(); });
      win.webContents.on('did-navigate', (event, target) => { log(`event did-navigate ${target}`); applySkin(); });
    } else {
      console.error('[dsh-desktop] codex.css not found next to main.cjs');
    }
  }

  loadWithRetry(opts.url, 90);

  win.on('closed', () => {
    win = null;
  });
}

/** Load the URL, retrying while the backend is still coming up. */
function loadWithRetry(url, attemptsLeft) {
  if (!win || win.isDestroyed()) return;
  win
    .loadURL(url)
    .then(() => {
      win.webContents.focus();
    })
    .catch(() => {
      if (attemptsLeft > 0) {
        setTimeout(() => loadWithRetry(url, attemptsLeft - 1), 1000);
      }
    });
}
