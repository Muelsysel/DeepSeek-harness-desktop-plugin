' dsh-desktop hidden launcher.
' Runs bin\dsh-desktop.cmd with no console window, so double-clicking the
' shortcut opens only the desktop window. The child cmd inherits the
' DSH_DESKTOP_HIDDEN=1 marker to avoid re-hiding in a loop.
Option Explicit

Dim fso, sh, dir
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Environment("PROCESS").Item("DSH_DESKTOP_HIDDEN") = "1"

' Window style 0 = hidden; last arg False = do not wait.
sh.Run "cmd /c dsh-desktop.cmd", 0, False
