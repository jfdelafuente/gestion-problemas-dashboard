#!/bin/sh
# Arranque en segundo plano de Gestión de Problemas Dashboard (puerto 3001)
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

PID_FILE="$APP_DIR/app.pid"
LOG_FILE="$APP_DIR/app.log"

# Asegurar node en PATH si está en /infocodes/nodejs/bin
if [ -d "/infocodes/nodejs/bin" ]; then
  export PATH="/infocodes/nodejs/bin:$PATH"
fi

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "[INFO] La aplicación ya está en ejecución (PID $PID)"
    exit 0
  fi
fi

# Variables de entorno por defecto
export NODE_ENV=production
export PORT=3001
export HOSTNAME="0.0.0.0"
export NEXT_PUBLIC_BASE_PATH=/problemas

nohup node server.js >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "=========================================================="
echo "✓ Dashboard de Gestión de Problemas iniciado"
echo "  PID:     $(cat "$PID_FILE")"
echo "  Puerto:  3001"
echo "  Log:     $LOG_FILE"
echo "  URL:     http://infocodes.si.orange.es:8081/problemas"
echo "=========================================================="

