'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardHeader, { Tab } from '@/components/DashboardHeader';
import KpiCard, { computeDelta, KpiDelta } from '@/components/KpiCard';
import StateAndPriorityChart from '@/components/StateAndPriorityChart';
import TimelineChart from '@/components/TimelineChart';
import OpenByStatusChart from '@/components/OpenByStatusChart';
import GroupByStatusChart from '@/components/GroupByStatusChart';
import IssuesTable from '@/components/IssuesTable';
import ActionPointsTable from '@/components/ActionPointsTable';
import { C, formatDate } from '@/lib/theme';
import {
  buildStatsFromIssues,
  apStats,
  buildTimelineWithBacklog,
  buildOpenByStatusTimeline,
  buildGroupByStatus,
  byCreatedRange,
  computePeriod,
  DashboardIssueRow,
} from '@/lib/dashboardStats';

// La vista General tiene 2 entidades raíz (Postmortem, Problema) y 2 subtareas de Jira que
// cuelgan de ellas (PM Task de Postmortem, Action Point de Problema). El módulo refleja esa
// jerarquía real: las KPIs del padre van arriba a tamaño completo, las de la subtarea van
// anidadas debajo, indentadas y con tarjetas más pequeñas (KpiCard compact), conectadas por
// un trazo "↳" en el color de la subtarea.
function KpiModule({
  title,
  accent,
  children,
  subordinate,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
  subordinate?: { title: string; note: string; accent: string; children: React.ReactNode };
}) {
  return (
    <div
      className="mo-anim"
      style={{
        background: C.white,
        border: `1px solid ${C.g200}`,
        borderLeft: `4px solid ${accent}`,
        borderRadius: 14,
        boxShadow: 'var(--shadow-1)',
        padding: '20px 22px 22px',
        marginBottom: 20,
      }}
    >
      <h3 style={{ margin: '0 0 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 700, color: accent }}>
        {title}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16 }}>{children}</div>

      {subordinate && (
        <div style={{ marginTop: 18, marginLeft: 26, paddingLeft: 18, borderLeft: `2px dashed ${subordinate.accent}77` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: subordinate.accent }}>↳</span>
            <h4 style={{ margin: 0, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, color: subordinate.accent }}>
              {subordinate.title}
            </h4>
            <span style={{ fontSize: 11.5, color: C.g400 }}>{subordinate.note}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>{subordinate.children}</div>
        </div>
      )}
    </div>
  );
}

interface DashboardStats {
  issues: DashboardIssueRow[];
}

const INITIAL_STATS: DashboardStats = {
  issues: [],
};


interface KpiCardSpec {
  label: string;
  value: string | number;
  tone: string;
  sub: string;
  delta: KpiDelta | null;
}

// Fila de tarjetas KPI a partir de sus specs: un único punto que reparte `compact` a las 4,
// en vez de repetirlo tarjeta por tarjeta en cada sitio donde se usa.
function KpiCardRow({ cards, compact }: { cards: KpiCardSpec[]; compact?: boolean }) {
  return (
    <>
      {cards.map((card) => (
        <KpiCard key={card.label} compact={compact} {...card} />
      ))}
    </>
  );
}

// Postmortem y Problema muestran exactamente las mismas 4 KPIs (Total/Abiertos/Cerrados/
// Resolución media) — solo cambia el nombre de la entidad. Antes este bloque estaba
// duplicado por cada entidad Y por cada sitio donde se usa (pestaña General + pestaña propia).
function entityKpiCards(
  entityLabel: string,
  total: number,
  prevTotal: number,
  stats: ReturnType<typeof buildStatsFromIssues>,
  prevStats: ReturnType<typeof buildStatsFromIssues>
): KpiCardSpec[] {
  return [
    { label: `Total ${entityLabel}`, value: total, tone: C.orange, sub: 'Abiertos en el periodo', delta: computeDelta(total, prevTotal, 'down') },
    { label: 'Abiertos', value: stats.totalOpen, tone: C.danger, sub: 'En curso o sin iniciar', delta: computeDelta(stats.totalOpen, prevStats.totalOpen, 'down') },
    { label: 'Cerrados', value: stats.totalClosed, tone: C.success, sub: 'Con resolución registrada', delta: computeDelta(stats.totalClosed, prevStats.totalClosed, 'up') },
    {
      label: 'Resolución media',
      value: `${Math.round(stats.avgResolutionDays * 10) / 10}d`,
      tone: C.g600,
      sub: 'Tiempo medio de cierre',
      delta: computeDelta(stats.avgResolutionDays, prevStats.avgResolutionDays, 'down', { absolute: true, unit: 'd' }),
    },
  ];
}

// PM Tasks y Action Points muestran las mismas 4 KPIs (Total/Pendientes/Completado-s/%
// Completado); solo cambian las etiquetas por concordancia de género ("cerradas" vs
// "cerrados"), así que se pasan como opciones en vez de tener una función por entidad.
function subtaskKpiCards(opts: {
  totalLabel: string;
  totalSub: string;
  doneLabel: string;
  doneSub: string;
  pendingSub: string;
  pctSub: string;
  stats: ReturnType<typeof apStats>;
  prevStats: ReturnType<typeof apStats>;
}): KpiCardSpec[] {
  const { totalLabel, totalSub, doneLabel, doneSub, pendingSub, pctSub, stats, prevStats } = opts;
  return [
    { label: totalLabel, value: stats.total, tone: C.orange, sub: totalSub, delta: computeDelta(stats.total, prevStats.total, 'down') },
    { label: 'Pendientes', value: stats.pending, tone: C.danger, sub: pendingSub, delta: computeDelta(stats.pending, prevStats.pending, 'down') },
    { label: doneLabel, value: stats.done, tone: C.success, sub: doneSub, delta: computeDelta(stats.done, prevStats.done, 'up') },
    { label: '% Completado', value: `${stats.pct}%`, tone: C.g600, sub: pctSub, delta: computeDelta(stats.pct, prevStats.pct, 'up') },
  ];
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
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const response = await fetch(`${basePath}/api/dashboard?days=${selectedDays}`);
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

  const { periodStart, prevPeriodStart, periodEnd, rangeLabel } = useMemo(() => computePeriod(selectedDays, formatDate), [selectedDays]);

  // ---------- Postmortem ----------
  const postmortemIssues = useMemo(() => byCreatedRange(stats.issues, periodStart, periodEnd, 'Postmortem'), [stats.issues, periodStart, periodEnd]);
  const postmortemStats = useMemo(() => buildStatsFromIssues(postmortemIssues), [postmortemIssues]);
  const postmortemPrevIssues = useMemo(() => byCreatedRange(stats.issues, prevPeriodStart, periodStart, 'Postmortem'), [stats.issues, prevPeriodStart, periodStart]);
  const postmortemPrevStats = useMemo(() => buildStatsFromIssues(postmortemPrevIssues), [postmortemPrevIssues]);
  const postmortemAllIssues = useMemo(() => stats.issues.filter((issue) => issue.type === 'Postmortem'), [stats.issues]);
  // Backlog e entradas/resueltas del propio Postmortem (no de sus PM Tasks): "no cerrados por
  // día" tiene que contar postmortems sin resolutiondate, igual que el resto de KPIs de esta
  // pestaña. `done` se deriva igual que en buildStatsFromIssues: cerrado = tiene resolutiondate.
  const postmortemTimeline = useMemo(() => buildTimelineWithBacklog(postmortemAllIssues, selectedDays), [postmortemAllIssues, selectedDays]);
  const postmortemOpenByStatus = useMemo(
    () =>
      buildOpenByStatusTimeline(
        postmortemAllIssues.map((issue) => ({ ...issue, done: !!issue.resolutiondate })),
        selectedDays
      ),
    [postmortemAllIssues, selectedDays]
  );
  const postmortemFilteredPmTasks = useMemo(() => postmortemIssues.flatMap((issue) => issue.subtasks), [postmortemIssues]);
  const postmortemPmByAssignedGroup = useMemo(
    () =>
      buildGroupByStatus(
        postmortemFilteredPmTasks.map((t) => ({ status: t.status, groups: t.assignedGroup ? [t.assignedGroup] : [] }))
      ),
    [postmortemFilteredPmTasks]
  );

  // ---------- PM Tasks KPIs (derived from Postmortem) ----------
  const pmCurrentStats = useMemo(() => apStats(postmortemFilteredPmTasks), [postmortemFilteredPmTasks]);
  const postmortemPrevPmTasks = useMemo(() => postmortemPrevIssues.flatMap((issue) => issue.subtasks), [postmortemPrevIssues]);
  const pmPrevStats = useMemo(() => apStats(postmortemPrevPmTasks), [postmortemPrevPmTasks]);

  // ---------- Problema ----------
  const problemaIssues = useMemo(() => byCreatedRange(stats.issues, periodStart, periodEnd, 'Problema'), [stats.issues, periodStart, periodEnd]);
  const problemaStats = useMemo(() => buildStatsFromIssues(problemaIssues), [problemaIssues]);
  const problemaPrevIssues = useMemo(() => byCreatedRange(stats.issues, prevPeriodStart, periodStart, 'Problema'), [stats.issues, prevPeriodStart, periodStart]);
  const problemaPrevStats = useMemo(() => buildStatsFromIssues(problemaPrevIssues), [problemaPrevIssues]);
  const problemaAllIssues = useMemo(() => stats.issues.filter((issue) => issue.type === 'Problema'), [stats.issues]);
  // Backlog e entradas/resueltas del propio Problema (no de sus Action Points): mismo criterio
  // que en Postmortem, "no cerrados por día" cuenta problemas sin resolutiondate.
  const problemaTimeline = useMemo(() => buildTimelineWithBacklog(problemaAllIssues, selectedDays), [problemaAllIssues, selectedDays]);
  const problemaOpenByStatus = useMemo(
    () =>
      buildOpenByStatusTimeline(
        problemaAllIssues.map((issue) => ({ ...issue, done: !!issue.resolutiondate })),
        selectedDays
      ),
    [problemaAllIssues, selectedDays]
  );
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
    general: { eyebrow: 'Vista general', heading: 'Resumen de Postmortems, PM Tasks, Problemas y Action Points' },
    postmortem: { eyebrow: 'Análisis de incidentes', heading: 'Postmortems' },
    pmtasks: { eyebrow: 'Tareas de postmortem', heading: 'PM Tasks de postmortems' },
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', height: 384 }}>
            <div className="mo-spinner" style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${C.g200}`, borderTopColor: C.orange }} />
            <div style={{ color: C.g400, fontSize: 13 }}>Cargando datos de Jira…</div>
          </div>
        ) : activeTab === 'general' ? (
          <>
            <KpiModule
              title="Postmortems"
              accent={C.info}
              subordinate={{
                title: 'PM Tasks',
                note: 'Tareas de estos postmortems',
                accent: C.warning,
                children: (
                  <KpiCardRow
                    compact
                    cards={subtaskKpiCards({
                      totalLabel: 'Total PM Tasks',
                      totalSub: 'Derivadas de postmortems del periodo',
                      doneLabel: 'Completadas',
                      doneSub: 'Cerradas o resueltas',
                      pendingSub: 'Aún no cerradas',
                      pctSub: 'Sobre el total del periodo',
                      stats: pmCurrentStats,
                      prevStats: pmPrevStats,
                    })}
                  />
                ),
              }}
            >
              <KpiCardRow cards={entityKpiCards('Postmortems', postmortemIssues.length, postmortemPrevIssues.length, postmortemStats, postmortemPrevStats)} />
            </KpiModule>

            <KpiModule
              title="Problemas"
              accent={C.orange}
              subordinate={{
                title: 'Action Points',
                note: 'Puntos de acción de estos problemas',
                accent: C.g700,
                children: (
                  <KpiCardRow
                    compact
                    cards={subtaskKpiCards({
                      totalLabel: 'Total Puntos de Acción',
                      totalSub: 'Derivados de problemas del periodo',
                      doneLabel: 'Completados',
                      doneSub: 'Cerrados o resueltos',
                      pendingSub: 'Aún no cerrados',
                      pctSub: 'Sobre el total del periodo',
                      stats: apCurrentStats,
                      prevStats: apPrevStats,
                    })}
                  />
                ),
              }}
            >
              <KpiCardRow cards={entityKpiCards('Problemas', problemaIssues.length, problemaPrevIssues.length, problemaStats, problemaPrevStats)} />
            </KpiModule>
          </>
        ) : activeTab === 'postmortem' ? (
          <>
            <div className="mo-anim" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16, marginBottom: 24 }}>
              <KpiCardRow cards={entityKpiCards('Postmortems', postmortemIssues.length, postmortemPrevIssues.length, postmortemStats, postmortemPrevStats)} />
            </div>

            <StateAndPriorityChart byState={postmortemStats.byState} byPriority={postmortemStats.byPriority} />
            <TimelineChart data={postmortemTimeline} subtitle="Postmortems · entradas, resueltas y backlog" showBacklog />
            <OpenByStatusChart
              data={postmortemOpenByStatus.rows}
              statuses={postmortemOpenByStatus.statuses}
              title="Postmortems no cerrados por estado"
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
              showWikiPage
              showIncidentRef
            />
          </>
        ) : activeTab === 'pmtasks' ? (
          <>
            <div className="mo-anim" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16, marginBottom: 24 }}>
              <KpiCardRow
                cards={subtaskKpiCards({
                  totalLabel: 'Total PM Tasks',
                  totalSub: 'Derivadas de postmortems del periodo',
                  doneLabel: 'Completadas',
                  doneSub: 'Cerradas o resueltas',
                  pendingSub: 'Aún no cerradas',
                  pctSub: 'Sobre el total del periodo',
                  stats: pmCurrentStats,
                  prevStats: pmPrevStats,
                })}
              />
            </div>

            <GroupByStatusChart
              data={postmortemPmByAssignedGroup.rows}
              statuses={postmortemPmByAssignedGroup.statuses}
              title="PM Tasks por Grupo Asignado y Estado"
            />
            <ActionPointsTable
              items={postmortemFilteredPmTasks}
              title="Detalle de PM Tasks"
              emptyLabel="No hay PM Tasks que coincidan con los filtros"
              showActionPointType={false}
              groupColumn="assigned"
            />
          </>
        ) : activeTab === 'problema' ? (
          <>
            <div className="mo-anim" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16, marginBottom: 24 }}>
              <KpiCardRow cards={entityKpiCards('Problemas', problemaIssues.length, problemaPrevIssues.length, problemaStats, problemaPrevStats)} />
            </div>

            <StateAndPriorityChart byState={problemaStats.byState} byPriority={problemaStats.byPriority} />
            <TimelineChart data={problemaTimeline} subtitle="Problemas · entradas, resueltas y backlog" showBacklog />
            <OpenByStatusChart
              data={problemaOpenByStatus.rows}
              statuses={problemaOpenByStatus.statuses}
              title="Problemas no cerrados por estado"
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
              <KpiCardRow
                cards={subtaskKpiCards({
                  totalLabel: 'Total Puntos de Acción',
                  totalSub: 'Derivados de problemas del periodo',
                  doneLabel: 'Completados',
                  doneSub: 'Cerrados o resueltos',
                  pendingSub: 'Aún no cerrados',
                  pctSub: 'Sobre el total del periodo',
                  stats: apCurrentStats,
                  prevStats: apPrevStats,
                })}
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
