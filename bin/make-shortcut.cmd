@echo off
rem =====================================================================
rem  dsh-desktop - create a Desktop shortcut.
rem
rem  Creates "DeepSeek Harness <Desktop>.lnk" (Chinese: "desktop edition")
rem  on the Desktop: double-click it to open the desktop window with no
rem  console; closing the window also shuts the backend down. Re-run any
rem  time to refresh.
rem =====================================================================
setlocal
cd /d "%~dp0.."

where powershell >nul 2>nul
if errorlevel 1 (
  echo [dsh-desktop] powershell is required.
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\make-shortcut.ps1"
exit /b %errorlevel%
