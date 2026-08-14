' dsh-desktop app hidden launcher (installed app bundle).
' Runs electron.exe main.cjs with no console, so double-clicking the
' shortcut opens only the desktop window.
Option Explicit

Dim fso, sh, binDir, appDir
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

binDir = fso.GetParentFolderName(WScript.ScriptFullName)
appDir = fso.GetParentFolderName(binDir)
sh.CurrentDirectory = appDir
sh.Run """electron.exe"" ""main.cjs""", 0, False
