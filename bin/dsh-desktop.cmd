@echo off
rem =====================================================================
rem  dsh-desktop - one-click launcher (desktop app mode).
rem
rem  Boots the dsh web profile with the desktop window auto-opened, and
rem  arms app mode: closing the window also shuts the backend down.
rem
rem  Fresh extraction (zip): the plugin is registered into the booted
rem  profile automatically on first launch (pnpm link + bundle append via
rem  scripts\install-profile.mjs --check), so click-to-use works without
rem  running bin\install.cmd first. Use bin\install.cmd when you also want
rem  the /desktop command in the web UI or explicit control.
rem
rem  Port: uses DSH_DESKTOP_PORT when set, else --port 0 (OS-assigned),
rem  so it never collides with another dsh instance on 3080. Any --port
rem  you pass on the command line wins.
rem
rem  Double-clicking runs hidden (no console window) via launch-hidden.vbs;
rem  running with arguments keeps the console for diagnostics.
rem =====================================================================
setlocal

if "%~1"=="" (
  if /i not "%DSH_DESKTOP_HIDDEN%"=="1" (
    set "DSH_DESKTOP_HIDDEN=1"
    start "" wscript.exe "%~dp0launch-hidden.vbs"
    exit /b 0
  )
)

set DSH_DESKTOP_LAUNCH=1
set DSH_DESKTOP_APP=1

set "ROOT=%~dp0.."

rem --- startup splash: show a small progress window immediately, so first
rem launches (npx download on first run, backend boot, UI load) never sit
rem silent. The real window reports "ready" through the status file and the
rem splash closes itself. Set DSH_DESKTOP_SPLASH=0 to disable.
if not "%DSH_DESKTOP_SPLASH%"=="0" (
  start "" /b "%ROOT%\node_modules\electron\dist\electron.exe" "%ROOT%\desktop\main.cjs" --splash
)

rem --- auto-register: the desktop window only opens when dsh-desktop is in
rem the booted profile's bundles. A fresh zip extraction isn't registered
rem yet, so register it once before booting. --check exits 0 when ready or
rem 1/2 when registration is missing - including when the profile does not
rem exist yet, which the installer creates (minimal skeleton) on the spot.
rem NOTE: no parentheses inside the block below - cmd parses them as block
rem delimiters even inside rem/echo text.
where node >nul 2>nul
if not errorlevel 1 (
  if not exist "%ROOT%\lib\index.js" (
    echo [dsh-desktop] building the plugin - one-time - ...
    pushd "%ROOT%"
    call npm install
    call npm run build
    popd
  )
  node "%ROOT%\scripts\install-profile.mjs" --check >nul 2>nul
  if errorlevel 1 (
    echo [dsh-desktop] registering into the web profile - one-time - ...
    node "%ROOT%\scripts\install-profile.mjs"
    if errorlevel 1 (
      echo [dsh-desktop] WARNING: auto-register failed. Run bin\install.cmd for details.
    )
  )
)
:boot

set PORT_ARGS=
echo %* | findstr /i /c:"--port" >nul
if errorlevel 1 (
  if defined DSH_DESKTOP_PORT (
    set PORT_ARGS=--port %DSH_DESKTOP_PORT%
  ) else (
    set PORT_ARGS=--port 0
  )
)

rem `call` is required: dsh/npx are .cmd shims, and invoking a shim from a
rem batch without `call` breaks env propagation on some cmd versions.
rem Phase tokens feed the startup splash: download on the npx fallback
rem (first run), boot when a global dsh is used.
where dsh >nul 2>nul
if %errorlevel%==0 (
  echo boot> "%TEMP%\dsh-desktop-splash.status"
  call dsh web %PORT_ARGS% %*
) else (
  echo download> "%TEMP%\dsh-desktop-splash.status"
  call npx --yes @deepseek-ai/dsh web %PORT_ARGS% %*
)
echo ready> "%TEMP%\dsh-desktop-splash.status"

exit /b %errorlevel%
