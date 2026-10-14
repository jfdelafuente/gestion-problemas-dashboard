import fs from 'fs';
import path from 'path';

const DEFAULT_PROD_VAR_DIR = '/infocodes/var';
const DEFAULT_PROD_CACHE_DIR = '/infocodes/var/cache/problemas';

let migrationExecuted = false;

/**
 * Determina el directorio de caché persistente para Jira y WikiPageLinks.
 * Prioridad:
 * 1. Variable de entorno CACHE_DIR
 * 2. En servidor de producción (/infocodes disponible): /infocodes/var/cache/problemas
 * 3. En desarrollo local: <process.cwd()>/.cache
 */
export function getCacheDir(): string {
  const localCacheDir = path.join(/*turbopackIgnore: true*/ process.cwd(), '.cache');

  let targetDir: string;
  if (process.env.CACHE_DIR && process.env.CACHE_DIR.trim() !== '') {
    targetDir = path.resolve(/*turbopackIgnore: true*/ process.env.CACHE_DIR.trim());
  } else if (process.platform !== 'win32' && fs.existsSync('/infocodes')) {
    targetDir = DEFAULT_PROD_CACHE_DIR;
  } else {
    targetDir = localCacheDir;
  }

  // Asegurar que el directorio existe y migrar ficheros desde .cache/ local si aplica
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    if (!migrationExecuted && path.resolve(targetDir) !== path.resolve(localCacheDir)) {
      migrationExecuted = true;
      migrateCacheFilesIfNeeded(localCacheDir, targetDir);
    }
  } catch (err) {
    console.warn(`[CachePaths] No se pudo inicializar ${targetDir}, usando fallback local ${localCacheDir}:`, err);
    return localCacheDir;
  }

  return targetDir;
}

/**
 * Si el directorio externo (/infocodes/var/cache/problemas) aún no tiene los archivos
 * de caché (o si el paquete recién desplegado incluye una semilla más reciente),
 * copia los archivos sin pérdida de datos.
 */
function migrateCacheFilesIfNeeded(sourceDir: string, targetDir: string): void {
  if (!fs.existsSync(sourceDir)) return;

  const filesToMigrate = ['dashboard_stats.json', 'jira_wiki_links.json'];
  for (const fileName of filesToMigrate) {
    const srcFile = path.join(sourceDir, fileName);
    const destFile = path.join(targetDir, fileName);
    try {
      if (!fs.existsSync(srcFile)) continue;

      if (!fs.existsSync(destFile)) {
        fs.copyFileSync(srcFile, destFile);
        console.log(`[CachePaths] Migrado ${fileName} -> ${destFile}`);
      } else {
        // Si ambos existen, conservar el más reciente o reparar si el destino está vacío/corrupto (<100 bytes)
        const srcStat = fs.statSync(srcFile);
        const destStat = fs.statSync(destFile);
        if ((destStat.size < 100 || srcStat.mtimeMs > destStat.mtimeMs) && srcStat.size > 100) {
          fs.copyFileSync(srcFile, destFile);
          console.log(`[CachePaths] Actualizado/reparado ${fileName} en ${destFile} (${srcStat.size} bytes)`);
        }
      }
    } catch (err) {
      console.warn(`[CachePaths] Aviso al migrar ${fileName}:`, err);
    }
  }
}

export function getDashboardCacheFile(): string {
  return path.join(getCacheDir(), 'dashboard_stats.json');
}

export function getWikiLinksCacheFile(): string {
  return path.join(getCacheDir(), 'jira_wiki_links.json');
}

export { DEFAULT_PROD_VAR_DIR, DEFAULT_PROD_CACHE_DIR };

