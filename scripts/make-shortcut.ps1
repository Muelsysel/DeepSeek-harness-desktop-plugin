# Creates a desktop shortcut "DeepSeek Harness <desktop-edition>" that
# launches the desktop window hidden (no console) via bin\launch-hidden.vbs,
# with the official DeepSeek icon (bin\dsh-desktop.ico). Safe to re-run
# (overwrites). ASCII-only source: the Chinese name is built from char codes
# so PowerShell 5.1 never misreads it.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

# --- icon: the official DeepSeek mark, committed as bin\dsh-desktop.ico -----
$icoPath = Join-Path $repo 'bin\dsh-desktop.ico'
if (-not (Test-Path $icoPath)) {
  throw "icon not found: $icoPath (re-run the icon build script first)"
}
Write-Host "icon: $icoPath"

# --- create the shortcut ---------------------------------------------------
$desktop = [Environment]::GetFolderPath('Desktop')
$name = 'DeepSeek Harness ' + [char]0x684C + [char]0x9762 + [char]0x7248 + '.lnk'
$lnkPath = Join-Path $desktop $name
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($lnkPath)
$s.TargetPath = "$env:windir\System32\wscript.exe"
$s.Arguments = '"' + (Join-Path $repo 'bin\launch-hidden.vbs') + '"'
$s.WorkingDirectory = Join-Path $repo 'bin'
$s.IconLocation = $icoPath
$s.Description = 'DeepSeek Harness desktop'
$s.Save()
Write-Host "shortcut: $lnkPath"
