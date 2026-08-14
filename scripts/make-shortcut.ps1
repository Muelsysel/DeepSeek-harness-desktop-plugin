# Creates a desktop shortcut "DeepSeek Harness <desktop-edition>" that
# launches the desktop window hidden (no console) via bin\launch-hidden.vbs,
# with a generated icon. Safe to re-run (overwrites). ASCII-only source: the
# Chinese name is built from char codes so PowerShell 5.1 never misreads it.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

Add-Type -AssemblyName System.Drawing

# --- generate a simple icon: dark square + blue window frame -------------
$icoPath = Join-Path $repo 'bin\dsh-desktop.ico'
$bmp = New-Object System.Drawing.Bitmap 64, 64
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::Transparent)
$dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 13, 17, 23))
$blue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 84, 152, 255))
$g.FillRectangle($dark, 2, 2, 60, 60)
$g.FillRectangle($blue, 8, 10, 48, 8)   # top bar
$g.FillRectangle($blue, 8, 10, 8, 36)   # left edge
$g.FillRectangle($blue, 48, 10, 8, 36)  # right edge
$g.FillRectangle($blue, 8, 42, 48, 8)   # bottom edge
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::Create($icoPath)
$icon.Save($fs)
$fs.Close()
$g.Dispose(); $bmp.Dispose()
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
