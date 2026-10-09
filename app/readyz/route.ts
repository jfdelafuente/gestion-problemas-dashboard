import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const BACKEND_URL = process.env.BACKEND_REPORTS_URL || 'http://localhost:8000';
const CACHE_FILE = path.join(process.cwd(), '.cache', 'dashboard_stats.json');

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'degraded' | 'unavailable'; message?: string; details?: unknown }> = {};

  // 1. Comprobar caché local de Jira
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const stats = fs.statSync(CACHE_FILE);
      const ageMinutes = Math.round((Date.now() - stats.mtimeMs) / (1000 * 60));
      checks.jiraCache = {
        status: 'ok',
        message: `Caché disponible (${(stats.size / 1024).toFixed(1)} KB, actualizada hace ${ageMinutes} min)`,
        details: { sizeBytes: stats.size, ageMinutes, mtime: stats.mtime.toISOString() },
      };
    } else {
      checks.jiraCache = {
        status: 'degraded',
        message: 'No existe archivo de caché local aún (se creará en la primera consulta exitosa a Jira)',
      };
    }
  } catch (err) {
    checks.jiraCache = {
      status: 'degraded',
      message: `Error accediendo a caché local: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 2. Comprobar servicio de reporting FastAPI
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${BACKEND_URL}/healthz`, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);

    if (resp && resp.ok) {
      checks.reportingBackend = {
        status: 'ok',
        message: `Servicio de reporting conectado en ${BACKEND_URL}`,
      };
    } else {
      checks.reportingBackend = {
        status: 'degraded',
        message: `Servicio de reporting en ${BACKEND_URL} no responde o devolvió estado ${resp ? resp.status : 'timeout'}`,
      };
    }
  } catch (err) {
    checks.reportingBackend = {
      status: 'degraded',
      message: `No se pudo conectar con el backend de reporting en ${BACKEND_URL}`,
    };
  }

  const isDegraded = Object.values(checks).some((c) => c.status === 'degraded' || c.status === 'unavailable');

  return NextResponse.json(
    {
      status: isDegraded ? 'degraded' : 'ready',
      service: 'gestion-problemas-dashboard',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      checks,
    },
    { status: isDegraded ? 200 : 200 }
  );
}
