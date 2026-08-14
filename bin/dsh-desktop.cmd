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

rem --- auto-register: the desktop window only opens when dsh-desktop is in
rem the booted profile's bundles. A fresh zip extraction isn't registered
rem yet, so register it once before booting. --check exits 0 when ready,
rem 1 when install is needed, 2 when the profile is not created yet - the
rem first-ever boot creates it, and the next click registers.
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
  if errorlevel 2 goto :boot
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
where dsh >nul 2>nul
if %errorlevel%==0 (
  call dsh web %PORT_ARGS% %*
) else (
  call npx --yes @deepseek-ai/dsh web %PORT_ARGS% %*
)

exit /b %errorlevel%
