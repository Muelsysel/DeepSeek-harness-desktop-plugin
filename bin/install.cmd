@echo off
rem =====================================================================
rem  dsh-desktop - one-command setup: register the plugin and create the
rem  Desktop shortcut.
rem
rem  After downloading and extracting the zip, run this once:
rem      bin\install.cmd
rem  It registers dsh-desktop into $DSH_HOME/profiles/web (pnpm link +
rem  bundle append) and creates the Desktop shortcut
rem  "DeepSeek Harness 桌面版" (whale icon). From then on, double-click
rem  the Desktop shortcut (or bin\dsh-desktop.cmd) to open the window.
rem
rem  Re-running is safe: registration is idempotent and the shortcut is
rem  overwritten. Pass --profile <name> to register into another profile.
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
echo [dsh-desktop] creating the Desktop shortcut ...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\make-shortcut.ps1"
if errorlevel 1 (
  echo [dsh-desktop] WARNING: shortcut creation failed - run create-shortcut.cmd to retry.
)

echo.
echo [dsh-desktop] Done. Double-click the Desktop shortcut
echo               "DeepSeek Harness 桌面版" to open the desktop window.
exit /b 0
