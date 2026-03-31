$source = "c:\Users\Jose Moreno\Desktop\ARCHIPEG"
$tempDir = "C:\temp_archipeg"

if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tempDir

Write-Output "Clonando al entorno temporal seguro (ignorando carpetas pesadas)..."
robocopy $source $tempDir /E /XD node_modules dist_electron .git fotos_archipeg /R:1 /W:1

# Ignoramos el exit code si es menor a 8 (robocopy retorna 1 cuando copia con éxito)
if ($LASTEXITCODE -ge 8) { throw "Robocopy falló con código $LASTEXITCODE" }

# Aseguramos que exista la carpeta vacía para el unpacker
New-Item -ItemType Directory -Force -Path "$tempDir\fotos_archipeg" | Out-Null

Set-Location $tempDir
Write-Output "Instalando dependencias desde cero (Esto reconstruirá SQLite para Electron sin el bug del espacio)..."
npm install --no-audit --no-fund

Write-Output "Empaquetando la App..."
npm run dist

if (Test-Path "$tempDir\dist_electron\Archipeg*.exe") {
    Write-Output "¡Misión Cumplida! Movimiendo .exe al escritorio de nuevo..."
    Copy-Item "$tempDir\dist_electron\Archipeg*.exe" -Destination "$source\dist_electron\" -Force
    Set-Location c:\
    Remove-Item -Path $tempDir -Recurse -Force
    Write-Output "SUCCESS_ALL_DONE"
} else {
    throw "El ejecutable no se generó. Hubo un error en electron-builder."
}
