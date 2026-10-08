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

console.log('[Standalone] ✓ Carpeta .next/standalone lista para ejecución autónoma.');
