' dsh-desktop app hidden launcher (installed app bundle).
' Runs the bundled Electron runtime with main.cjs and no console window, so
' double-clicking the shortcut opens only the desktop window.
' The Electron runtime lives under electron\electron.exe next to main.cjs.
Option Explicit

Dim fso, sh, binDir, appDir, electron
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

binDir = fso.GetParentFolderName(WScript.ScriptFullName)
appDir = fso.GetParentFolderName(binDir)

' Prefer the bundled runtime; fall back to a bare electron.exe on PATH.
electron = fso.BuildPath(appDir, "electron\electron.exe")
If Not fso.FileExists(electron) Then electron = "electron.exe"

sh.CurrentDirectory = appDir
sh.Run """" & electron & """ ""main.cjs""", 0, False
