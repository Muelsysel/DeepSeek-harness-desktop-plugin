@echo off
rem =====================================================================
rem  DeepSeek Harness Desktop - first-run wizard.
rem
rem  Guides a fresh extraction through the setup steps:
rem    1. Node.js check
rem    2. DeepSeek Harness (dsh CLI) check - installs it when missing
rem    3. Register this plugin into the dsh web profile
rem    4. Create a Desktop shortcut - optional
rem    5. Launch the desktop window
rem
rem  Run it once after unzipping. Later starts are fast: double-click the
rem  Desktop shortcut (or bin\dsh-desktop.cmd) and the window opens.
rem  Optional argument "noshortcut" skips step 4 (used by the setup
rem  installer, which already creates the Desktop shortcut).
rem =====================================================================
setlocal
cd /d "%~dp0"

title DeepSeek Harness Desktop - Setup

echo.
echo  ================================================================
echo    DeepSeek Harness Desktop - first-run setup
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

rem ---------- 4) desktop shortcut ----------
if /i "%~1"=="noshortcut" goto :skip_shortcut
set "MAKE_LNK="
set /p MAKE_LNK=" [4/5] Create a Desktop shortcut with the DeepSeek icon? [y/N]: "
if /i "%MAKE_LNK%"=="y" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\make-shortcut.ps1"
) else (
  echo        Skipped. Run  create-shortcut.cmd  any time to add one.
)
:skip_shortcut
echo.

rem ---------- 5) launch ----------
echo  [5/5] Launching DeepSeek Harness Desktop ...
echo        Closing this window is fine - the desktop window takes over.
echo.
call bin\dsh-desktop.cmd
exit /b %errorlevel%
