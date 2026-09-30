import { getDashboardStats, DashboardStats } from '@/lib/jira';
import { NextRequest, NextResponse } from 'next/server';

interface CacheEntry {
  data: DashboardStats;
  timestamp: number;
}

let cachedStats: CacheEntry | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos de caché en memoria

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
    cachedStats = {
      data: stats,
      timestamp: now,
    };

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
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

