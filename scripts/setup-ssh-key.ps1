<#
.SYNOPSIS
    Configura autenticacion por clave SSH sin contrasena hacia infocodes@10.132.26.96.

.DESCRIPTION
    1. Comprueba si ya tienes una clave SSH en ~/.ssh/id_ed25519 (si no existe, la genera sin passphrase).
    2. Sube la clave publica al servidor remoto (infocodes@10.132.26.96), la registra en ~/.ssh/authorized_keys,
       ajusta los permisos estrictos (700 en ~/.ssh y 600 en authorized_keys) y contexto SELinux.
    3. Verifica que la conexion SSH funcione sin pedir contrasena.
#>

[CmdletBinding()]
param(
    [string]$TargetHost = "infocodes@10.132.26.96"
)

$ErrorActionPreference = "Stop"

$SshDir = Join-Path $HOME ".ssh"
$KeyPath = Join-Path $SshDir "id_ed25519"
$PubKeyPath = "$KeyPath.pub"

Write-Host "=================================================================" -ForegroundColor DarkCyan
Write-Host "   Configuracion de Clave SSH sin contrasena -> $TargetHost" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor DarkCyan

# 1. Crear carpeta ~/.ssh si no existe
if (-not (Test-Path $SshDir)) {
    New-Item -ItemType Directory -Path $SshDir -Force | Out-Null
}

# 2. Generar clave SSH ed25519 si no existe todavia
if (-not (Test-Path $PubKeyPath)) {
    Write-Host ""
    Write-Host "[1/3] Generando nueva clave SSH (ed25519) en $KeyPath..." -ForegroundColor Cyan
    # Usamos cmd /c para pasar -N "" correctamente en Windows PowerShell 5.1
    cmd /c "ssh-keygen -t ed25519 -f `"$KeyPath`" -N `"`" -q"
    if (-not (Test-Path $PubKeyPath)) {
        throw "No se pudo generar la clave SSH en $KeyPath."
    }
    Write-Host "  [OK] Clave generada correctamente." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[1/3] Clave SSH existente detectada en $PubKeyPath" -ForegroundColor Cyan
}

$PubKeyContent = (Get-Content -Raw $PubKeyPath).Trim()
$PubKeyB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($PubKeyContent))

# 3. Instalar la clave en el servidor remoto (pedira la contrasena por ultima vez)
Write-Host ""
Write-Host "[2/3] Instalando clave publica en $TargetHost (introduce tu contrasena por ultima vez)..." -ForegroundColor Cyan

$RemoteInstallTemplate = @'
set -e
PUBKEY=$(echo "__PUBKEY_B64__" | base64 -d)
mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
if ! grep -qxF "$PUBKEY" ~/.ssh/authorized_keys 2>/dev/null; then
    echo "$PUBKEY" >> ~/.ssh/authorized_keys
    echo "--> [Remoto] Clave publica anadida a ~/.ssh/authorized_keys"
else
    echo "--> [Remoto] La clave publica ya estaba registrada en ~/.ssh/authorized_keys"
fi
# Asegurar que el directorio home no tenga permisos de escritura para grupo/otros (requerido por StrictModes de sshd)
chmod g-w,o-w ~ 2>/dev/null || true
# Restaurar contexto SELinux si aplica en RHEL/CentOS
restorecon -R ~/.ssh >/dev/null 2>&1 || true
'@

$Normalized = $RemoteInstallTemplate.Replace("__PUBKEY_B64__", $PubKeyB64).Replace("`r`n", "`n") + "`n# end-of-script"
$Normalized | ssh $TargetHost bash
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error al instalar la clave publica en $TargetHost."
    exit $LASTEXITCODE
}

# 4. Probar conexion sin contrasena (BatchMode=yes falla inmediatamente si pide password)
Write-Host ""
Write-Host "[3/3] Verificando acceso sin contrasena a $TargetHost..." -ForegroundColor Cyan
$RemoteHostName = ssh -o BatchMode=yes $TargetHost "hostname"
if ($LASTEXITCODE -ne 0) {
    Write-Warning "El servidor sigue solicitando contrasena. Verifica los permisos del home en el servidor."
    exit $LASTEXITCODE
}
Write-Host "  [OK] Conexion SSH sin contrasena verificada con exito en: $RemoteHostName" -ForegroundColor Green

Write-Host ""
Write-Host "=================================================================" -ForegroundColor DarkGreen
Write-Host " [OK] LISTO: Ya puedes desplegar sin introducir contrasena." -ForegroundColor Green
Write-Host "      Ejecuta ahora:" -ForegroundColor Gray
Write-Host "      .\scripts\deploy-production.ps1 -SkipBuild -SkipUpload -IncludeBackend" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor DarkGreen
