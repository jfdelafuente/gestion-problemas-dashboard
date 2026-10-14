#!/bin/sh
# Refresco programado de la caché de Jira para Gestión de Problemas Dashboard
# Diseñado para ejecutarse periódicamente desde crontab

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="$APP_DIR/cron.log"
if [ -d "/infocodes" ]; then
  PID_FILE="/infocodes/var/run/gestion-problemas.pid"
  CACHE_DIR="${CACHE_DIR:-/infocodes/var/cache/problemas}"
else
  PID_FILE="$APP_DIR/app.pid"
  CACHE_DIR="${CACHE_DIR:-$APP_DIR/.cache}"
fi
LEGACY_PID_FILE="$APP_DIR/app.pid"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# Asegurar node/curl en PATH
if [ -d "/infocodes/nodejs/bin" ]; then
  export PATH="/infocodes/nodejs/bin:$PATH"
fi

echo "==========================================================" >> "$LOG_FILE"
echo "[$TIMESTAMP] Iniciando refresco de caché Jira (destino: $CACHE_DIR)..." >> "$LOG_FILE"

# 1. Comprobar si la aplicación está levantada; si no, levantarla
IS_RUNNING=0
for pf in "$PID_FILE" "$LEGACY_PID_FILE"; do
  if [ -f "$pf" ]; then
    PID=$(cat "$pf" 2>/dev/null)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
      IS_RUNNING=1
      break
    fi
  fi
done

if [ "$IS_RUNNING" -eq 0 ]; then
  echo "[$TIMESTAMP] [AVISO] El servicio no estaba corriendo. Levantando con start.sh..." >> "$LOG_FILE"
  "$APP_DIR/start.sh" >> "$LOG_FILE" 2>&1
  sleep 4
fi

# 2. Petición de refresco forzado al endpoint interno (timeout 300s para descarga completa de Jira)
START_TIME=$(date +%s)
HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 300 "http://127.0.0.1:3001/problemas/api/dashboard?refresh=true")
HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -n1)
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ "$HTTP_CODE" = "200" ]; then
  echo "[$TIMESTAMP] ✓ Caché actualizada con éxito en ${DURATION}s (HTTP 200)" >> "$LOG_FILE"
  echo "[$TIMESTAMP] Archivos persistidos en $CACHE_DIR/" >> "$LOG_FILE"
else
  # Intento de reintento vía Nginx (puerto 8081)
  HTTP_CODE_NGINX=$(curl -s -o /dev/null -w "%{http_code}" --max-time 300 "http://127.0.0.1:8081/problemas/api/dashboard?refresh=true")
  if [ "$HTTP_CODE_NGINX" = "200" ]; then
    echo "[$TIMESTAMP] ✓ Caché actualizada vía Nginx en ${DURATION}s (HTTP 200)" >> "$LOG_FILE"
    echo "[$TIMESTAMP] Archivos persistidos en $CACHE_DIR/" >> "$LOG_FILE"
  else
    echo "[$TIMESTAMP] ✗ ERROR al refrescar la caché: HTTP 3001=$HTTP_CODE, Nginx 8081=$HTTP_CODE_NGINX" >> "$LOG_FILE"
  fi
fi
