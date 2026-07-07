'use client';

import { useState, useEffect, useMemo } from 'react';
import StatsCard from '@/components/StatsCard';
import StateAndPriorityChart from '@/components/StateAndPriorityChart';
import TimelineChart from '@/components/TimelineChart';
import OpenByStatusChart from '@/components/OpenByStatusChart';
import GroupByStatusChart from '@/components/GroupByStatusChart';
import FilterBar from '@/components/FilterBar';
import IssuesTable from '@/components/IssuesTable';
import ActionPointsTable from '@/components/ActionPointsTable';

interface SubtaskRow {
  key: string;
  summary: string;
  status: string;
  priority: string;
  done: boolean;
  actionPointType?: string;
  assignedGroup?: string;
  involvedGroups?: string[];
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

function eachDateKey(from: Date, to: Date) {
  const keys: string[] = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor <= end) {
    keys.push(cursor.toISOString().split('T')[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function buildTimelineWithBacklog(items: Array<{ created?: string; resolutiondate?: string }>, days: number) {
  const pastDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const pastDateKey = pastDate.toISOString().split('T')[0];

  const dayMap = new Map<string, { created: number; resolved: number }>();
  let baselineBacklog = 0;

  items.forEach((item) => {
    if (!item.created) return;

    const createdKey = new Date(item.created).toISOString().split('T')[0];
    if (createdKey < pastDateKey) {
      baselineBacklog++;
    } else {
      const entry = dayMap.get(createdKey) || { created: 0, resolved: 0 };
      entry.created++;
      dayMap.set(createdKey, entry);
    }

    if (item.resolutiondate) {
      const resolvedKey = new Date(item.resolutiondate).toISOString().split('T')[0];
      if (resolvedKey < pastDateKey) {
        baselineBacklog--;
      } else {
        const entry = dayMap.get(resolvedKey) || { created: 0, resolved: 0 };
        entry.resolved++;
        dayMap.set(resolvedKey, entry);
      }
    }
  });

  let runningBacklog = baselineBacklog;
  return eachDateKey(pastDate, new Date()).map((date) => {
    const entry = dayMap.get(date) || { created: 0, resolved: 0 };
    runningBacklog += entry.created - entry.resolved;
    return { date, created: entry.created, closed: entry.resolved, backlog: runningBacklog };
  });
}

function buildOpenByStatusTimeline(
  items: Array<{ created?: string; resolutiondate?: string; status: string; done: boolean }>,
  days: number
) {
  const pastDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const pastDateKey = pastDate.toISOString().split('T')[0];

  // Backlog histórico real: creados - resueltos acumulados, igual que en buildTimelineWithBacklog.
  // No puede basarse solo en los items que siguen abiertos HOY, porque eso ignora los que
  // estuvieron en backlog en el pasado y ya se resolvieron desde entonces.
  const backlogDayMap = new Map<string, { created: number; resolved: number }>();
  let baselineBacklog = 0;

  items.forEach((item) => {
    if (!item.created) return;

    const createdKey = new Date(item.created).toISOString().split('T')[0];
    if (createdKey < pastDateKey) {
      baselineBacklog++;
    } else {
      const entry = backlogDayMap.get(createdKey) || { created: 0, resolved: 0 };
      entry.created++;
      backlogDayMap.set(createdKey, entry);
    }

    if (item.resolutiondate) {
      const resolvedKey = new Date(item.resolutiondate).toISOString().split('T')[0];
      if (resolvedKey < pastDateKey) {
        baselineBacklog--;
      } else {
        const entry = backlogDayMap.get(resolvedKey) || { created: 0, resolved: 0 };
        entry.resolved++;
        backlogDayMap.set(resolvedKey, entry);
      }
    }
  });

  // Barras: solo los items que siguen abiertos hoy, agrupados por su fecha de creación y estado actual.
  const openItems = items.filter((item) => !item.done && item.created);
  const statusDayMap = new Map<string, Record<string, number>>();
  const statusSet = new Set<string>();

  openItems.forEach((item) => {
    const dateKey = new Date(item.created as string).toISOString().split('T')[0];
    statusSet.add(item.status);

    if (dateKey >= pastDateKey) {
      const entry = statusDayMap.get(dateKey) || {};
      entry[item.status] = (entry[item.status] || 0) + 1;
      statusDayMap.set(dateKey, entry);
    }
  });

  const statuses = Array.from(statusSet);
  let runningBacklog = baselineBacklog;
  const rows = eachDateKey(pastDate, new Date()).map((date) => {
    const backlogEntry = backlogDayMap.get(date) || { created: 0, resolved: 0 };
    runningBacklog += backlogEntry.created - backlogEntry.resolved;
    const statusEntry = statusDayMap.get(date) || {};
    const row: Record<string, string | number> = { date, backlog: runningBacklog };
    statuses.forEach((status) => {
      row[status] = statusEntry[status] || 0;
    });
    return row;
  });

  return { rows, statuses };
}

function buildGroupByStatus(items: Array<{ status: string; groups: string[] }>) {
  const groupMap = new Map<string, Record<string, number>>();
  const statusSet = new Set<string>();

  items.forEach((item) => {
    statusSet.add(item.status);
    const groups = item.groups.length > 0 ? item.groups : ['Sin asignar'];
    groups.forEach((group) => {
      const entry = groupMap.get(group) || {};
      entry[item.status] = (entry[item.status] || 0) + 1;
      groupMap.set(group, entry);
    });
  });

  const statuses = Array.from(statusSet);
  const rows = Array.from(groupMap.entries())
    .map(([group, entry]) => {
      const total = Object.values(entry).reduce((sum, v) => sum + v, 0);
      const row: Record<string, string | number> = { group, total };
      statuses.forEach((status) => {
        row[status] = entry[status] || 0;
      });
      return row;
    })
    .sort((a, b) => (b.total as number) - (a.total as number));

  return { rows, statuses };
}

type Tab = 'general' | 'postmortem' | 'problema' | 'actionpoints';

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
  const postmortemAllIssues = useMemo(
    () => stats.issues.filter((issue) => issue.type === 'Postmortem'),
    [stats.issues]
  );
  const postmortemPmTasks = useMemo(
    () => postmortemAllIssues.flatMap((issue) => issue.subtasks),
    [postmortemAllIssues]
  );
  const postmortemTimeline = useMemo(
    () => buildTimelineWithBacklog(postmortemPmTasks, selectedDays),
    [postmortemPmTasks, selectedDays]
  );
  const postmortemOpenByStatus = useMemo(
    () => buildOpenByStatusTimeline(postmortemPmTasks, selectedDays),
    [postmortemPmTasks, selectedDays]
  );

  const problemaIssues = useMemo(() => {
    const pastDate = new Date(Date.now() - selectedDays * 24 * 60 * 60 * 1000);
    return stats.issues.filter(
      (issue) => issue.type === 'Problema' && new Date(issue.created) >= pastDate
    );
  }, [stats.issues, selectedDays]);
  const problemaStats = useMemo(() => buildStatsFromIssues(problemaIssues), [problemaIssues]);
  const problemaAllIssues = useMemo(
    () => stats.issues.filter((issue) => issue.type === 'Problema'),
    [stats.issues]
  );
  const problemaActionPoints = useMemo(
    () => problemaAllIssues.flatMap((issue) => issue.subtasks),
    [problemaAllIssues]
  );
  const problemaTimeline = useMemo(
    () => buildTimelineWithBacklog(problemaActionPoints, selectedDays),
    [problemaActionPoints, selectedDays]
  );
  const problemaOpenByStatus = useMemo(
    () => buildOpenByStatusTimeline(problemaActionPoints, selectedDays),
    [problemaActionPoints, selectedDays]
  );
  const problemaFilteredActionPoints = useMemo(
    () => problemaIssues.flatMap((issue) => issue.subtasks),
    [problemaIssues]
  );
  const problemaApByInvolvedGroup = useMemo(
    () =>
      buildGroupByStatus(
        problemaFilteredActionPoints.map((t) => ({
          status: t.status,
          groups: t.involvedGroups || [],
        }))
      ),
    [problemaFilteredActionPoints]
  );

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
          <button
            onClick={() => setActiveTab('actionpoints')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'actionpoints'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Action Points
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
            <TimelineChart
              data={postmortemTimeline}
              createdLabel="Entradas"
              closedLabel="Solucionadas"
              backlogLabel="Backlog"
              showBacklog
            />
            <OpenByStatusChart
              data={postmortemOpenByStatus.rows}
              statuses={postmortemOpenByStatus.statuses}
              title="PM Tasks No Cerradas por Estado y Backlog Acumulado"
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
        ) : activeTab === 'problema' ? (
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
            <TimelineChart
              data={problemaTimeline}
              createdLabel="Entradas"
              closedLabel="Solucionadas"
              backlogLabel="Backlog"
              showBacklog
            />
            <OpenByStatusChart
              data={problemaOpenByStatus.rows}
              statuses={problemaOpenByStatus.statuses}
              title="Action Points No Cerrados por Estado y Backlog Acumulado"
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
              showSubtaskInvolvedGroup
            />
          </>
        ) : (
          <>
            {/* Action Points */}
            <GroupByStatusChart
              data={problemaApByInvolvedGroup.rows}
              statuses={problemaApByInvolvedGroup.statuses}
              title="Action Points por Grupo Involucrado y Estado"
            />
            <ActionPointsTable items={problemaFilteredActionPoints} />
          </>
        )}
      </div>
    </div>
  );
}
