'use client';

import { useMemo, useState } from 'react';
import { C, formatDate } from '@/lib/theme';
import { StatusChip, PriorityPill, KeyLink } from '@/components/ui/Chips';

interface ActionPointRow {
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

interface ActionPointsTableProps {
  items: ActionPointRow[];
}

const ALL = '__all__';

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

function uniqueSorted(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
}

export default function ActionPointsTable({ items }: ActionPointsTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [assignedGroupFilter, setAssignedGroupFilter] = useState(ALL);
  const [involvedGroupFilter, setInvolvedGroupFilter] = useState(ALL);

  const statusOptions = useMemo(() => uniqueSorted(items.map((i) => i.status)), [items]);
  const assignedGroupOptions = useMemo(() => uniqueSorted(items.map((i) => i.assignedGroup)), [items]);
  const involvedGroupOptions = useMemo(() => uniqueSorted(items.flatMap((i) => i.involvedGroups || [])), [items]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== ALL && item.status !== statusFilter) return false;
      if (assignedGroupFilter !== ALL && item.assignedGroup !== assignedGroupFilter) return false;
      if (involvedGroupFilter !== ALL && !(item.involvedGroups || []).includes(involvedGroupFilter)) return false;
      if (term && !item.key.toLowerCase().includes(term) && !item.summary.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [items, search, statusFilter, assignedGroupFilter, involvedGroupFilter]);

  const hasActiveFilters =
    search !== '' || statusFilter !== ALL || assignedGroupFilter !== ALL || involvedGroupFilter !== ALL;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter(ALL);
    setAssignedGroupFilter(ALL);
    setInvolvedGroupFilter(ALL);
  };

  return (
    <div
      className="mo-anim"
      style={{ background: C.white, border: `1px solid ${C.g200}`, borderRadius: 14, padding: '22px 24px 12px', boxShadow: 'var(--shadow-1)' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>Detalle de Puntos de Acción</h3>
        <span style={{ fontSize: 12.5, color: C.g400 }}>
          {filteredItems.length === items.length ? `${items.length}` : `${filteredItems.length} de ${items.length}`}
        </span>
      </div>

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
        <select value={assignedGroupFilter} onChange={(e) => setAssignedGroupFilter(e.target.value)} className="mo-select" style={selectStyle}>
          <option value={ALL}>Todos los grupos asignados</option>
          {assignedGroupOptions.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
        <select value={involvedGroupFilter} onChange={(e) => setInvolvedGroupFilter(e.target.value)} className="mo-select" style={selectStyle}>
          <option value={ALL}>Todos los grupos involucrados</option>
          {involvedGroupOptions.map((group) => (
            <option key={group} value={group}>
              {group}
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

      <div style={{ overflowX: 'auto', margin: '0 -24px', padding: '0 24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.g100}` }}>
              <th style={thStyle}>Clave</th>
              <th style={thStyle}>Resumen</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Prioridad</th>
              <th style={thStyle}>Tipo de Punto de Acción</th>
              <th style={thStyle}>Grupo Involucrado</th>
              <th style={thStyle}>Creado</th>
              <th style={thStyle}>Resuelto</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.key} style={{ borderBottom: `1px solid ${C.g100}` }}>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                  <KeyLink jiraKey={item.key} />
                </td>
                <td style={{ ...tdStyle, minWidth: 280, color: C.ink, fontWeight: 500 }}>{item.summary}</td>
                <td style={tdStyle}>
                  <StatusChip status={item.status} />
                </td>
                <td style={tdStyle}>
                  <PriorityPill priority={item.priority} />
                </td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{item.actionPointType || '—'}</td>
                <td style={{ ...tdStyle, color: C.g500 }}>
                  {item.involvedGroups && item.involvedGroups.length > 0 ? item.involvedGroups.join(', ') : '—'}
                </td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: C.g400 }}>{formatDate(item.created)}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: C.g400 }}>{formatDate(item.resolutiondate)}</td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.g400, fontSize: 13 }}>
                  No hay puntos de acción que coincidan con los filtros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
