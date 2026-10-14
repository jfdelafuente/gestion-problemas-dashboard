#!/bin/sh
# Parada de Gestión de Problemas Dashboard
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -d "/infocodes/var/run" ]; then
  PID_FILE="/infocodes/var/run/gestion-problemas.pid"
else
  PID_FILE="$APP_DIR/app.pid"
fi
LEGACY_PID_FILE="$APP_DIR/app.pid"

STOPPED=0
for pf in "$PID_FILE" "$LEGACY_PID_FILE"; do
  if [ -f "$pf" ]; then
    PID=$(cat "$pf" 2>/dev/null)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
      echo "[INFO] Deteniendo PID $PID..."
      kill "$PID" 2>/dev/null
      sleep 1
      if kill -0 "$PID" 2>/dev/null; then
        kill -9 "$PID" 2>/dev/null
      fi
      STOPPED=1
    fi
    rm -f "$pf"
  fi
done

if [ "$STOPPED" -eq 0 ]; then
  pkill -f "node.*server.js" 2>/dev/null || true
fi
echo "[OK] Aplicación detenida."
