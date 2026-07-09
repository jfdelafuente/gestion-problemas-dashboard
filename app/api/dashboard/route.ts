import { getDashboardStats } from '@/lib/jira';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const stats = await getDashboardStats();

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
