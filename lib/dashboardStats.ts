// Pure data utilities for dashboard calculations — zero React dependencies.
// These are extracted from app/page.tsx to separate data logic from components.

const DAY = 24 * 60 * 60 * 1000;

export interface SubtaskRow {
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

export interface DashboardIssueRow {
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
  wikiPage?: { url: string; title: string };
  incidentRef?: string;
}

export function buildStatsFromIssues(issues: DashboardIssueRow[]) {
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

export function apStats(items: SubtaskRow[]) {
  let done = 0;
  items.forEach((t) => {
    if (t.done) done++;
  });
  const pending = items.length - done;
  return { done, pending, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}

// Clave de día en hora LOCAL (no UTC): toISOString() convierte a UTC, así que un issue creado
// de madrugada en España (p.ej. 00:30 CEST = 22:30 UTC del día anterior) quedaría contado un
// día antes de lo que muestran la tabla y formatDate (que sí usan la zona horaria local).
export function localDateKey(value: Date | string) {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function eachDateKey(from: Date, to: Date) {
  const keys: string[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    keys.push(localDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

// Backlog histórico real: creados - resueltos acumulados desde siempre, no solo desde el
// arranque del periodo visible — un item creado antes del periodo y resuelto dentro (o
// viceversa) tiene que contar en el backlog base (`baselineBacklog`), no perderse. Comparte
// esta acumulación buildTimelineWithBacklog y buildOpenByStatusTimeline.
export function buildBacklogDayMap(items: Array<{ created?: string; resolutiondate?: string }>, pastDateKey: string) {
  const dayMap = new Map<string, { created: number; resolved: number }>();
  let baselineBacklog = 0;

  items.forEach((item) => {
    if (!item.created) return;

    const createdKey = localDateKey(item.created);
    if (createdKey < pastDateKey) {
      baselineBacklog++;
    } else {
      const entry = dayMap.get(createdKey) || { created: 0, resolved: 0 };
      entry.created++;
      dayMap.set(createdKey, entry);
    }

    if (item.resolutiondate) {
      const resolvedKey = localDateKey(item.resolutiondate);
      if (resolvedKey < pastDateKey) {
        baselineBacklog--;
      } else {
        const entry = dayMap.get(resolvedKey) || { created: 0, resolved: 0 };
        entry.resolved++;
        dayMap.set(resolvedKey, entry);
      }
    }
  });

  return { dayMap, baselineBacklog };
}

export function buildTimelineWithBacklog(items: Array<{ created?: string; resolutiondate?: string }>, days: number) {
  const pastDate = new Date(Date.now() - days * DAY);
  const pastDateKey = localDateKey(pastDate);
  const { dayMap, baselineBacklog } = buildBacklogDayMap(items, pastDateKey);

  let runningBacklog = baselineBacklog;
  return eachDateKey(pastDate, new Date()).map((date) => {
    const entry = dayMap.get(date) || { created: 0, resolved: 0 };
    runningBacklog += entry.created - entry.resolved;
    return { date, created: entry.created, closed: entry.resolved, backlog: runningBacklog };
  });
}

export function buildOpenByStatusTimeline(
  items: Array<{ created?: string; resolutiondate?: string; status: string; done: boolean }>,
  days: number
) {
  const pastDate = new Date(Date.now() - days * DAY);
  const pastDateKey = localDateKey(pastDate);
  const { dayMap: backlogDayMap, baselineBacklog } = buildBacklogDayMap(items, pastDateKey);

  // Barras: solo los items que siguen abiertos hoy, agrupados por su fecha de creación y estado actual.
  const openItems = items.filter((item) => !item.done && item.created);
  const statusDayMap = new Map<string, Record<string, number>>();
  const statusSet = new Set<string>();

  openItems.forEach((item) => {
    const dateKey = localDateKey(item.created as string);
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
    const row: Record<string, string | number> & { date: string; backlog: number } = { date, backlog: runningBacklog };
    statuses.forEach((status) => {
      row[status] = statusEntry[status] || 0;
    });
    return row;
  });

  return { rows, statuses };
}

export function buildGroupByStatus(items: Array<{ status: string; groups: string[] }>) {
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

export function byCreatedRange(issues: DashboardIssueRow[], start: Date, end: Date, type?: string) {
  return issues.filter((issue) => {
    if (type && issue.type !== type) return false;
    const c = new Date(issue.created);
    return c >= start && c < end;
  });
}

export function computePeriod(days: number, formatDate: (iso: string) => string) {
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
