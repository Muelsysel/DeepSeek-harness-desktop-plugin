@echo off
rem =====================================================================
rem  dsh-desktop - install into the dsh web profile.
rem
rem  Installs this plugin package into $DSH_HOME/profiles/web and appends
rem  it to the profile's bundle list. Afterwards, double-click
rem  bin\dsh-desktop.cmd to launch the desktop window, or type /desktop
rem  in the web UI.
rem =====================================================================
setlocal
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo [dsh-desktop] node is required: https://nodejs.org
  exit /b 1
)

if not exist "lib\index.js" (
  echo [dsh-desktop] building the plugin first...
  call npm install
  if errorlevel 1 exit /b 1
  call npm run build
  if errorlevel 1 exit /b 1
)

node scripts\install-profile.mjs --profile web %*
if errorlevel 1 (
  echo [dsh-desktop] install failed.
  exit /b 1
)

echo.
echo [dsh-desktop] installed. Create a Desktop shortcut to bin\dsh-desktop.cmd
echo               and double-click it to open the Codex-like window.
exit /b 0
