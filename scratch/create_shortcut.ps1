$WshShell = New-Object -ComObject WScript.Shell
$ShortcutPath = Join-Path ([System.Environment]::GetFolderPath("Desktop")) "Archipeg Pro.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "c:\Users\Jose Moreno\Desktop\ARCHIPEG\dist_electron\win-unpacked\Archipeg Pro.exe"
$Shortcut.WorkingDirectory = "c:\Users\Jose Moreno\Desktop\ARCHIPEG\dist_electron\win-unpacked"
$Shortcut.Save()
Write-Host "✅ Acceso directo creado en el Escritorio."
