; =====================================================================
;  DeepSeek Harness Desktop - plugin setup installer (NSIS).
;
;  Build:   tools\nsis\nsis-bundle\makensis.cmd setup\desktop-setup.nsi
;           (or via node scripts\make-setup.mjs, which injects the version)
;  Output:  dist\DeepSeek-Harness-Desktop-Setup-<version>.exe
;
;  The installer places the plugin package (payload.zip, expanded at
;  install time), creates the Desktop + Start Menu shortcuts with the
;  official DeepSeek icon, registers an uninstall entry, and offers to run
;  start.cmd - the guided first-run wizard that installs DeepSeek Harness
;  (dsh CLI), registers the plugin and launches the window.
; =====================================================================

!include "MUI2.nsh"

!ifndef APP_VERSION
  !define APP_VERSION "0.1.1"
!endif
!define APP_NAME "DeepSeek Harness Desktop"
!define APP_ID "dev.dsh.desktop"
!define ICON "..\bin\dsh-desktop.ico"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"

Name "${APP_NAME}"
OutFile "..\dist\DeepSeek-Harness-Desktop-Setup-${APP_VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
RequestExecutionLevel user
Unicode true
SetCompressor /SOLID lzma

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "${APP_NAME} - Setup"
!define MUI_WELCOMEPAGE_TEXT "This will install the ${APP_NAME} plugin into your dsh profile.$\r$\n$\r$\nAfter installation, a first-run wizard will check and install DeepSeek Harness (dsh CLI) if needed, register this plugin, create a Desktop shortcut and launch the window.$\r$\n$\r$\nClick Next to continue."

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\start.cmd"
!define MUI_FINISHPAGE_RUN_PARAMETERS "noshortcut"
!define MUI_FINISHPAGE_RUN_TEXT "Run first-run setup (install DeepSeek Harness + register + launch)"
!define MUI_FINISHPAGE_NOREBOOTSUPPORT
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

; ---------------------------------------------------------------------
Section "Install" SecInstall
  SetOutPath "$INSTDIR"

  ; Payload: the staged plugin tree (source + lib + node_modules) as one
  ; zip - keeps the installer build fast; expanded below.
  File "..\dist\setup-stage\payload.zip"
  nsExec::ExecToLog '"$SYSDIR\tar.exe" -xf "$INSTDIR\payload.zip" -C "$INSTDIR"'
  Pop $0
  Delete "$INSTDIR\payload.zip"
  ${If} $0 != 0
    DetailPrint "ERROR: expanding payload failed (code $0)"
    MessageBox MB_ICONSTOP "Failed to unpack the plugin files. Installation aborted."
    Abort
  ${EndIf}

  ; Desktop shortcut (Chinese name + whale icon) via the packaged script,
  ; which builds the name from char codes so encoding is always safe.
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\make-shortcut.ps1"'
  Pop $0

  ; Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$WINDIR\System32\wscript.exe" '"$INSTDIR\bin\launch-hidden.vbs"' "$INSTDIR\bin\dsh-desktop.ico"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\First-run setup.lnk" "$INSTDIR\start.cmd" "" "$INSTDIR\bin\dsh-desktop.ico"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\bin\dsh-desktop.ico"

  ; Uninstall entry
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "DeepSeek"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\bin\dsh-desktop.ico"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
SectionEnd

; ---------------------------------------------------------------------
Section "Uninstall"
  ; Best-effort: unregister the plugin from the dsh profile first.
  nsExec::ExecToLog '"$SYSDIR\cmd.exe" /c cd /d "$INSTDIR" ^&^& node scripts\install-profile.mjs --remove'
  Pop $0

  ; Desktop shortcut (Chinese name) is removed by the packaged script, which
  ; builds the name from char codes - safe for this ASCII-only script.
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\make-shortcut.ps1" -Remove'
  Pop $0

  RMDir /r "$SMPROGRAMS\${APP_NAME}"
  DeleteRegKey HKCU "${UNINST_KEY}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"
SectionEnd
