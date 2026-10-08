import { getDashboardStats, DashboardStats } from '@/lib/jira';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface CacheEntry {
  data: DashboardStats;
  timestamp: number;
}

const CACHE_DIR = path.join(process.cwd(), '.cache');
const DASHBOARD_CACHE_FILE = path.join(CACHE_DIR, 'dashboard_stats.json');
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos de caché

function loadPersistentStats(): CacheEntry | null {
  try {
    if (fs.existsSync(DASHBOARD_CACHE_FILE)) {
      const raw = fs.readFileSync(DASHBOARD_CACHE_FILE, 'utf-8');
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
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(DASHBOARD_CACHE_FILE, JSON.stringify(entry), 'utf-8');
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
    if (!forceRefresh && cachedStats && now - cachedStats.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedStats.data, {
        headers: {
          'Cache-Control': 'public, max-age=60',
          'X-Cache': 'HIT',
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
        'Cache-Control': 'no-store, max-age=0',
        'X-Cache': 'MISS',
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
          'X-Cache': 'STALE',
        },
      });
    }
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}

