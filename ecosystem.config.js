// Config de pm2 (modo usuario, sin systemd/root) para el despliegue en
// infocodes.si.orange.es. Ver DEPLOY.md para el procedimiento completo.
module.exports = {
  apps: [
    {
      name: 'gestion-problemas-dashboard',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_BASE_PATH: '/problemas',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
