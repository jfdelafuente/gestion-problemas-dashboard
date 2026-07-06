'use client';

import { useState, useEffect, useMemo } from 'react';
import StatsCard from '@/components/StatsCard';
import StateAndPriorityChart from '@/components/StateAndPriorityChart';
import TimelineChart from '@/components/TimelineChart';
import FilterBar from '@/components/FilterBar';
import IssuesTable from '@/components/IssuesTable';

interface SubtaskRow {
  key: string;
  summary: string;
  status: string;
  priority: string;
  done: boolean;
  actionPointType?: string;
  assignedGroup?: string;
}

interface DashboardIssueRow {
  key: string;
  summary: string;
  status: string;
  priority: string;
  type: string;
  created: string;
  resolutiondate?: string;
  assignedGroup: string;
  involvedGroups: string;
  resolvingGroups: string;
  subtasksTotal: number;
  subtasksDone: number;
  subtasks: SubtaskRow[];
}

interface DashboardStats {
  totalOpen: number;
  totalClosed: number;
  byState: Record<string, number>;
  byPriority: Record<string, number>;
  timeline: Array<{ date: string; created: number; closed: number }>;
  issues: DashboardIssueRow[];
}

const INITIAL_STATS: DashboardStats = {
  totalOpen: 0,
  totalClosed: 0,
  byState: {},
  byPriority: {},
  timeline: [],
  issues: [],
};

function buildStatsFromIssues(issues: DashboardIssueRow[]) {
  const byState: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  let totalOpen = 0;
  let totalClosed = 0;
  let resolvedCount = 0;
  let resolvedDaysSum = 0;

  issues.forEach((issue) => {
    byState[issue.status] = (byState[issue.status] || 0) + 1;
    byPriority[issue.priority] = (byPriority[issue.priority] || 0) + 1;

    if (issue.resolutiondate) {
      totalClosed++;
      const days = (new Date(issue.resolutiondate).getTime() - new Date(issue.created).getTime()) / (1000 * 60 * 60 * 24);
      resolvedDaysSum += days;
      resolvedCount++;
    } else {
      totalOpen++;
    }
  });

  return {
    byState,
    byPriority,
    totalOpen,
    totalClosed,
    avgResolutionDays: resolvedCount > 0 ? resolvedDaysSum / resolvedCount : 0,
  };
}

type Tab = 'general' | 'postmortem' | 'problema';

export default function Home() {
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(30);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('general');

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

  const postmortemIssues = useMemo(() => {
    const pastDate = new Date(Date.now() - selectedDays * 24 * 60 * 60 * 1000);
    return stats.issues.filter(
      (issue) => issue.type === 'Postmortem' && new Date(issue.created) >= pastDate
    );
  }, [stats.issues, selectedDays]);
  const postmortemStats = useMemo(() => buildStatsFromIssues(postmortemIssues), [postmortemIssues]);

  const problemaIssues = useMemo(() => {
    const pastDate = new Date(Date.now() - selectedDays * 24 * 60 * 60 * 1000);
    return stats.issues.filter(
      (issue) => issue.type === 'Problema' && new Date(issue.created) >= pastDate
    );
  }, [stats.issues, selectedDays]);
  const problemaStats = useMemo(() => buildStatsFromIssues(problemaIssues), [problemaIssues]);

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

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('postmortem')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'postmortem'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Postmortem
          </button>
          <button
            onClick={() => setActiveTab('problema')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'problema'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Problema
          </button>
        </div>

        <FilterBar onDateRangeChange={handleDateRangeChange} selectedDays={selectedDays} />

        {loading ? (
          <div className="flex justify-center items-center h-96">
            <div className="text-gray-500">Cargando datos...</div>
          </div>
        ) : activeTab === 'general' ? (
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

            {/* Issues Table */}
            <IssuesTable issues={stats.issues} />
          </>
        ) : activeTab === 'postmortem' ? (
          <>
            {/* Postmortem KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatsCard label="Total Postmortems" value={postmortemIssues.length} color="#3b82f6" />
              <StatsCard label="Abiertos" value={postmortemStats.totalOpen} color="#ef4444" />
              <StatsCard label="Cerrados" value={postmortemStats.totalClosed} color="#10b981" />
              <StatsCard
                label="Tiempo Medio de Resolución (días)"
                value={Math.round(postmortemStats.avgResolutionDays * 10) / 10}
                color="#f59e0b"
              />
            </div>

            {/* Charts */}
            <StateAndPriorityChart
              byState={postmortemStats.byState}
              byPriority={postmortemStats.byPriority}
            />

            {/* Issues Table */}
            <IssuesTable
              issues={postmortemIssues}
              showType={false}
              showAssignedGroup={false}
              secondGroupColumn="none"
              showSubtasks
              subtasksLabel="PM Tasks"
            />
          </>
        ) : (
          <>
            {/* Problema KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatsCard label="Total Problemas" value={problemaIssues.length} color="#3b82f6" />
              <StatsCard label="Abiertos" value={problemaStats.totalOpen} color="#ef4444" />
              <StatsCard label="Cerrados" value={problemaStats.totalClosed} color="#10b981" />
              <StatsCard
                label="Tiempo Medio de Resolución (días)"
                value={Math.round(problemaStats.avgResolutionDays * 10) / 10}
                color="#f59e0b"
              />
            </div>

            {/* Charts */}
            <StateAndPriorityChart
              byState={problemaStats.byState}
              byPriority={problemaStats.byPriority}
            />

            {/* Issues Table */}
            <IssuesTable
              issues={problemaIssues}
              showType={false}
              showAssignedGroup={false}
              secondGroupColumn="none"
              showSubtasks
              subtasksLabel="Action Points"
              showActionPointType
              showSubtaskAssignedGroup
            />
          </>
        )}
      </div>
    </div>
  );
}
