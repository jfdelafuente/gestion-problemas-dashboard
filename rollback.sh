#!/bin/sh
# Rollback instantáneo de Gestión de Problemas Dashboard (Fase 2.2)
# Cambia el symlink "current" a la release previa en releases/ (o acepta un ID de release por parámetro)
# y reinicia el servicio en ~1 segundo. Si no existen múltiples releases, restaura desde /infocodes/var/backups/.
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
RELEASES_DIR="$APP_DIR/releases"
CURRENT_LINK="$APP_DIR/current"
BACKUP_TAR="/infocodes/var/backups/problemas-rollback.tar.gz"
TARGET_RELEASE="$1"

cd "$APP_DIR"

if [ -d "$RELEASES_DIR" ]; then
  if [ -n "$TARGET_RELEASE" ]; then
    if [ ! -d "$RELEASES_DIR/$TARGET_RELEASE" ]; then
      echo "[ERROR] No existe la release solicitada: $RELEASES_DIR/$TARGET_RELEASE"
      echo "Releases disponibles:"
      ls -1 "$RELEASES_DIR" 2>/dev/null || true
      exit 1
    fi
    PREV_RELEASE="$TARGET_RELEASE"
  else
    # Detectar release actual apuntada por current
    ACTIVE_RELEASE=""
    if [ -L "$CURRENT_LINK" ]; then
      ACTIVE_TARGET="$(readlink "$CURRENT_LINK" 2>/dev/null || true)"
      ACTIVE_RELEASE="$(basename "$ACTIVE_TARGET")"
    fi

    # Listar releases ordenadas cronológicamente y elegir la inmediatamente anterior a la activa
    PREV_RELEASE=""
    for rel in $(ls -1 "$RELEASES_DIR" 2>/dev/null | sort); do
      if [ -f "$RELEASES_DIR/$rel/server.js" ]; then
        if [ "$rel" != "$ACTIVE_RELEASE" ]; then
          PREV_RELEASE="$rel"
        fi
      fi
    done
  fi

  if [ -n "$PREV_RELEASE" ] && [ -f "$RELEASES_DIR/$PREV_RELEASE/server.js" ]; then
    echo "=========================================================="
    echo "↺ Ejecutando Rollback Atómico por Symlink (Fase 2.2)"
    echo "  Release anterior : ${ACTIVE_RELEASE:-N/A}"
    echo "  Release destino  : $PREV_RELEASE"
    echo "=========================================================="

    # Asegurar enlaces a configuración compartida
    if [ -f "$APP_DIR/shared/.env.local" ]; then
      ln -sfn "$APP_DIR/shared/.env.local" "$RELEASES_DIR/$PREV_RELEASE/.env.local"
    fi
    if [ -f "$APP_DIR/shared/.env.production.local" ]; then
      ln -sfn "$APP_DIR/shared/.env.production.local" "$RELEASES_DIR/$PREV_RELEASE/.env.production.local"
    fi

    # Cambio atómico del symlink current
    ln -sfn "releases/$PREV_RELEASE" "$CURRENT_LINK"

    # Sincronizar scripts de control al nivel superior si están presentes en la release
    for script in start.sh stop.sh restart.sh status.sh refresh-cache.sh; do
      if [ -f "$RELEASES_DIR/$PREV_RELEASE/$script" ]; then
        cp -f "$RELEASES_DIR/$PREV_RELEASE/$script" "$APP_DIR/$script"
      fi
    done
    sed -i 's/\r$//' "$APP_DIR"/*.sh 2>/dev/null || true
    chmod +x "$APP_DIR"/*.sh 2>/dev/null || true

    ./restart.sh
    echo "[OK] Rollback completado a release $PREV_RELEASE"
    exit 0
  fi
fi

# Fallback: restaurar desde snapshot tar.gz si no había una segunda release en releases/
if [ -f "$BACKUP_TAR" ]; then
  echo "--> [Rollback Fallback] Restaurando desde snapshot $BACKUP_TAR..."
  if [ -x ./stop.sh ]; then
    ./stop.sh || true
  fi
  FALLBACK_ID="rollback_$(date +%Y%m%d_%H%M%S)"
  mkdir -p "$RELEASES_DIR/$FALLBACK_ID"
  tar -xzf "$BACKUP_TAR" -C "$RELEASES_DIR/$FALLBACK_ID"
  if [ -f "$APP_DIR/shared/.env.local" ]; then
    ln -sfn "$APP_DIR/shared/.env.local" "$RELEASES_DIR/$FALLBACK_ID/.env.local"
  fi
  ln -sfn "releases/$FALLBACK_ID" "$CURRENT_LINK"
  sed -i 's/\r$//' "$APP_DIR"/*.sh 2>/dev/null || true
  chmod +x "$APP_DIR"/*.sh 2>/dev/null || true
  ./restart.sh
  echo "[OK] Rollback restaurado desde $BACKUP_TAR en release $FALLBACK_ID"
  exit 0
fi

echo "[ERROR] No se encontró ninguna release previa en $RELEASES_DIR ni backup en $BACKUP_TAR"
exit 1

