// Config de pm2 (modo usuario, sin systemd/root) para el despliegue en
// infocodes.si.orange.es. Ver DEPLOY.md para el procedimiento completo.
const fs = require('fs');
const path = require('path');

// En despliegue standalone se ejecuta directamente server.js con Node puro.
// Si no existe server.js (entorno legacy sin compilar en local), usa next start.
const isStandalone = fs.existsSync(path.join(__dirname, 'server.js'));

// Función utilitaria para leer variables de archivos .env sin dependencias externas
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  }
  return env;
}

const envDefaults = parseEnvFile(path.join(__dirname, '.env'));
const envLocal = parseEnvFile(path.join(__dirname, '.env.local'));
const fileEnvs = { ...envDefaults, ...envLocal };

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
        HOSTNAME: '0.0.0.0',
        NEXT_PUBLIC_BASE_PATH: '/problemas',
        NEXT_PUBLIC_JIRA_DOMAIN: 'jiranext.masorange.es',
        NEXT_PUBLIC_JIRA_PROJECT_KEY: 'PROB',
        BACKEND_REPORTS_URL: 'http://localhost:8000',
        ...fileEnvs,
        ...process.env,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
