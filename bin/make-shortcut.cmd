@echo off
rem =====================================================================
rem  dsh-desktop - create a Desktop shortcut.
rem
rem  Creates "DeepSeek Harness 桌面版.lnk" on the Desktop: double-click it
rem  to open the desktop window (no console), close the window to shut
rem  the backend down too. Re-run any time to refresh.
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
