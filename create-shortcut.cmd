@echo off
rem Creates the Desktop shortcut "DeepSeek Harness 桌面版" with the official
rem DeepSeek icon. Safe to re-run (overwrites).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\make-shortcut.ps1"
exit /b %errorlevel%
