#!/bin/sh
# Comprobación de estado de Gestión de Problemas Dashboard
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$APP_DIR/app.pid"
LOG_FILE="$APP_DIR/app.log"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "● ESTADO: ACTIVO (PID $PID en puerto 3001)"
    echo "--- Últimas líneas de app.log ---"
    tail -n 20 "$LOG_FILE" 2>/dev/null
    exit 0
  fi
fi

echo "○ ESTADO: DETENIDO"
if [ -f "$LOG_FILE" ]; then
  echo "--- Últimas líneas de app.log ---"
  tail -n 10 "$LOG_FILE" 2>/dev/null
fi

