; =====================================================================
;  DeepSeek Harness Desktop - setup installer (NSIS).
;
;  Build:   node scripts\make-setup.mjs (injects the version, assembles the
;           standalone app bundle, and runs this script)
;  Output:  dist\DeepSeek-Harness-Desktop-Setup-<version>.exe
;
;  Installs the self-contained desktop app: bundled dsh backend + Electron
;  runtime + shell with startup splash. NO Node / pnpm / dsh installation is
;  needed on the target machine. The app boots its own backend into a
;  private profile and closes it when the window closes.
; =====================================================================

!include "MUI2.nsh"

!ifndef APP_VERSION
  !define APP_VERSION "0.1.2"
!endif
!define APP_NAME "DeepSeek Harness Desktop"
!define APP_ID "dev.dsh.desktop"
!define ICON "..\bin\dsh-desktop.ico"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"

Name "${APP_NAME}"
OutFile "..\dist\DeepSeek-Harness-Desktop-Setup-${APP_VERSION}.exe"
; No spaces in the install path: pnpm rejects `link:` specs with spaces, and
; the bundled backend is linked into a private profile the same way.
InstallDir "$LOCALAPPDATA\Programs\DeepSeek-Harness-Desktop"
RequestExecutionLevel user
Unicode true
SetCompressor /SOLID lzma

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "${APP_NAME} - Setup"
!define MUI_WELCOMEPAGE_TEXT "This installs the ${APP_NAME} desktop app.$\r$\n$\r$\nIt is self-contained: the dsh backend and the Electron runtime are bundled, so no Node.js, pnpm or DeepSeek Harness installation is needed.$\r$\n$\r$\nClick Next to continue."

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$WINDIR\System32\wscript.exe"
!define MUI_FINISHPAGE_RUN_PARAMETERS "$INSTDIR\bin\launch-hidden.vbs"
!define MUI_FINISHPAGE_RUN_TEXT "Launch DeepSeek Harness Desktop"
!define MUI_FINISHPAGE_NOREBOOTSUPPORT
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

; ---------------------------------------------------------------------
Section "Install" SecInstall
  SetOutPath "$INSTDIR"

  ; Payload: the standalone app bundle (shell + backend/ + electron/) as
  ; one zip - keeps the installer build fast; expanded below.
  File "..\dist\setup-stage\payload.zip"
  DetailPrint "Expanding the app (about 400 MB) - this can take a minute ..."
  nsExec::ExecToLog '"$SYSDIR\tar.exe" -xf "$INSTDIR\payload.zip" -C "$INSTDIR"'
  Pop $0
  ${If} $0 != 0
    DetailPrint "ERROR: expanding payload failed (code $0)"
    MessageBox MB_ICONSTOP "Failed to unpack the app files. Installation aborted."
    Abort
  ${EndIf}
  Delete "$INSTDIR\payload.zip"

  ; Desktop shortcut (Chinese name + whale icon) via the packaged script,
  ; which builds the name from char codes so encoding is always safe.
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\make-shortcut.ps1"'
  Pop $0

  ; Start Menu shortcuts (the Electron runtime is bundled under electron\)
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\electron\electron.exe" '"$INSTDIR\main.cjs"' "$INSTDIR\bin\dsh-desktop.ico"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\bin\dsh-desktop.ico"

  ; In-install launcher: an explicit double-click entry right inside the app
  ; folder, so the install dir always has an obvious way to start the app
  ; (in addition to the Desktop and Start Menu shortcuts).
  CreateShortcut "$INSTDIR\${APP_NAME}.lnk" "$WINDIR\System32\wscript.exe" '"$INSTDIR\bin\launch-hidden.vbs"' "$INSTDIR\bin\dsh-desktop.ico"

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
  ; Desktop shortcut (Chinese name) is removed by the packaged script, which
  ; builds the name from char codes - safe for this ASCII-only script.
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\make-shortcut.ps1" -Remove'
  Pop $0

  RMDir /r "$SMPROGRAMS\${APP_NAME}"
  DeleteRegKey HKCU "${UNINST_KEY}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"
SectionEnd
