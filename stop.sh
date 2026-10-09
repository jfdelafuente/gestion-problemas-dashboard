#!/bin/sh
# Parada de Gestión de Problemas Dashboard
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$APP_DIR/app.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "[INFO] Deteniendo PID $PID..."
    kill "$PID" 2>/dev/null
    sleep 1
    if kill -0 "$PID" 2>/dev/null; then
      kill -9 "$PID" 2>/dev/null
    fi
  fi
  rm -f "$PID_FILE"
else
  pkill -f "node.*server.js" 2>/dev/null || true
fi
echo "[OK] Aplicación detenida."

