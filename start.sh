#!/bin/sh
# Arranque en segundo plano de Gestión de Problemas Dashboard (puerto 3001)
# Fase 1.2: Almacenamiento de estado y caché desacoplado en /infocodes/var/
# Fase 2.2: Soporte de releases atómicas mediante symlink current -> releases/<timestamp>
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

if [ -d "$APP_DIR/current" ] && [ -f "$APP_DIR/current/server.js" ]; then
  RUN_DIR="$APP_DIR/current"
  ACTIVE_RELEASE="$(basename "$(readlink "$APP_DIR/current" 2>/dev/null || echo "current")")"
else
  RUN_DIR="$APP_DIR"
  ACTIVE_RELEASE="root"
fi

if [ -d "/infocodes" ]; then
  VAR_RUN_DIR="/infocodes/var/run"
  DEFAULT_CACHE_DIR="/infocodes/var/cache/problemas"
  mkdir -p "$VAR_RUN_DIR" "$DEFAULT_CACHE_DIR" 2>/dev/null || true
  PID_FILE="$VAR_RUN_DIR/gestion-problemas.pid"
  export CACHE_DIR="${CACHE_DIR:-$DEFAULT_CACHE_DIR}"

  # Migrar archivos de caché previos desde $APP_DIR/.cache o $RUN_DIR/.cache si no existen o son más recientes
  for src_cache in "$APP_DIR/.cache" "$RUN_DIR/.cache"; do
    if [ -d "$src_cache" ]; then
      for f in dashboard_stats.json jira_wiki_links.json; do
        if [ -f "$src_cache/$f" ]; then
          if [ ! -f "$CACHE_DIR/$f" ] || [ $(wc -c < "$CACHE_DIR/$f" 2>/dev/null || echo 0) -lt 100 ]; then
            cp -f "$src_cache/$f" "$CACHE_DIR/$f" 2>/dev/null || true
          fi
        fi
      done
    fi
  done
else
  PID_FILE="$APP_DIR/app.pid"
  export CACHE_DIR="${CACHE_DIR:-$APP_DIR/.cache}"
  mkdir -p "$CACHE_DIR" 2>/dev/null || true
fi

# Asegurar que credenciales compartidas en shared/.env.local estén enlazadas en RUN_DIR
if [ -f "$APP_DIR/shared/.env.local" ] && [ "$RUN_DIR" != "$APP_DIR" ]; then
  ln -sfn "$APP_DIR/shared/.env.local" "$RUN_DIR/.env.local" 2>/dev/null || true
fi
if [ -f "$APP_DIR/shared/.env.production.local" ] && [ "$RUN_DIR" != "$APP_DIR" ]; then
  ln -sfn "$APP_DIR/shared/.env.production.local" "$RUN_DIR/.env.production.local" 2>/dev/null || true
fi

LEGACY_PID_FILE="$APP_DIR/app.pid"
LOG_FILE="$APP_DIR/app.log"

# Asegurar node en PATH si está en /infocodes/nodejs/bin
if [ -d "/infocodes/nodejs/bin" ]; then
  export PATH="/infocodes/nodejs/bin:$PATH"
fi

for pf in "$PID_FILE" "$LEGACY_PID_FILE"; do
  if [ -f "$pf" ]; then
    PID=$(cat "$pf" 2>/dev/null)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
      echo "[INFO] La aplicación ya está en ejecución (PID $PID)"
      exit 0
    fi
  fi
done

# Variables de entorno por defecto
export NODE_ENV=production
export PORT=3001
export HOSTNAME="0.0.0.0"
export NEXT_PUBLIC_BASE_PATH=/problemas

cd "$RUN_DIR"
nohup node server.js >> "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"
# Mantener copia en app.pid local para compatibilidad hacia atrás
if [ "$PID_FILE" != "$LEGACY_PID_FILE" ]; then
  echo "$NEW_PID" > "$LEGACY_PID_FILE" 2>/dev/null || true
fi

echo "=========================================================="
echo "✓ Dashboard de Gestión de Problemas iniciado"
echo "  PID:       $(cat "$PID_FILE")"
echo "  Release:   $ACTIVE_RELEASE"
echo "  Puerto:    3001"
echo "  Caché Dir: $CACHE_DIR"
echo "  PID File:  $PID_FILE"
echo "  Log:       $LOG_FILE"
echo "  URL:       http://infocodes.si.orange.es:8081/problemas"
echo "=========================================================="
