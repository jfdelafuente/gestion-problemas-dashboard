// Config de pm2 (modo usuario, sin systemd/root) para el despliegue en
// infocodes.si.orange.es. Ver DEPLOY.md para el procedimiento completo.
const fs = require('fs');
const path = require('path');

// En despliegue standalone se ejecuta directamente server.js con Node puro.
// Si no existe server.js (entorno legacy sin compilar en local), usa next start.
const isStandalone = fs.existsSync(path.join(__dirname, 'server.js'));

module.exports = {
  apps: [
    {
      name: 'gestion-problemas-dashboard',
      script: isStandalone ? 'server.js' : 'node_modules/next/dist/bin/next',
      args: isStandalone ? '' : 'start -p 3001',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        NEXT_PUBLIC_BASE_PATH: '/problemas',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
