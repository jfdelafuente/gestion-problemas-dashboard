'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardHeader, { Tab } from '@/components/DashboardHeader';
import KpiCard, { computeDelta } from '@/components/KpiCard';
import StateAndPriorityChart from '@/components/StateAndPriorityChart';
import TimelineChart from '@/components/TimelineChart';
import OpenByStatusChart from '@/components/OpenByStatusChart';
import GroupByStatusChart from '@/components/GroupByStatusChart';
import IssuesTable from '@/components/IssuesTable';
import ActionPointsTable from '@/components/ActionPointsTable';
import { C, formatDate } from '@/lib/theme';

const DAY = 24 * 60 * 60 * 1000;

interface SubtaskRow {
  key: string;
  summary: string;
  status: string;
  priority: string;
  done: boolean;
  actionPointType?: string;
  assignedGroup?: string;
  involvedGroups?: string[];
  created?: string;
  resolutiondate?: string;
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
      const days = (new Date(issue.resolutiondate).getTime() - new Date(issue.created).getTime()) / DAY;
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

function apStats(items: SubtaskRow[]) {
  let done = 0;
  items.forEach((t) => {
    if (t.done) done++;
  });
  const pending = items.length - done;
  return { done, pending, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
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

// Cuantos más días abarque el periodo, más se agrupan las barras (por semana/mes) para
// que el gráfico no acabe con cientos de barras de 1px en "1 año".
function bucketStep(days: number) {
  return days <= 7 ? 1 : days <= 30 ? 3 : days <= 90 ? 7 : 30;
}

function chunkByStep<T extends { date: string; backlog: number }>(
  rows: T[],
  step: number,
  mergeExtra: (chunk: T[]) => Omit<T, 'date' | 'backlog'>
): T[] {
  if (step <= 1) return rows;
  const out: T[] = [];
  for (let i = 0; i < rows.length; i += step) {
    const chunk = rows.slice(i, i + step);
    out.push({
      ...mergeExtra(chunk),
      date: chunk[0].date,
      backlog: chunk[chunk.length - 1].backlog,
    } as T);
  }
  return out;
}

function buildTimelineWithBacklog(items: Array<{ created?: string; resolutiondate?: string }>, days: number) {
  const pastDate = new Date(Date.now() - days * DAY);
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
  const dailyRows = eachDateKey(pastDate, new Date()).map((date) => {
    const entry = dayMap.get(date) || { created: 0, resolved: 0 };
    runningBacklog += entry.created - entry.resolved;
    return { date, created: entry.created, closed: entry.resolved, backlog: runningBacklog };
  });

  return chunkByStep(dailyRows, bucketStep(days), (chunk) => ({
    created: chunk.reduce((sum, r) => sum + r.created, 0),
    closed: chunk.reduce((sum, r) => sum + r.closed, 0),
  }));
}

function buildOpenByStatusTimeline(
  items: Array<{ created?: string; resolutiondate?: string; status: string; done: boolean }>,
  days: number
) {
  const pastDate = new Date(Date.now() - days * DAY);
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
  const dailyRows = eachDateKey(pastDate, new Date()).map((date) => {
    const backlogEntry = backlogDayMap.get(date) || { created: 0, resolved: 0 };
    runningBacklog += backlogEntry.created - backlogEntry.resolved;
    const statusEntry = statusDayMap.get(date) || {};
    const row: Record<string, string | number> & { date: string; backlog: number } = { date, backlog: runningBacklog };
    statuses.forEach((status) => {
      row[status] = statusEntry[status] || 0;
    });
    return row;
  });

  const rows = chunkByStep(dailyRows, bucketStep(days), (chunk) => {
    const merged: Record<string, number> = {};
    statuses.forEach((status) => {
      merged[status] = chunk.reduce((sum, r) => sum + (Number(r[status]) || 0), 0);
    });
    return merged;
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

function byCreatedRange(issues: DashboardIssueRow[], start: Date, end: Date, type?: string) {
  return issues.filter((issue) => {
    if (type && issue.type !== type) return false;
    const c = new Date(issue.created);
    return c >= start && c < end;
  });
}

function computePeriod(days: number) {
  const nowTs = Date.now();
  const periodStart = new Date(nowTs - days * DAY);
  const prevPeriodStart = new Date(nowTs - 2 * days * DAY);
  const periodEnd = new Date(nowTs + DAY);
  return {
    periodStart,
    prevPeriodStart,
    periodEnd,
    rangeLabel: `${formatDate(periodStart.toISOString())} — ${formatDate(new Date(nowTs).toISOString())}`,
  };
}

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
    // Fetch-on-mount + polling interval; fetchStats sets state intentionally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats();
    const interval = setInterval(fetchStats, 3600000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDays]);

  const { periodStart, prevPeriodStart, periodEnd, rangeLabel } = useMemo(() => computePeriod(selectedDays), [selectedDays]);

  // ---------- General ----------
  const generalIssues = useMemo(() => byCreatedRange(stats.issues, periodStart, periodEnd), [stats.issues, periodStart, periodEnd]);
  const generalStats = useMemo(() => buildStatsFromIssues(generalIssues), [generalIssues]);
  const generalPrevIssues = useMemo(() => byCreatedRange(stats.issues, prevPeriodStart, periodStart), [stats.issues, prevPeriodStart, periodStart]);
  const generalPrevStats = useMemo(() => buildStatsFromIssues(generalPrevIssues), [generalPrevIssues]);
  const generalTimeline = useMemo(() => buildTimelineWithBacklog(generalIssues, selectedDays), [generalIssues, selectedDays]);

  // ---------- Postmortem ----------
  const postmortemIssues = useMemo(() => byCreatedRange(stats.issues, periodStart, periodEnd, 'Postmortem'), [stats.issues, periodStart, periodEnd]);
  const postmortemStats = useMemo(() => buildStatsFromIssues(postmortemIssues), [postmortemIssues]);
  const postmortemPrevIssues = useMemo(() => byCreatedRange(stats.issues, prevPeriodStart, periodStart, 'Postmortem'), [stats.issues, prevPeriodStart, periodStart]);
  const postmortemPrevStats = useMemo(() => buildStatsFromIssues(postmortemPrevIssues), [postmortemPrevIssues]);
  const postmortemAllIssues = useMemo(() => stats.issues.filter((issue) => issue.type === 'Postmortem'), [stats.issues]);
  const postmortemPmTasks = useMemo(() => postmortemAllIssues.flatMap((issue) => issue.subtasks), [postmortemAllIssues]);
  const postmortemTimeline = useMemo(() => buildTimelineWithBacklog(postmortemPmTasks, selectedDays), [postmortemPmTasks, selectedDays]);
  const postmortemOpenByStatus = useMemo(() => buildOpenByStatusTimeline(postmortemPmTasks, selectedDays), [postmortemPmTasks, selectedDays]);

  // ---------- Problema ----------
  const problemaIssues = useMemo(() => byCreatedRange(stats.issues, periodStart, periodEnd, 'Problema'), [stats.issues, periodStart, periodEnd]);
  const problemaStats = useMemo(() => buildStatsFromIssues(problemaIssues), [problemaIssues]);
  const problemaPrevIssues = useMemo(() => byCreatedRange(stats.issues, prevPeriodStart, periodStart, 'Problema'), [stats.issues, prevPeriodStart, periodStart]);
  const problemaPrevStats = useMemo(() => buildStatsFromIssues(problemaPrevIssues), [problemaPrevIssues]);
  const problemaAllIssues = useMemo(() => stats.issues.filter((issue) => issue.type === 'Problema'), [stats.issues]);
  const problemaActionPoints = useMemo(() => problemaAllIssues.flatMap((issue) => issue.subtasks), [problemaAllIssues]);
  const problemaTimeline = useMemo(() => buildTimelineWithBacklog(problemaActionPoints, selectedDays), [problemaActionPoints, selectedDays]);
  const problemaOpenByStatus = useMemo(() => buildOpenByStatusTimeline(problemaActionPoints, selectedDays), [problemaActionPoints, selectedDays]);
  const problemaFilteredActionPoints = useMemo(() => problemaIssues.flatMap((issue) => issue.subtasks), [problemaIssues]);
  const problemaApByInvolvedGroup = useMemo(
    () =>
      buildGroupByStatus(
        problemaFilteredActionPoints.map((t) => ({ status: t.status, groups: t.involvedGroups || [] }))
      ),
    [problemaFilteredActionPoints]
  );

  // ---------- Action Points KPIs (derived from Problema) ----------
  const apCurrentStats = useMemo(() => apStats(problemaFilteredActionPoints), [problemaFilteredActionPoints]);
  const problemaPrevActionPoints = useMemo(() => problemaPrevIssues.flatMap((issue) => issue.subtasks), [problemaPrevIssues]);
  const apPrevStats = useMemo(() => apStats(problemaPrevActionPoints), [problemaPrevActionPoints]);

  const tabHeadings: Record<Tab, { eyebrow: string; heading: string }> = {
    general: { eyebrow: 'Vista general', heading: 'Todos los problemas y postmortems' },
    postmortem: { eyebrow: 'Análisis de incidentes', heading: 'Postmortems' },
    problema: { eyebrow: 'Gestión de problemas', heading: 'Problemas' },
    actionpoints: { eyebrow: 'Puntos de acción', heading: 'Action Points de problemas' },
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)' }}>
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedDays={selectedDays}
        onDaysChange={setSelectedDays}
        lastUpdated={lastUpdated}
        onRefresh={fetchStats}
      />

      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 32px 72px' }}>
        {error && (
          <div style={{ background: '#FBE3E1', border: `1px solid ${C.danger}`, color: C.danger, padding: '12px 16px', borderRadius: 8, marginBottom: 24 }}>
            {error}
          </div>
        )}

        <div className="mo-anim" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 700, color: C.orange }}>
              {tabHeadings[activeTab].eyebrow}
            </div>
            <h2 style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>
              {tabHeadings[activeTab].heading}
            </h2>
          </div>
          <div style={{ fontSize: 13, color: C.g400 }}>{rangeLabel}</div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 384 }}>
            <div style={{ color: C.g400 }}>Cargando datos...</div>
          </div>
        ) : activeTab === 'general' ? (
          <>
            <div className="mo-anim" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16, marginBottom: 24 }}>
              <KpiCard
                label="Total de issues"
                value={generalIssues.length}
                tone={C.orange}
                sub="Problemas + postmortems en el periodo"
                delta={computeDelta(generalIssues.length, generalPrevIssues.length, 'down')}
              />
              <KpiCard
                label="Abiertos"
                value={generalStats.totalOpen}
                tone={C.danger}
                sub="Requieren seguimiento activo"
                delta={computeDelta(generalStats.totalOpen, generalPrevStats.totalOpen, 'down')}
              />
              <KpiCard
                label="Cerrados"
                value={generalStats.totalClosed}
                tone={C.success}
                sub="Resueltos en el periodo"
                delta={computeDelta(generalStats.totalClosed, generalPrevStats.totalClosed, 'up')}
              />
              <KpiCard
                label="Resolución media"
                value={`${Math.round(generalStats.avgResolutionDays * 10) / 10}d`}
                tone={C.g600}
                sub="Días desde apertura a cierre"
                delta={computeDelta(generalStats.avgResolutionDays, generalPrevStats.avgResolutionDays, 'down', { absolute: true, unit: 'd' })}
              />
            </div>

            <StateAndPriorityChart byState={generalStats.byState} byPriority={generalStats.byPriority} />
            <TimelineChart data={generalTimeline} subtitle="Entradas vs. resueltas · backlog acumulado" showBacklog />

            <IssuesTable
              issues={generalIssues}
              title="Detalle de issues"
              countLabel={`${generalIssues.length} en el periodo`}
              showType
              showSubtasks
              subtasksLabel="Subtareas"
            />
          </>
        ) : activeTab === 'postmortem' ? (
          <>
            <div className="mo-anim" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16, marginBottom: 24 }}>
              <KpiCard
                label="Total Postmortems"
                value={postmortemIssues.length}
                tone={C.orange}
                sub="Abiertos en el periodo"
                delta={computeDelta(postmortemIssues.length, postmortemPrevIssues.length, 'down')}
              />
              <KpiCard
                label="Abiertos"
                value={postmortemStats.totalOpen}
                tone={C.danger}
                sub="En curso o sin iniciar"
                delta={computeDelta(postmortemStats.totalOpen, postmortemPrevStats.totalOpen, 'down')}
              />
              <KpiCard
                label="Cerrados"
                value={postmortemStats.totalClosed}
                tone={C.success}
                sub="Con resolución registrada"
                delta={computeDelta(postmortemStats.totalClosed, postmortemPrevStats.totalClosed, 'up')}
              />
              <KpiCard
                label="Resolución media"
                value={`${Math.round(postmortemStats.avgResolutionDays * 10) / 10}d`}
                tone={C.g600}
                sub="Tiempo medio de cierre"
                delta={computeDelta(postmortemStats.avgResolutionDays, postmortemPrevStats.avgResolutionDays, 'down', { absolute: true, unit: 'd' })}
              />
            </div>

            <StateAndPriorityChart byState={postmortemStats.byState} byPriority={postmortemStats.byPriority} />
            <TimelineChart data={postmortemTimeline} subtitle="PM Tasks · entradas, resueltas y backlog" showBacklog />
            <OpenByStatusChart
              data={postmortemOpenByStatus.rows}
              statuses={postmortemOpenByStatus.statuses}
              title="PM Tasks no cerradas por estado"
            />

            <IssuesTable
              issues={postmortemIssues}
              title="Detalle de postmortems"
              countLabel={`${postmortemIssues.length} en el periodo`}
              showType={false}
              showAssignedGroup={false}
              secondGroupColumn="none"
              showSubtasks
              subtasksLabel="PM Tasks"
              showFilters
            />
          </>
        ) : activeTab === 'problema' ? (
          <>
            <div className="mo-anim" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16, marginBottom: 24 }}>
              <KpiCard
                label="Total Problemas"
                value={problemaIssues.length}
                tone={C.orange}
                sub="Abiertos en el periodo"
                delta={computeDelta(problemaIssues.length, problemaPrevIssues.length, 'down')}
              />
              <KpiCard
                label="Abiertos"
                value={problemaStats.totalOpen}
                tone={C.danger}
                sub="En curso o sin iniciar"
                delta={computeDelta(problemaStats.totalOpen, problemaPrevStats.totalOpen, 'down')}
              />
              <KpiCard
                label="Cerrados"
                value={problemaStats.totalClosed}
                tone={C.success}
                sub="Con resolución registrada"
                delta={computeDelta(problemaStats.totalClosed, problemaPrevStats.totalClosed, 'up')}
              />
              <KpiCard
                label="Resolución media"
                value={`${Math.round(problemaStats.avgResolutionDays * 10) / 10}d`}
                tone={C.g600}
                sub="Tiempo medio de cierre"
                delta={computeDelta(problemaStats.avgResolutionDays, problemaPrevStats.avgResolutionDays, 'down', { absolute: true, unit: 'd' })}
              />
            </div>

            <StateAndPriorityChart byState={problemaStats.byState} byPriority={problemaStats.byPriority} />
            <TimelineChart data={problemaTimeline} subtitle="Action Points · entradas, resueltas y backlog" showBacklog />
            <OpenByStatusChart
              data={problemaOpenByStatus.rows}
              statuses={problemaOpenByStatus.statuses}
              title="Action Points no cerrados por estado"
            />

            <IssuesTable
              issues={problemaIssues}
              title="Detalle de problemas"
              countLabel={`${problemaIssues.length} en el periodo`}
              showType={false}
              showAssignedGroup={false}
              secondGroupColumn="none"
              showSubtasks
              subtasksLabel="Action Points"
              showActionPointType
              showSubtaskInvolvedGroup
              showFilters
            />
          </>
        ) : (
          <>
            <div className="mo-anim" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16, marginBottom: 24 }}>
              <KpiCard
                label="Total Puntos de Acción"
                value={apCurrentStats.total}
                tone={C.orange}
                sub="Derivados de problemas del periodo"
                delta={computeDelta(apCurrentStats.total, apPrevStats.total, 'down')}
              />
              <KpiCard
                label="Pendientes"
                value={apCurrentStats.pending}
                tone={C.danger}
                sub="Aún no cerrados"
                delta={computeDelta(apCurrentStats.pending, apPrevStats.pending, 'down')}
              />
              <KpiCard
                label="Completados"
                value={apCurrentStats.done}
                tone={C.success}
                sub="Cerrados o resueltos"
                delta={computeDelta(apCurrentStats.done, apPrevStats.done, 'up')}
              />
              <KpiCard
                label="% Completado"
                value={`${apCurrentStats.pct}%`}
                tone={C.g600}
                sub="Sobre el total del periodo"
                delta={computeDelta(apCurrentStats.pct, apPrevStats.pct, 'up')}
              />
            </div>

            <GroupByStatusChart
              data={problemaApByInvolvedGroup.rows}
              statuses={problemaApByInvolvedGroup.statuses}
              title="Action Points por Grupo Involucrado y Estado"
            />
            <ActionPointsTable items={problemaFilteredActionPoints} />
          </>
        )}
      </main>
    </div>
  );
}
