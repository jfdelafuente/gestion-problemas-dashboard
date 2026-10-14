#!/bin/sh
# Comprobación de estado de Gestión de Problemas Dashboard
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -d "/infocodes" ]; then
  PID_FILE="/infocodes/var/run/gestion-problemas.pid"
  CACHE_DIR="${CACHE_DIR:-/infocodes/var/cache/problemas}"
else
  PID_FILE="$APP_DIR/app.pid"
  CACHE_DIR="${CACHE_DIR:-$APP_DIR/.cache}"
fi
LEGACY_PID_FILE="$APP_DIR/app.pid"
LOG_FILE="$APP_DIR/app.log"

for pf in "$PID_FILE" "$LEGACY_PID_FILE"; do
  if [ -f "$pf" ]; then
    PID=$(cat "$pf" 2>/dev/null)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
      echo "● ESTADO: ACTIVO (PID $PID en puerto 3001)"
      if [ -L "$APP_DIR/current" ]; then
        echo "  Release:   $(readlink "$APP_DIR/current" 2>/dev/null)"
      fi
      echo "  PID File:  $pf"
      echo "  Caché Dir: $CACHE_DIR"
      echo "--- Últimas líneas de app.log ---"
      tail -n 20 "$LOG_FILE" 2>/dev/null
      exit 0
    fi
  fi
done

echo "○ ESTADO: DETENIDO"
if [ -f "$LOG_FILE" ]; then
  echo "--- Últimas líneas de app.log ---"
  tail -n 10 "$LOG_FILE" 2>/dev/null
fi
