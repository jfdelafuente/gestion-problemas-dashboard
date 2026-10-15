import { getDashboardStats, DashboardStats } from '@/lib/jira';
import { getCacheDir, getDashboardCacheFile } from '@/lib/cache-paths';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';

interface CacheEntry {
  data: DashboardStats;
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos de caché

function loadPersistentStats(): CacheEntry | null {
  try {
    const cacheFile = getDashboardCacheFile();
    if (fs.existsSync(cacheFile)) {
      const raw = fs.readFileSync(cacheFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data && parsed.timestamp) {
        return parsed as CacheEntry;
      }
    }
  } catch (err) {
    console.warn('No se pudo cargar la caché de dashboard desde disco:', err);
  }
  return null;
}

function savePersistentStats(entry: CacheEntry) {
  try {
    const cacheDir = getCacheDir();
    const cacheFile = getDashboardCacheFile();
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(cacheFile, JSON.stringify(entry), 'utf-8');
  } catch (err) {
    console.warn('No se pudo guardar la caché de dashboard en disco:', err);
  }
}

let cachedStats: CacheEntry | null = loadPersistentStats();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true' || searchParams.get('refresh') === '1';

    const now = Date.now();
    const resilientCacheControl = 'public, max-age=60, stale-while-revalidate=300, stale-if-error=86400';

    if (!forceRefresh && cachedStats && now - cachedStats.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedStats.data, {
        headers: {
          'Cache-Control': resilientCacheControl,
          'X-Cache': 'HIT',
          'X-Cached-At': new Date(cachedStats.timestamp).toISOString(),
        },
      });
    }

    const stats = await getDashboardStats();
    if (stats?.issues && stats.issues.length > 0) {
      cachedStats = {
        data: stats,
        timestamp: now,
      };
      savePersistentStats(cachedStats);
    }

    return NextResponse.json(cachedStats ? cachedStats.data : stats, {
      headers: {
        'Cache-Control': forceRefresh ? 'no-store, max-age=0' : resilientCacheControl,
        'X-Cache': 'MISS',
        ...(cachedStats ? { 'X-Cached-At': new Date(cachedStats.timestamp).toISOString() } : {}),
      },
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    if (!cachedStats) {
      cachedStats = loadPersistentStats();
    }
    if (cachedStats) {
      console.warn('Returning stale cache due to Jira error');
      return NextResponse.json(cachedStats.data, {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=300, stale-if-error=86400',
          'X-Cache': 'STALE',
          'X-Cached-At': new Date(cachedStats.timestamp).toISOString(),
        },
      });
    }
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

