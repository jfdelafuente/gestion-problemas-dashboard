/**
 * Prepara la carpeta .next/standalone copiando los assets estáticos requeridos
 * según la especificación oficial de Next.js Standalone:
 * - public/ -> .next/standalone/public/
 * - .next/static/ -> .next/standalone/.next/static/
 * - ecosystem.config.js -> .next/standalone/ecosystem.config.js
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');

console.log('[Standalone] Preparando paquete autónomo...');

if (!fs.existsSync(standaloneDir)) {
  console.error('[Standalone] ERROR: .next/standalone no existe. Ejecuta "npm run build" primero.');
  process.exit(1);
}

// 1. Copiar carpeta public si existe
const publicSrc = path.join(rootDir, 'public');
const publicDest = path.join(standaloneDir, 'public');
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });
  console.log('✓ Copiado public/ -> .next/standalone/public/');
}

// 2. Copiar carpeta .next/static
const staticSrc = path.join(rootDir, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
if (fs.existsSync(staticSrc)) {
  fs.cpSync(staticSrc, staticDest, { recursive: true, force: true });
  console.log('✓ Copiado .next/static/ -> .next/standalone/.next/static/');
}

// 3. Copiar ecosystem.config.js para arranque directo con PM2 en servidor
const ecosystemSrc = path.join(rootDir, 'ecosystem.config.js');
const ecosystemDest = path.join(standaloneDir, 'ecosystem.config.js');
if (fs.existsSync(ecosystemSrc)) {
  fs.copyFileSync(ecosystemSrc, ecosystemDest);
  console.log('✓ Copiado ecosystem.config.js -> .next/standalone/ecosystem.config.js');
}

// 4. Copiar .cache persistente si existe (para renderizado inmediato de datos sin esperar a Jira)
const cacheSrc = path.join(rootDir, '.cache');
const cacheDest = path.join(standaloneDir, '.cache');
if (fs.existsSync(cacheSrc)) {
  fs.cpSync(cacheSrc, cacheDest, { recursive: true, force: true });
  console.log('✓ Copiado .cache/ -> .next/standalone/.cache/ (datos históricos listos)');
}

// 5. Copiar .env.local si existe para que las credenciales de Jira estén disponibles de inmediato
const envLocalSrc = path.join(rootDir, '.env.local');
const envLocalDest = path.join(standaloneDir, '.env.local');
if (fs.existsSync(envLocalSrc)) {
  fs.copyFileSync(envLocalSrc, envLocalDest);
  console.log('✓ Copiado .env.local -> .next/standalone/.env.local (configuración de Jira)');
}

const envExampleSrc = path.join(rootDir, '.env.example');
const envExampleDest = path.join(standaloneDir, '.env.example');
if (fs.existsSync(envExampleSrc)) {
  fs.copyFileSync(envExampleSrc, envExampleDest);
}

// 6. Copiar scripts de gestión de proceso en segundo plano (no requieren pm2 ni red)
const controlScripts = ['start.sh', 'stop.sh', 'restart.sh', 'status.sh'];
for (const scriptName of controlScripts) {
  const src = path.join(rootDir, scriptName);
  const dest = path.join(standaloneDir, scriptName);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ Copiado ${scriptName} -> .next/standalone/${scriptName}`);
  }
}

console.log('[Standalone] ✓ Carpeta .next/standalone lista para ejecución autónoma.');

