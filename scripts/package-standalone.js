/**
 * Empaqueta la aplicación Next.js standalone en un archivo comprimido .tar.gz
 * listo para desplegar en producción (infocodes.si.orange.es) sin compilar en el servidor.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const standaloneDir = path.join(rootDir, '.next', 'standalone');
const tarballPath = path.join(distDir, 'gestion-problemas-standalone.tar.gz');

console.log('===========================================================');
console.log('   Empaquetador Standalone - Gestión de Problemas         ');
console.log('===========================================================');

// 1. Preparar assets estáticos en .next/standalone
require('./prepare-standalone');

// 2. Asegurar que existe dist/
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 3. Crear el archivo tar.gz
console.log('\n[Empaquetando] Comprimiendo .next/standalone en tar.gz...');
try {
  // tar disponible en Windows 10+ y Linux/macOS (--force-local evita que GNU tar confunda C: con un host remoto)
  execSync('tar --force-local -czf "dist/gestion-problemas-standalone.tar.gz" -C ".next/standalone" .', {
    stdio: 'inherit',
    cwd: rootDir,
  });
} catch (err) {
  console.error('[Empaquetando] ERROR al crear el archivo tar.gz:', err.message);
  process.exit(1);
}

const stats = fs.statSync(tarballPath);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log('\n===========================================================');
console.log(`✓ Artefacto generado con éxito:`);
console.log(`  Ruta: ${tarballPath}`);
console.log(`  Tamaño: ${sizeMB} MB`);
console.log('===========================================================');
console.log('\nInstrucciones para desplegar en el servidor de producción:');
console.log('-----------------------------------------------------------');
console.log('1. Subir por scp desde tu terminal local:');
console.log(`   scp "${tarballPath}" infocodes@10.132.26.96:/infocodes/project/gestion-problemas-dashboard/`);
console.log('\n2. En el servidor (usuario infocodes):');
console.log('   cd /infocodes/project/gestion-problemas-dashboard');
console.log('   tar -xzf gestion-problemas-standalone.tar.gz');
console.log('   rm gestion-problemas-standalone.tar.gz');
console.log('   npx pm2 restart ecosystem.config.js || npx pm2 start ecosystem.config.js');
console.log('   npx pm2 save');
console.log('===========================================================\n');
