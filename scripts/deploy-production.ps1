<#
.SYNOPSIS
    Despliegue automatizado en 1 clic del Dashboard de Gestion de Problemas a produccion (Fase 1.3).

.DESCRIPTION
    Automatiza el flujo completo de extremo a extremo desde Windows PowerShell:
      1. Compilacion de Next.js en modo Standalone (NEXT_PUBLIC_BASE_PATH="/problemas") y empaquetado .tar.gz.
      2. Subida del artefacto por SCP a /tmp/gestion-problemas-standalone.tar.gz en el servidor remoto.
      3. Ejecucion remota por SSH:
         - Garantiza la estructura persistente /infocodes/var/{cache/problemas,storage/executive_pptx,run}.
         - Respalda .env.local / .env.production.local existentes en el servidor para no sobrescribir tokens de produccion.
         - Migra caches previas (.cache/*.json) hacia /infocodes/var/cache/problemas/ sin perdida de datos.
         - Extrae el nuevo paquete standalone, normaliza saltos de linea (LF) y permisos de ejecucion en *.sh.
         - Reinicia el servicio mediante ./restart.sh y muestra ./status.sh.
         - Verifica las sondas HTTP (/problemas/api/healthz, /problemas/api/readyz y Nginx :8081/problemas).

.PARAMETER SkipBuild
    Omite la compilacion local y reutiliza el paquete existente en dist/gestion-problemas-standalone.tar.gz.

.PARAMETER TargetHost
    Usuario y host SSH de destino. Por defecto: "infocodes@10.132.26.96".

.PARAMETER RemoteDir
    Ruta remota de la aplicacion en el servidor. Por defecto: "/infocodes/project/gestion-problemas-dashboard".

.PARAMETER VerifyOnly
    No compila ni sube artefactos; unicamente consulta por SSH el estado del servicio y las sondas de salud.

.PARAMETER IncludeBackend
    Despliega tambien los archivos actualizados del backend FastAPI (cso-incident-masivas-report) y reinicia service.sh.

.PARAMETER Rollback
    Revierte automaticamente el servidor a la instantanea previa al ultimo despliegue (/infocodes/var/backups/) y reinicia los servicios.

.PARAMETER DryRun
    Muestra los comandos que se ejecutarian sin realizar cambios en el servidor remoto.

.EXAMPLE
    .\scripts\deploy-production.ps1
    Compila, empaqueta, sube, despliega (creando backup previo automatico) y verifica el frontend en un solo paso.

.EXAMPLE
    .\scripts\deploy-production.ps1 -IncludeBackend
    Despliega tanto el frontend (gestion-problemas-dashboard) como el backend FastAPI (cso-incident-masivas-report).

.EXAMPLE
    .\scripts\deploy-production.ps1 -Rollback
    Restaura en segundos la version anterior del frontend (y del backend si fue respaldado) desde /infocodes/var/backups/.

.EXAMPLE
    .\scripts\deploy-production.ps1 -SkipBuild
    Despliega directamente el ultimo artefacto dist/gestion-problemas-standalone.tar.gz generado.

.EXAMPLE
    .\scripts\deploy-production.ps1 -VerifyOnly
    Comprueba unicamente el estado y las sondas /healthz y /readyz en el servidor remoto.
#>

[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$SkipUpload,
    [string]$TargetHost = "infocodes@10.132.26.96",
    [string]$RemoteDir = "/infocodes/project/gestion-problemas-dashboard",
    [string]$RemoteBackendDir = "/infocodes/project/cso-incident-masivas-report/backend",
    [switch]$IncludeBackend,
    [switch]$Rollback,
    [switch]$VerifyOnly,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$SiblingBackendRoot = Join-Path (Split-Path -Parent $ProjectRoot) "cso-incident-masivas-report\backend"
$TarballRelPath = "dist/gestion-problemas-standalone.tar.gz"
$TarballFullPath = Join-Path $ProjectRoot $TarballRelPath
$RemoteTmpTarball = "/tmp/gestion-problemas-standalone.tar.gz"

function Write-Step {
    param([string]$Step, [string]$Message)
    Write-Host ""
    Write-Host "[$Step] $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-WarnMsg {
    param([string]$Message)
    Write-Host "  [AVISO] $Message" -ForegroundColor Yellow
}

function Invoke-RemoteBash {
    param(
        [string]$HostTarget,
        [string]$BashScript
    )
    # Normalizar saltos de linea a LF y terminar con comentario (#) para absorber el CRLF final del pipeline de PowerShell
    $Normalized = $BashScript.Replace("`r`n", "`n") + "`n# end-of-script"
    $Normalized | ssh $HostTarget bash
}

Write-Host "=================================================================" -ForegroundColor DarkCyan
Write-Host "   Deploy 1-Clic - Dashboard de Gestion de Problemas (Fase 1.3)  " -ForegroundColor Cyan
Write-Host "   Destino : $TargetHost" -ForegroundColor Gray
Write-Host "   Ruta    : $RemoteDir" -ForegroundColor Gray
Write-Host "=================================================================" -ForegroundColor DarkCyan

# Asegurar que el PATH de usuario (Node.js / npm) este cargado en la sesion actual
if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($UserPath) {
        $env:PATH = "$env:PATH;$UserPath"
    }
}

# Comprobar disponibilidad de cliente OpenSSH (ssh y scp)
foreach ($bin in @("ssh", "scp")) {
    if (-not (Get-Command $bin -ErrorAction SilentlyContinue)) {
        Write-Error "No se encontro el comando '$bin' en el PATH. Activa el cliente OpenSSH de Windows o Git Bash."
        exit 1
    }
}

# -------------------------------------------------------------------------
# MODO ROLLBACK: Reversion atomica por symlink (./rollback.sh) o desde /infocodes/var/backups/
# -------------------------------------------------------------------------
if ($Rollback) {
    Write-Step "ROLLBACK" "Ejecutando rollback atomico por symlink en $TargetHost..."

    $rollbackScriptTemplate = @'
set -e
REMOTE_DIR="__REMOTE_DIR__"
REMOTE_BACKEND_DIR="__REMOTE_BACKEND_DIR__"
BACKUP_TAR="/infocodes/var/backups/problemas-rollback.tar.gz"
BACKEND_BACKUP_DIR="/infocodes/var/backups/cso-backend-rollback"
VAR_CACHE_DIR="/infocodes/var/cache/problemas"

cd "$REMOTE_DIR"
if [ -x "$REMOTE_DIR/rollback.sh" ]; then
    ./rollback.sh
elif [ -f "$BACKUP_TAR" ]; then
    echo "--> [Rollback] Deteniendo servicio actual..."
    if [ -x ./stop.sh ]; then
        ./stop.sh || true
    fi
    echo "--> [Rollback] Restaurando snapshot previo ($BACKUP_TAR hacia $REMOTE_DIR)..."
    tar -xzf "$BACKUP_TAR" -C "$REMOTE_DIR"
    chmod +x "$REMOTE_DIR"/*.sh 2>/dev/null || true
    ./restart.sh
else
    echo "ERROR: No se encontro script rollback.sh ni instantanea en $BACKUP_TAR"
    exit 1
fi

./status.sh

if [ -d "$BACKEND_BACKUP_DIR" ] && [ -f "$BACKEND_BACKUP_DIR/main.py" ]; then
    echo "--> [Rollback] Restaurando archivos previos del Backend CSO..."
    cp -p "$BACKEND_BACKUP_DIR/main.py" "$REMOTE_BACKEND_DIR/main.py"
    [ -f "$BACKEND_BACKUP_DIR/schemas.py" ] && cp -p "$BACKEND_BACKUP_DIR/schemas.py" "$REMOTE_BACKEND_DIR/schemas.py"
    [ -f "$BACKEND_BACKUP_DIR/service.sh" ] && cp -p "$BACKEND_BACKUP_DIR/service.sh" "$REMOTE_BACKEND_DIR/service.sh"
    [ -f "$BACKEND_BACKUP_DIR/executive_paths.py" ] && cp -p "$BACKEND_BACKUP_DIR/executive_paths.py" "$REMOTE_BACKEND_DIR/report_generator/executive_paths.py"
    cd "$REMOTE_BACKEND_DIR"
    chmod +x service.sh 2>/dev/null || true
    ./service.sh restart
    ./service.sh status
fi
'@
    $rollbackScript = $rollbackScriptTemplate.Replace("__REMOTE_DIR__", $RemoteDir).Replace("__REMOTE_BACKEND_DIR__", $RemoteBackendDir).Replace("`r`n", "`n")

    if ($DryRun) {
        Write-WarnMsg "[DryRun] Se ejecutaria rollback por SSH en ${TargetHost}:"
        Write-Host $rollbackScript -ForegroundColor DarkGray
        exit 0
    }

    Invoke-RemoteBash -HostTarget $TargetHost -BashScript $rollbackScript
    if ($LASTEXITCODE -ne 0) {
        Write-Error "El rollback remoto devolvio un codigo de error ($LASTEXITCODE)."
        exit $LASTEXITCODE
    }
    $Stopwatch.Stop()
    Write-Ok ("Rollback completado con exito en {0:N1}s." -f $Stopwatch.Elapsed.TotalSeconds)
    exit 0
}

# -------------------------------------------------------------------------
# MODO VERIFY-ONLY: Consultar estado, reparar cache corrupta (<100B) si aplica y verificar sondas
# -------------------------------------------------------------------------
if ($VerifyOnly) {
    Write-Step "VERIFY" "Verificando estado del servicio y sondas HTTP en $TargetHost..."

    $verifyScriptTemplate = @'
set -e
REMOTE_DIR="__REMOTE_DIR__"
VAR_CACHE_DIR="/infocodes/var/cache/problemas"
cd "$REMOTE_DIR"

# Auto-reparar si algun fichero en /infocodes/var/cache/problemas quedo truncado (<100 bytes)
REPAIRED=0
for f in dashboard_stats.json jira_wiki_links.json; do
    if [ -f "$REMOTE_DIR/.cache/$f" ]; then
        if [ ! -f "$VAR_CACHE_DIR/$f" ] || [ $(wc -c < "$VAR_CACHE_DIR/$f") -lt 100 ]; then
            cp -p "$REMOTE_DIR/.cache/$f" "$VAR_CACHE_DIR/$f"
            echo "--> [Remoto] Restaurada cache integra $f en $VAR_CACHE_DIR/$f ($(wc -c < "$VAR_CACHE_DIR/$f") bytes)"
            REPAIRED=1
        fi
    fi
done

if [ "$REPAIRED" -eq 1 ] && [ -x ./restart.sh ]; then
    echo "--> [Remoto] Reiniciando servicio para recargar cache en memoria..."
    ./restart.sh
    sleep 2
elif [ -x ./status.sh ]; then
    ./status.sh || true
fi

echo ""
echo "=== Sondas HTTP Locales ==="
printf "Liveness (/problemas/api/healthz): "
curl -sf --noproxy '*' http://127.0.0.1:3001/problemas/api/healthz || curl -sf --noproxy '*' http://127.0.0.1:3001/problemas/healthz || echo "ERROR"
echo ""
printf "Readiness (/problemas/api/readyz): "
curl -sf --noproxy '*' http://127.0.0.1:3001/problemas/api/readyz || curl -sf --noproxy '*' http://127.0.0.1:3001/problemas/readyz || echo "ERROR"
echo ""
printf "Nginx Proxy (http://127.0.0.1:8081/problemas): HTTP "
curl -s --noproxy '*' -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8081/problemas || echo "ERROR"
'@
    $verifyScript = $verifyScriptTemplate.Replace("__REMOTE_DIR__", $RemoteDir).Replace("`r`n", "`n")

    if ($DryRun) {
        Write-WarnMsg "[DryRun] Se ejecutaria por SSH (via Base64 -> bash) en ${TargetHost}:"
        Write-Host $verifyScript -ForegroundColor DarkGray
        exit 0
    }

    Invoke-RemoteBash -HostTarget $TargetHost -BashScript $verifyScript
    if ($LASTEXITCODE -ne 0) {
        Write-Error "La verificacion remota devolvio un codigo de error ($LASTEXITCODE)."
        exit $LASTEXITCODE
    }
    $Stopwatch.Stop()
    Write-Ok ("Verificacion completada en {0:N1}s." -f $Stopwatch.Elapsed.TotalSeconds)
    exit 0
}

# -------------------------------------------------------------------------
# PASO 1: Compilacion Standalone y Empaquetado (.tar.gz)
# -------------------------------------------------------------------------
if (-not $SkipBuild) {
    Write-Step "1/3" "Compilando Next.js Standalone (NEXT_PUBLIC_BASE_PATH='/problemas') y empaquetando..."
    if ($DryRun) {
        Write-WarnMsg "[DryRun] Se ejecutaria: npm --prefix `"$ProjectRoot`" run build:standalone ; npm --prefix `"$ProjectRoot`" run package"
    } else {
        $env:NODE_ENV = "production"
        $env:NEXT_PUBLIC_BASE_PATH = "/problemas"

        npm --prefix "$ProjectRoot" run build:standalone
        if ($LASTEXITCODE -ne 0) {
            throw "Fallo en 'npm run build:standalone' (codigo $LASTEXITCODE)."
        }

        npm --prefix "$ProjectRoot" run package
        if ($LASTEXITCODE -ne 0) {
            throw "Fallo en 'npm run package' (codigo $LASTEXITCODE)."
        }
    }
} else {
    Write-Step "1/3" "Omitiendo compilacion (-SkipBuild activo). Verificando paquete existente..."
}

if (-not $DryRun -and -not $SkipUpload -and -not (Test-Path $TarballFullPath)) {
    throw "No existe el artefacto '$TarballFullPath'. Ejecuta sin -SkipBuild primero."
}

if (Test-Path $TarballFullPath) {
    $sizeMB = [Math]::Round((Get-Item $TarballFullPath).Length / 1MB, 2)
    Write-Ok "Artefacto listo: $TarballRelPath ($sizeMB MB)"
}

# -------------------------------------------------------------------------
# PASO 2: Subida del artefacto por SCP a /tmp/
# -------------------------------------------------------------------------
if ($SkipUpload) {
    Write-Step "2/3" "Omitiendo subida SCP (-SkipUpload activo). Se utilizara ${RemoteTmpTarball} ya presente en el servidor..."
} else {
    Write-Step "2/3" "Subiendo artefacto por SCP a ${TargetHost}:${RemoteTmpTarball}..."
    if ($DryRun) {
        Write-WarnMsg "[DryRun] Se ejecutaria: scp '$TarballFullPath' '${TargetHost}:${RemoteTmpTarball}'"
    } else {
        scp "$TarballFullPath" "${TargetHost}:${RemoteTmpTarball}"
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Error al subir el paquete mediante SCP (codigo $LASTEXITCODE)."
            exit $LASTEXITCODE
        }
        Write-Ok "Artefacto subido a ${RemoteTmpTarball}"
    }
}

# -------------------------------------------------------------------------
# PASO 3: Extraccion, Migracion de Estado (/infocodes/var), Reinicio y Verificacion
#         (Incluye sincronizacion del Backend CSO en la misma sesion SSH si se pasa -IncludeBackend)
# -------------------------------------------------------------------------
Write-Step "3/3" "Ejecutando despliegue remoto, reinicio y verificacion de salud en ${TargetHost}..."

$remoteDeployTemplate = @'
set -e

REMOTE_DIR="__REMOTE_DIR__"
TMP_TAR="__TMP_TAR__"
VAR_CACHE_DIR="/infocodes/var/cache/problemas"
VAR_STORAGE_DIR="/infocodes/var/storage/executive_pptx"
VAR_RUN_DIR="/infocodes/var/run"
VAR_BACKUP_DIR="/infocodes/var/backups"
RELEASES_DIR="$REMOTE_DIR/releases"
SHARED_DIR="$REMOTE_DIR/shared"
CURRENT_LINK="$REMOTE_DIR/current"

echo "--> [Remoto] Asegurando estructura persistente en /infocodes/var/ y releases/..."
mkdir -p "$VAR_CACHE_DIR" "$VAR_STORAGE_DIR" "$VAR_RUN_DIR" "$VAR_BACKUP_DIR" "$RELEASES_DIR" "$SHARED_DIR"

if [ ! -f "$TMP_TAR" ]; then
    echo "ERROR: No se encuentra $TMP_TAR en el servidor. Ejecuta sin -SkipUpload."
    exit 1
fi

# 1. Migrar cualquier cache previa en el directorio de aplicacion hacia /infocodes/var/cache/problemas
if [ -d "$REMOTE_DIR/.cache" ]; then
    for f in dashboard_stats.json jira_wiki_links.json; do
        if [ -f "$REMOTE_DIR/.cache/$f" ]; then
            if [ ! -f "$VAR_CACHE_DIR/$f" ] || [ $(wc -c < "$VAR_CACHE_DIR/$f") -lt 100 ]; then
                cp -p "$REMOTE_DIR/.cache/$f" "$VAR_CACHE_DIR/$f"
                echo "--> [Remoto] Migrada cache $f hacia $VAR_CACHE_DIR/$f"
            fi
        fi
    done
fi

# 2. Asegurar credenciales inmutables en shared/.env.local (migrando desde raiz si aun no estaban en shared/)
for env_file in .env.local .env.production.local; do
    if [ ! -f "$SHARED_DIR/$env_file" ] && [ -f "$REMOTE_DIR/$env_file" ] && [ ! -L "$REMOTE_DIR/$env_file" ]; then
        cp -p "$REMOTE_DIR/$env_file" "$SHARED_DIR/$env_file"
        echo "--> [Remoto] Migrado $env_file hacia $SHARED_DIR/$env_file"
    fi
done

# 3. Si es la primera transicion desde despliegue plano (sin symlink current), preservar release previa en releases/
if [ ! -L "$CURRENT_LINK" ] && [ -f "$REMOTE_DIR/server.js" ]; then
    LEGACY_REL="pre_$(date +%Y%m%d_%H%M%S)"
    echo "--> [Remoto] Preservando version activa previa en releases/$LEGACY_REL..."
    mkdir -p "$RELEASES_DIR/$LEGACY_REL"
    tar --exclude='./releases' --exclude='./shared' --exclude='./current' --exclude='./.cache' -cf - -C "$REMOTE_DIR" . 2>/dev/null | tar -xf - -C "$RELEASES_DIR/$LEGACY_REL" 2>/dev/null || true
    tar -czf "$VAR_BACKUP_DIR/problemas-rollback.tar.gz" -C "$RELEASES_DIR/$LEGACY_REL" . 2>/dev/null || true
fi

# 4. Extraer la nueva release en un directorio aislado sin tocar la version en ejecucion
RELEASE_ID="$(date +%Y%m%d_%H%M%S)"
NEW_RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
mkdir -p "$NEW_RELEASE_DIR"
echo "--> [Remoto] Extrayendo nueva release en $NEW_RELEASE_DIR..."
tar -xzf "$TMP_TAR" -C "$NEW_RELEASE_DIR"
rm -f "$TMP_TAR"

# 5. Si aun no existia shared/.env.local en el servidor, inicializarlo con el del paquete
for env_file in .env.local .env.production.local; do
    if [ ! -f "$SHARED_DIR/$env_file" ] && [ -f "$NEW_RELEASE_DIR/$env_file" ]; then
        cp -p "$NEW_RELEASE_DIR/$env_file" "$SHARED_DIR/$env_file"
    fi
    if [ -f "$SHARED_DIR/$env_file" ]; then
        ln -sfn "$SHARED_DIR/$env_file" "$NEW_RELEASE_DIR/$env_file"
    fi
done

# 6. Si el paquete traia cache precalentada y el servidor aun no tenia cache valida en /infocodes/var, inicializarla
if [ -d "$NEW_RELEASE_DIR/.cache" ]; then
    for f in dashboard_stats.json jira_wiki_links.json; do
        if [ -f "$NEW_RELEASE_DIR/.cache/$f" ]; then
            if [ ! -f "$VAR_CACHE_DIR/$f" ] || [ $(wc -c < "$VAR_CACHE_DIR/$f") -lt 100 ]; then
                cp -p "$NEW_RELEASE_DIR/.cache/$f" "$VAR_CACHE_DIR/$f"
                echo "--> [Remoto] Inicializada cache $f en $VAR_CACHE_DIR/$f"
            fi
        fi
    done
fi

# 7. Normalizar permisos en la nueva release y realizar el switch atomico del symlink current
sed -i 's/\r$//' "$NEW_RELEASE_DIR"/*.sh 2>/dev/null || true
chmod +x "$NEW_RELEASE_DIR"/*.sh 2>/dev/null || true

echo "--> [Remoto] Activando symlink atomico: current -> releases/$RELEASE_ID"
ln -sfn "releases/$RELEASE_ID" "$CURRENT_LINK"

# Sincronizar scripts de control en el directorio raiz para invocacion directa (./restart.sh, ./rollback.sh, etc.)
for script in start.sh stop.sh restart.sh status.sh refresh-cache.sh rollback.sh ecosystem.config.js; do
    if [ -f "$NEW_RELEASE_DIR/$script" ]; then
        cp -f "$NEW_RELEASE_DIR/$script" "$REMOTE_DIR/$script"
    fi
done
cd "$REMOTE_DIR"
sed -i 's/\r$//' *.sh 2>/dev/null || true
chmod +x *.sh 2>/dev/null || true

# 8. Reiniciar servicio (toma inmediatamente current/)
echo "--> [Remoto] Reiniciando servicio Dashboard..."
./restart.sh

# 9. Limpiar releases antiguas (conservar las ultimas 5 releases para rollback instantaneo)
if [ -d "$RELEASES_DIR" ]; then
    OLD_RELEASES=$(ls -1 "$RELEASES_DIR" 2>/dev/null | sort | head -n -5 || true)
    for old_rel in $OLD_RELEASES; do
        if [ -n "$old_rel" ] && [ "$old_rel" != "$RELEASE_ID" ]; then
            rm -rf "$RELEASES_DIR/$old_rel" 2>/dev/null || true
        fi
    done
fi

# 10. Verificar sondas de salud (/healthz y /readyz)
echo "--> [Remoto] Verificando sonda HTTP (http://127.0.0.1:3001/problemas/api/healthz)..."
HEALTH_OK=0
for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf --noproxy '*' http://127.0.0.1:3001/problemas/api/healthz >/dev/null 2>&1 || \
       curl -sf --noproxy '*' http://127.0.0.1:3001/problemas/healthz >/dev/null 2>&1; then
        HEALTH_OK=1
        break
    fi
    sleep 1
done

if [ "$HEALTH_OK" -ne 1 ]; then
    echo "ERROR: La sonda /healthz no respondio tras 10 segundos. Ejecutando rollback automatico..."
    ./rollback.sh || true
    exit 1
fi

echo "--> [Remoto] Respuesta de /problemas/api/readyz:"
curl -s --noproxy '*' http://127.0.0.1:3001/problemas/api/readyz || curl -s --noproxy '*' http://127.0.0.1:3001/problemas/readyz
echo ""
./status.sh
'@
$remoteDeployScript = $remoteDeployTemplate.Replace("__REMOTE_DIR__", $RemoteDir).Replace("__TMP_TAR__", $RemoteTmpTarball).Replace("`r`n", "`n")

# Si se pasa -IncludeBackend, integramos la actualizacion del Backend CSO en el mismo script SSH (1 sola sesion)
if ($IncludeBackend) {
    $ParentDir = Split-Path -Parent $ProjectRoot
    $LocalBackendDir = Join-Path $ParentDir "cso-incident-masivas-report\backend"
    $BackendMain = Join-Path $LocalBackendDir "main.py"
    $BackendSchemas = Join-Path $LocalBackendDir "schemas.py"
    $BackendService = Join-Path $LocalBackendDir "service.sh"
    $BackendExecPaths = Join-Path $LocalBackendDir "report_generator\executive_paths.py"

    if (-not (Test-Path $BackendMain -ErrorAction SilentlyContinue)) {
        Write-WarnMsg "No se encontro el repositorio hermano '$LocalBackendDir'. Omitiendo sincronizacion de backend."
    } else {
        $MainB64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($BackendMain))
        $SchemasB64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($BackendSchemas))
        $ServiceB64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($BackendService))
        $ExecPathsB64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($BackendExecPaths))

        $backendInlineTemplate = @'

echo ""
echo "--> [Remoto] Sincronizando cambios en Backend CSO (__REMOTE_BACKEND_DIR__)..."
mkdir -p "/infocodes/var/backups/cso-backend-rollback" "/infocodes/var/storage/executive_pptx" "/infocodes/var/run"
[ -f "__REMOTE_BACKEND_DIR__/main.py" ] && cp -p "__REMOTE_BACKEND_DIR__/main.py" "/infocodes/var/backups/cso-backend-rollback/main.py"
[ -f "__REMOTE_BACKEND_DIR__/schemas.py" ] && cp -p "__REMOTE_BACKEND_DIR__/schemas.py" "/infocodes/var/backups/cso-backend-rollback/schemas.py"
[ -f "__REMOTE_BACKEND_DIR__/service.sh" ] && cp -p "__REMOTE_BACKEND_DIR__/service.sh" "/infocodes/var/backups/cso-backend-rollback/service.sh"
[ -f "__REMOTE_BACKEND_DIR__/report_generator/executive_paths.py" ] && cp -p "__REMOTE_BACKEND_DIR__/report_generator/executive_paths.py" "/infocodes/var/backups/cso-backend-rollback/executive_paths.py"

echo "__MAIN_B64__" | base64 -d > "__REMOTE_BACKEND_DIR__/main.py"
echo "__SCHEMAS_B64__" | base64 -d > "__REMOTE_BACKEND_DIR__/schemas.py"
echo "__SERVICE_B64__" | base64 -d > "__REMOTE_BACKEND_DIR__/service.sh"
echo "__EXECPATHS_B64__" | base64 -d > "__REMOTE_BACKEND_DIR__/report_generator/executive_paths.py"

cd "__REMOTE_BACKEND_DIR__"
sed -i 's/\r$//' service.sh 2>/dev/null || true
chmod +x service.sh
./service.sh restart
./service.sh status
'@
        $backendInlineScript = $backendInlineTemplate.
            Replace("__REMOTE_BACKEND_DIR__", $RemoteBackendDir).
            Replace("__MAIN_B64__", $MainB64).
            Replace("__SCHEMAS_B64__", $SchemasB64).
            Replace("__SERVICE_B64__", $ServiceB64).
            Replace("__EXECPATHS_B64__", $ExecPathsB64).
            Replace("`r`n", "`n")

        $remoteDeployScript = $remoteDeployScript + "`n" + $backendInlineScript
    }
}

if ($DryRun) {
    Write-WarnMsg "[DryRun] Se ejecutaria por SSH (via Base64 -> bash) en ${TargetHost}:"
    Write-Host $remoteDeployScript -ForegroundColor DarkGray
} else {
    Invoke-RemoteBash -HostTarget $TargetHost -BashScript $remoteDeployScript
    if ($LASTEXITCODE -ne 0) {
        Write-Error "El despliegue remoto en $TargetHost fallo con codigo $LASTEXITCODE."
        exit $LASTEXITCODE
    }
}

$Stopwatch.Stop()
$ElapsedSec = [Math]::Round($Stopwatch.Elapsed.TotalSeconds, 1)

Write-Host ""
Write-Host "=================================================================" -ForegroundColor DarkGreen
Write-Host " [OK] DESPLIEGUE COMPLETADO CON EXITO EN ${ElapsedSec}s" -ForegroundColor Green
Write-Host "      URL Publica : http://infocodes.si.orange.es:8081/problemas" -ForegroundColor Gray
Write-Host "      Healthcheck : http://infocodes.si.orange.es:8081/problemas/api/healthz" -ForegroundColor Gray
Write-Host "      Readiness   : http://infocodes.si.orange.es:8081/problemas/api/readyz" -ForegroundColor Gray
Write-Host "=================================================================" -ForegroundColor DarkGreen
Write-Host ""
