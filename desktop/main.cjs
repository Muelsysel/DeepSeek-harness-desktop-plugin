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
    parentPid: 0,
    splash: false,
  };
  for (const arg of argv) {
    const match = /^--([a-z][a-z0-9-]*)(?:=(.*))?$/i.exec(arg);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2] ?? '';
    if (key === 'url') out.url = value;
    else if (key === 'splash') out.splash = true;
    else if (key === 'title') out.title = value;
    else if (key === 'theme') out.theme = value === 'default' ? 'default' : 'codex';
    else if (key === 'parent-pid') out.parentPid = Number(value) || 0;
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
const isSplash = opts.splash;
if (!isSplash && !opts.url) {
  console.error('dsh-desktop: --url is required');
  app.exit(1);
}

// Official DeepSeek whale icon for the window title bar and the taskbar
// button (the spawned electron.exe itself ships the generic Electron icon).
// The package ships bin/dsh-desktop.ico; fall back gracefully when absent.
const WINDOW_ICON = path.join(__dirname, '..', 'bin', 'dsh-desktop.ico');
app.setAppUserModelId('dev.dsh.desktop');

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
// the single-instance lock or shared local storage. The splash helper gets
// its own so it can run alongside the real window.
if (isSplash) {
  app.setPath('userData', path.join(app.getPath('appData'), 'dsh-desktop', 'splash'));
} else {
  let port = '0';
  try {
    port = new URL(opts.url).port || '0';
  } catch {
    /* keep the fallback port key */
  }
  app.setPath('userData', path.join(app.getPath('appData'), 'dsh-desktop', `instance-${port}`));
}

if (opts.theme === 'codex') {
  nativeTheme.themeSource = 'dark';
}

// ---------------------------------------------------------------------------
// Startup splash (--splash): a small frameless window shown by the launcher
// immediately, so first launches never sit silent (npx download on first
// run, backend boot, UI load). The launcher and the real window write phase
// tokens to a shared status file; the splash maps them to text and closes
// when the main window reports "ready".
// ---------------------------------------------------------------------------
const SPLASH_STATUS_FILE = path.join(app.getPath('temp'), 'dsh-desktop-splash.status');
const SPLASH_PHASES = {
  download: '正在下载 DeepSeek Harness…(首次运行,需要几分钟)',
  boot: '正在启动后端服务…',
  loading: '正在加载界面…',
};

function writeSplashStatus(token) {
  try {
    fs.writeFileSync(SPLASH_STATUS_FILE, token, 'utf8');
  } catch {
    /* the splash must never break the real window */
  }
}

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 440,
    height: 300,
    frame: false,
    resizable: false,
    show: false,
    icon: fs.existsSync(WINDOW_ICON) ? WINDOW_ICON : undefined,
    backgroundColor: '#0d1117',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  splash.loadFile(path.join(__dirname, 'splash.html')).catch(() => {});
  splash.once('ready-to-show', () => splash.show());
  splash.on('closed', () => app.quit());

  const applyStatus = (text) => {
    if (splash.isDestroyed()) return;
    splash.webContents
      .executeJavaScript(`updateStatus(${JSON.stringify(text)})`, true)
      .catch(() => {});
  };

  let last = '';
  const startedAt = Date.now();
  const timer = setInterval(() => {
    if (splash.isDestroyed()) {
      clearInterval(timer);
      return;
    }
    // Safety: a boot that never reports ready must not leave a stuck window.
    if (Date.now() - startedAt > 10 * 60 * 1000) {
      clearInterval(timer);
      app.quit();
      return;
    }
    let token = '';
    try {
      token = fs.readFileSync(SPLASH_STATUS_FILE, 'utf8').trim();
    } catch {
      /* status file not written yet - show the default */
    }
    if (token === 'ready') {
      clearInterval(timer);
      try {
        fs.unlinkSync(SPLASH_STATUS_FILE);
      } catch {
        /* ignore */
      }
      splash.destroy();
      app.quit();
      return;
    }
    const text = SPLASH_PHASES[token] ?? '正在启动…';
    if (text !== last) {
      last = text;
      applyStatus(text);
    }
  }, 400);
}

// Orphan watchdog: if the spawning dsh process dies hard (taskkill, crash),
// the plugin's teardown never runs, so the shell watches the parent pid and
// quits itself. process.kill(pid, 0) only probes existence. Not needed for
// the splash helper.
if (!isSplash && opts.parentPid > 0) {
  const watchdog = setInterval(() => {
    try {
      process.kill(opts.parentPid, 0);
    } catch {
      app.quit();
    }
  }, 2000);
  app.on('will-quit', () => clearInterval(watchdog));
}

if (isSplash) {
  app.whenReady().then(() => createSplashWindow());
  app.on('window-all-closed', () => app.quit());
} else {
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
      writeSplashStatus('loading');
      createWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    });

    app.on('window-all-closed', () => app.quit());
  }
}

let win = null;

function createWindow() {
  const isCodex = opts.theme === 'codex';
  win = new BrowserWindow({
    title: opts.title,
    icon: fs.existsSync(WINDOW_ICON) ? WINDOW_ICON : undefined,
    width: opts.width,
    height: opts.height,
    minWidth: 320,
    minHeight: 240,
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

  win.once('ready-to-show', () => {
    writeSplashStatus('ready'); // hand off: the launcher splash closes on this
    win.show();
  });

  // Anything the UI tries to open in a new window goes to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Stay inside the dsh UI; navigation to any other origin opens the system
  // browser. Origin comparison, not prefix matching: `127.0.0.1:3080.evil.com`
  // and `:30800` must NOT load inside the window.
  win.webContents.on('will-navigate', (event, target) => {
    try {
      const base = new URL(opts.url);
      const next = new URL(target);
      if (next.origin !== base.origin) {
        event.preventDefault();
        shell.openExternal(target);
      }
    } catch {
      event.preventDefault();
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
