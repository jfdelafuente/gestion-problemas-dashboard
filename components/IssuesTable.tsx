'use client';

import { Fragment, useMemo, useState } from 'react';
import { C, formatDate } from '@/lib/theme';
import { StatusChip, PriorityPill, KeyLink } from '@/components/ui/Chips';

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

interface IssueRow {
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

interface IssuesTableProps {
  issues: IssueRow[];
  title?: string;
  countLabel?: string;
  showType?: boolean;
  showAssignedGroup?: boolean;
  secondGroupColumn?: 'involved' | 'resolving' | 'none';
  showSubtasks?: boolean;
  subtasksLabel?: string;
  showActionPointType?: boolean;
  showSubtaskInvolvedGroup?: boolean;
  showFilters?: boolean;
}

const ALL = '__all__';

const selectStyle: React.CSSProperties = {
  padding: '9px 12px',
  border: `1px solid ${C.g200}`,
  borderRadius: 8,
  fontSize: 13,
  color: C.ink,
  cursor: 'pointer',
  outline: 'none',
  backgroundColor: '#fff',
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0 14px 10px',
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  color: C.g400,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 13,
  color: C.g700,
  verticalAlign: 'top',
};

export default function IssuesTable({
  issues,
  title = 'Detalle de Problemas',
  countLabel,
  showType = true,
  showAssignedGroup = true,
  secondGroupColumn = 'involved',
  showSubtasks = false,
  subtasksLabel = 'Subtareas',
  showActionPointType = false,
  showSubtaskInvolvedGroup = false,
  showFilters = false,
}: IssuesTableProps) {
  const showSecondGroupColumn = secondGroupColumn !== 'none';
  const columnCount =
    (showType ? 9 : 8) + (showSubtasks ? 1 : 0) - (showSecondGroupColumn ? 0 : 1) - (showAssignedGroup ? 0 : 1);
  const secondGroupLabel = secondGroupColumn === 'resolving' ? 'Grupo/s Resolutor/es' : 'Grupo Involucrado';
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [priorityFilter, setPriorityFilter] = useState(ALL);

  const statusOptions = useMemo(() => uniqueSorted(issues.map((i) => i.status)), [issues]);
  const priorityOptions = useMemo(() => uniqueSorted(issues.map((i) => i.priority)), [issues]);

  const filteredIssues = useMemo(() => {
    if (!showFilters) return issues;
    const term = search.trim().toLowerCase();
    return issues.filter((issue) => {
      if (statusFilter !== ALL && issue.status !== statusFilter) return false;
      if (priorityFilter !== ALL && issue.priority !== priorityFilter) return false;
      if (term && !issue.key.toLowerCase().includes(term) && !issue.summary.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [issues, showFilters, search, statusFilter, priorityFilter]);

  const hasActiveFilters = search !== '' || statusFilter !== ALL || priorityFilter !== ALL;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter(ALL);
    setPriorityFilter(ALL);
  };

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div
      className="mo-anim"
      style={{ background: C.white, border: `1px solid ${C.g200}`, borderRadius: 14, padding: '22px 24px 12px', boxShadow: 'var(--shadow-1)' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</h3>
        <span style={{ fontSize: 12.5, color: C.g400 }}>
          {showFilters && filteredIssues.length !== issues.length
            ? `${filteredIssues.length} de ${issues.length}`
            : countLabel ?? `${issues.length} en el periodo`}
        </span>
      </div>

      {showFilters && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <svg
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.g400 }}
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por clave o resumen…"
              className="mo-input"
              style={{ width: '100%', padding: '9px 12px 9px 34px', border: `1px solid ${C.g200}`, borderRadius: 8, fontSize: 13, color: C.ink, outline: 'none' }}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="mo-select" style={selectStyle}>
            <option value={ALL}>Todos los estados</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="mo-select" style={selectStyle}>
            <option value={ALL}>Todas las prioridades</option>
            {priorityOptions.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{ padding: '9px 14px', background: 'none', border: `1px solid ${C.g200}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.orange, cursor: 'pointer' }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      <div style={{ overflowX: 'auto', margin: '0 -24px', padding: '0 24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.g100}` }}>
              <th style={thStyle}>Clave</th>
              <th style={thStyle}>Resumen</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Prioridad</th>
              {showType && <th style={thStyle}>Tipo</th>}
              {showAssignedGroup && <th style={thStyle}>Grupo Asignado</th>}
              {showSecondGroupColumn && <th style={thStyle}>{secondGroupLabel}</th>}
              {showSubtasks && <th style={thStyle}>{subtasksLabel}</th>}
              <th style={thStyle}>Creado</th>
              <th style={thStyle}>Resuelto</th>
            </tr>
          </thead>
          <tbody>
            {filteredIssues.map((issue) => {
              const isExpanded = expandedKeys.has(issue.key);
              const canExpand = showSubtasks && issue.subtasksTotal > 0;

              return (
                <Fragment key={issue.key}>
                  <tr style={{ borderBottom: `1px solid ${C.g100}`, background: isExpanded ? C.g50 : 'transparent', transition: 'background .12s' }}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <KeyLink jiraKey={issue.key} />
                    </td>
                    <td style={{ ...tdStyle, minWidth: 260, color: C.ink, fontWeight: 500 }}>{issue.summary}</td>
                    <td style={tdStyle}>
                      <StatusChip status={issue.status} />
                    </td>
                    <td style={tdStyle}>
                      <PriorityPill priority={issue.priority} />
                    </td>
                    {showType && <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{issue.type}</td>}
                    {showAssignedGroup && <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{issue.assignedGroup}</td>}
                    {showSecondGroupColumn && (
                      <td style={{ ...tdStyle, color: C.g500 }}>
                        {secondGroupColumn === 'resolving' ? issue.resolvingGroups : issue.involvedGroups}
                      </td>
                    )}
                    {showSubtasks && (
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {canExpand ? (
                          <button
                            onClick={() => toggleExpanded(issue.key)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 7,
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              font: 'inherit',
                              color: C.g700,
                              padding: 0,
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                width: 18,
                                height: 18,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 5,
                                background: isExpanded ? C.orange : C.g100,
                                color: isExpanded ? '#fff' : C.g500,
                                fontSize: 10,
                                transition: 'all .12s',
                              }}
                            >
                              {isExpanded ? '▾' : '▸'}
                            </span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {issue.subtasksDone}/{issue.subtasksTotal}
                            </span>
                          </button>
                        ) : (
                          `${issue.subtasksDone}/${issue.subtasksTotal}`
                        )}
                      </td>
                    )}
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: C.g400 }}>{formatDate(issue.created)}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: C.g400 }}>{formatDate(issue.resolutiondate)}</td>
                  </tr>
                  {canExpand && isExpanded && (
                    <tr>
                      <td colSpan={columnCount} style={{ padding: '0 14px 14px' }}>
                        <div style={{ borderLeft: `3px solid ${C.orange}`, background: C.orangeTint + '55', borderRadius: '0 8px 8px 0', padding: '12px 16px' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: C.g500, marginBottom: 8 }}>
                            {subtasksLabel} · {issue.subtasksTotal}
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', padding: '0 12px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: C.g400 }}>
                                  Clave
                                </th>
                                <th style={{ textAlign: 'left', padding: '0 12px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: C.g400 }}>
                                  Resumen
                                </th>
                                <th style={{ textAlign: 'left', padding: '0 12px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: C.g400 }}>
                                  Estado
                                </th>
                                <th style={{ textAlign: 'left', padding: '0 12px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: C.g400 }}>
                                  Prioridad
                                </th>
                                {showActionPointType && (
                                  <th style={{ textAlign: 'left', padding: '0 12px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: C.g400 }}>
                                    Tipo de Punto de Acción
                                  </th>
                                )}
                                {showSubtaskInvolvedGroup && (
                                  <th style={{ textAlign: 'left', padding: '0 12px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: C.g400 }}>
                                    Grupo Involucrado
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {issue.subtasks.map((task) => (
                                <tr key={task.key} style={{ borderTop: `1px solid ${C.g200}` }}>
                                  <td style={{ padding: '8px 12px' }}>
                                    <KeyLink jiraKey={task.key} />
                                  </td>
                                  <td style={{ padding: '8px 12px', fontSize: 12.5, color: C.g700 }}>{task.summary}</td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <StatusChip status={task.status} />
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <PriorityPill priority={task.priority} />
                                  </td>
                                  {showActionPointType && (
                                    <td style={{ padding: '8px 12px', fontSize: 12.5, color: C.g600, whiteSpace: 'nowrap' }}>
                                      {task.actionPointType || '—'}
                                    </td>
                                  )}
                                  {showSubtaskInvolvedGroup && (
                                    <td style={{ padding: '8px 12px', fontSize: 12.5, color: C.g600, whiteSpace: 'nowrap' }}>
                                      {task.involvedGroups && task.involvedGroups.length > 0 ? task.involvedGroups.join(', ') : '—'}
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filteredIssues.length === 0 && (
              <tr>
                <td colSpan={columnCount} style={{ padding: 40, textAlign: 'center', color: C.g400, fontSize: 13 }}>
                  {issues.length === 0
                    ? 'No hay problemas para mostrar en este periodo'
                    : 'No hay problemas que coincidan con los filtros'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
