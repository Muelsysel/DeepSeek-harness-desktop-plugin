@echo off
rem =====================================================================
rem  DeepSeek Harness Desktop - one-command setup & launch.
rem
rem  After downloading and extracting the zip, run this once - from a
rem  terminal or by double-clicking it. One command does everything:
rem    1. Node.js check
rem    2. DeepSeek Harness (dsh CLI) check - the launcher installs it via
rem       npx on first launch when missing
rem    3. Register this plugin into the dsh web profile
rem    4. Create the Desktop shortcut (whale icon)
rem    5. Launch the desktop window
rem
rem  Later starts are fast: double-click the Desktop shortcut
rem  "DeepSeek Harness 桌面版" (or bin\dsh-desktop.cmd) and the window
rem  opens. Optional argument "noshortcut" skips step 4 (used by the
rem  setup installer, which already creates the Desktop shortcut).
rem =====================================================================
setlocal
cd /d "%~dp0"

title DeepSeek Harness Desktop - Setup

echo.
echo  ================================================================
echo    DeepSeek Harness Desktop - setup & launch
echo  ================================================================
echo.

rem ---------- 1) Node.js (required: 22 or newer) ----------
echo  [1/5] Checking Node.js ...
where node >nul 2>nul
if errorlevel 1 (
  echo        Node.js not found. DeepSeek Harness requires Node.js 22 or
  echo        newer - the web UI stack declares 22.19+.
  echo        Install it from:  https://nodejs.org
  echo        Then run this file again.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do set "NODE_VER=%%v"
if not defined NODE_VER (
  echo        Could not read the Node.js version - is the install healthy?
  pause
  exit /b 1
)
for /f "tokens=1 delims=." %%m in ("%NODE_VER:~1%") do set "NODE_MAJOR=%%m"
if %NODE_MAJOR% LSS 22 (
  echo        Node.js %NODE_VER% is too old - DeepSeek Harness requires
  echo        Node.js 22 or newer.
  echo        Upgrade from:  https://nodejs.org  then run this file again.
  pause
  exit /b 1
)
echo        Node.js %NODE_VER% - OK
echo.

rem ---------- 2) DeepSeek Harness ----------
echo  [2/5] Checking DeepSeek Harness (dsh CLI) ...
where dsh >nul 2>nul
if not errorlevel 1 (
  for /f "delims=" %%v in ('dsh --version 2^>nul') do set "DSH_VER=%%v"
  echo        DeepSeek Harness %DSH_VER% - already installed
) else (
  echo        Not found. DeepSeek Harness is used via npx:
  echo          npx @deepseek-ai/dsh web
  echo        The launcher runs this automatically on first launch - npx
  echo        downloads dsh into its cache once, then starts are fast.
  echo        No manual install needed.
)
echo.

rem ---------- 3) register plugin ----------
echo  [3/5] Registering the desktop plugin into the dsh profile ...
node "scripts\install-profile.mjs"
if errorlevel 1 (
  echo        Registration failed. Run  bin\install.cmd  for details.
  pause
  exit /b 1
)
echo.

rem ---------- 4) desktop shortcut (automatic) ----------
if /i "%~1"=="noshortcut" goto :skip_shortcut
echo  [4/5] Creating the Desktop shortcut ...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\make-shortcut.ps1"
if errorlevel 1 (
  echo        Shortcut creation failed. Run  create-shortcut.cmd  to retry.
)
:skip_shortcut
echo.

rem ---------- 5) launch ----------
echo  [5/5] Launching DeepSeek Harness Desktop ...
echo        Closing this window is fine - the desktop window takes over.
echo.
call bin\dsh-desktop.cmd
exit /b %errorlevel%
