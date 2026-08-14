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

rem ---------- 1) Node.js ----------
echo  [1/5] Checking Node.js ...
where node >nul 2>nul
if errorlevel 1 (
  echo        Node.js not found. DeepSeek Harness runs on Node.js.
  echo        Install a recent Node.js LTS from:  https://nodejs.org
  echo        The dsh web UI declares Node ^>= 22.19 through one of its
  echo        dependencies - newer Node versions are recommended, but the
  echo        plugin itself has no Node version requirement.
  echo        Then run this file again.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do set "NODE_VER=%%v"
echo        Node.js %NODE_VER% - OK
echo.

rem ---------- 2) DeepSeek Harness ----------
echo  [2/5] Checking DeepSeek Harness (dsh CLI) ...
where dsh >nul 2>nul
if not errorlevel 1 (
  for /f "delims=" %%v in ('dsh --version 2^>nul') do set "DSH_VER=%%v"
  echo        DeepSeek Harness %DSH_VER% - already installed
) else (
  echo        Not found. Installing it globally now - this needs internet
  echo        and takes a few minutes on the first run.
  call npm install -g @deepseek-ai/dsh
  if errorlevel 1 (
    echo.
    echo        Install failed. Check your network or npm registry, then
    echo        run this file again, or install manually with:
    echo          npm install -g @deepseek-ai/dsh
    echo.
    echo        Tip: the launcher can also fetch dsh automatically on first
    echo        launch, but that first start is much slower.
    pause
    exit /b 1
  )
  echo        DeepSeek Harness installed.
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
