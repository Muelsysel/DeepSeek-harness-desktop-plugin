@echo off
rem =====================================================================
rem  dsh-desktop - remove from the dsh web profile.
rem
rem  Routes through scripts\install-profile.mjs --remove, the single owner
rem  of the profile bundle-list mutation (a package.json backup is written).
rem =====================================================================
setlocal
set DSH_PROFILE=web
if not "%1"=="" set DSH_PROFILE=%1

where node >nul 2>nul
if errorlevel 1 (
  echo [dsh-desktop] node is required: https://nodejs.org
  exit /b 1
)

cd /d "%~dp0.."
node scripts\install-profile.mjs --profile %DSH_PROFILE% --remove
exit /b %errorlevel%
