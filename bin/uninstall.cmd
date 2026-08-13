@echo off
rem =====================================================================
rem  dsh-desktop - remove from the dsh web profile.
rem
rem  Removes dsh-desktop from the profile's bundle list and uninstalls the
rem  package. A backup of package.json is written before editing.
rem =====================================================================
setlocal
set DSH_PROFILE=web
if not "%1"=="" set DSH_PROFILE=%1

set PROFILE_DIR=%USERPROFILE%\.dsh\profiles\%DSH_PROFILE%
if not exist "%PROFILE_DIR%\package.json" (
  echo [dsh-desktop] no profile package.json at %PROFILE_DIR%
  exit /b 1
)

set PKG=%PROFILE_DIR%\package.json
copy /y "%PKG%" "%PKG%.bak" >nul

node -e "const fs=require('fs');const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,'utf8'));if(j.dsh&&j.dsh.profile&&Array.isArray(j.dsh.profile.bundles)){j.dsh.profile.bundles=j.dsh.profile.bundles.filter(b=>b!=='dsh-desktop');fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');}console.log('removed dsh-desktop from bundles')" "%PKG%"

where pnpm >nul 2>nul
if %errorlevel%==0 (
  call pnpm --dir "%PROFILE_DIR%" remove dsh-desktop
) else (
  echo [dsh-desktop] pnpm not found - run: pnpm --dir "%PROFILE_DIR%" remove dsh-desktop
)

echo [dsh-desktop] done. backup: %PKG%.bak
exit /b 0
