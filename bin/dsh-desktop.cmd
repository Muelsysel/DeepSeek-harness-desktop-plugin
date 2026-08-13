@echo off
rem =====================================================================
rem  dsh-desktop - one-click launcher.
rem
rem  Boots the dsh web profile with the desktop window auto-opened. The
rem  plugin must be installed into the profile first (bin\install.cmd).
rem
rem  Port: uses DSH_DESKTOP_PORT when set, else --port 0 (OS-assigned),
rem  so it never collides with another dsh instance on 3080. Any --port
rem  you pass on the command line wins.
rem =====================================================================
setlocal
set DSH_DESKTOP_LAUNCH=1

set PORT_ARGS=
echo %* | findstr /i /c:"--port" >nul
if errorlevel 1 (
  if defined DSH_DESKTOP_PORT (
    set PORT_ARGS=--port %DSH_DESKTOP_PORT%
  ) else (
    set PORT_ARGS=--port 0
  )
)

rem `call` is required: dsh/npx are .cmd shims, and invoking a shim from a
rem batch without `call` breaks env propagation on some cmd versions.
where dsh >nul 2>nul
if %errorlevel%==0 (
  call dsh web %PORT_ARGS% %*
) else (
  call npx --yes @deepseek-ai/dsh web %PORT_ARGS% %*
)

exit /b %errorlevel%
