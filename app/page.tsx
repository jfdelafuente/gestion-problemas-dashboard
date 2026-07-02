'use client';

import { useState, useEffect } from 'react';
import StatsCard from '@/components/StatsCard';
import StateAndPriorityChart from '@/components/StateAndPriorityChart';
import TimelineChart from '@/components/TimelineChart';
import FilterBar from '@/components/FilterBar';

interface DashboardStats {
  totalOpen: number;
  totalClosed: number;
  byState: Record<string, number>;
  byPriority: Record<string, number>;
  timeline: Array<{ date: string; created: number; closed: number }>;
}

const INITIAL_STATS: DashboardStats = {
  totalOpen: 0,
  totalClosed: 0,
  byState: {},
  byPriority: {},
  timeline: [],
};

export default function Home() {
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(30);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/dashboard?days=${selectedDays}`);
      if (!response.ok) {
        throw new Error('Error fetching dashboard stats');
      }
      const data = await response.json();
      setStats(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Auto-refresh every hour
    const interval = setInterval(fetchStats, 3600000);
    return () => clearInterval(interval);
  }, [selectedDays]);

  const handleDateRangeChange = (days: number) => {
    setSelectedDays(days);
  };

  const total = stats.totalOpen + stats.totalClosed;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {process.env.NEXT_PUBLIC_DASHBOARD_TITLE || 'Dashboard de Problemas'}
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                KPIs principales de issues de tipo problema
              </p>
            </div>
            <div className="text-right">
              <button
                onClick={fetchStats}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Actualizar
              </button>
              {lastUpdated && (
                <p className="text-gray-500 text-xs mt-2">
                  Actualizado: {lastUpdated.toLocaleTimeString('es-ES')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <FilterBar onDateRangeChange={handleDateRangeChange} selectedDays={selectedDays} />

        {loading ? (
          <div className="flex justify-center items-center h-96">
            <div className="text-gray-500">Cargando datos...</div>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <StatsCard label="Problemas Abiertos" value={stats.totalOpen} color="#ef4444" />
              <StatsCard label="Problemas Cerrados" value={stats.totalClosed} color="#10b981" />
              <StatsCard label="Total" value={total} color="#3b82f6" />
            </div>

            {/* Charts */}
            <StateAndPriorityChart
              byState={stats.byState}
              byPriority={stats.byPriority}
            />
            <TimelineChart data={stats.timeline} />
          </>
        )}
      </div>
    </div>
  );
}
