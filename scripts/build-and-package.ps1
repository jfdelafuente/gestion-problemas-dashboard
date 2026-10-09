<#
.SYNOPSIS
    Compila y empaqueta el Dashboard de Gestión de Problemas en modo Standalone.
.DESCRIPTION
    Genera un archivo gestion-problemas-standalone.tar.gz listo para producción,
    evitando la compilación y descargas de npm en el servidor con proxy.
#>

$ErrorActionPreference = "Stop"

Write-Host ">>> Iniciando compilación de producción con basePath '/problemas'..." -ForegroundColor Cyan

$env:NODE_ENV = "production"
$env:NEXT_PUBLIC_BASE_PATH = "/problemas"

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: La compilación de Next.js ha fallado." -ForegroundColor Red
    exit 1
}

Write-Host ">>> Empaquetando artefacto Standalone..." -ForegroundColor Cyan
node scripts/package-standalone.js

