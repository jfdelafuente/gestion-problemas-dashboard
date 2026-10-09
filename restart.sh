#!/bin/sh
# Reinicio de Gestión de Problemas Dashboard
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
"$APP_DIR/stop.sh"
sleep 1
"$APP_DIR/start.sh"
