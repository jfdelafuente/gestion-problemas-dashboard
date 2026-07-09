'use client';

import { useMemo, useState } from 'react';
import { C, formatDate } from '@/lib/theme';
import { StatusChip, PriorityPill, KeyLink, GroupTags } from '@/components/ui/Chips';
import { ALL, thStyle, tdStyle, uniqueSorted, TableFilterBar } from '@/components/table/shared';

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
  title?: string;
  emptyLabel?: string;
  showActionPointType?: boolean;
  groupColumn?: 'involved' | 'assigned';
}

export default function ActionPointsTable({
  items,
  title = 'Detalle de Puntos de Acción',
  emptyLabel = 'No hay puntos de acción que coincidan con los filtros',
  showActionPointType = true,
  groupColumn = 'involved',
}: ActionPointsTableProps) {
  const columnCount = showActionPointType ? 8 : 7;
  const groupColumnLabel = groupColumn === 'assigned' ? 'Grupo Asignado' : 'Grupo Involucrado';
  const groupFilterAllLabel = groupColumn === 'assigned' ? 'Todos los grupos asignados' : 'Todos los grupos involucrados';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  // Un único filtro de grupo, alineado con la única columna de grupo que muestra la tabla
  // (Grupo Asignado en PM Tasks, Grupo Involucrado en Action Points): no tiene sentido filtrar
  // por una dimensión que ni siquiera se ve en esta tabla.
  const [groupFilter, setGroupFilter] = useState(ALL);

  const statusOptions = useMemo(() => uniqueSorted(items.map((i) => i.status)), [items]);
  const groupOptions = useMemo(
    () =>
      groupColumn === 'assigned'
        ? uniqueSorted(items.map((i) => i.assignedGroup))
        : uniqueSorted(items.flatMap((i) => i.involvedGroups || [])),
    [items, groupColumn]
  );

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== ALL && item.status !== statusFilter) return false;
      if (groupFilter !== ALL) {
        const matches =
          groupColumn === 'assigned' ? item.assignedGroup === groupFilter : (item.involvedGroups || []).includes(groupFilter);
        if (!matches) return false;
      }
      if (term && !item.key.toLowerCase().includes(term) && !item.summary.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [items, search, statusFilter, groupFilter, groupColumn]);

  const hasActiveFilters = search !== '' || statusFilter !== ALL || groupFilter !== ALL;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter(ALL);
    setGroupFilter(ALL);
  };

  return (
    <div
      className="mo-anim"
      style={{ background: C.white, border: `1px solid ${C.g200}`, borderRadius: 14, padding: '22px 24px 12px', boxShadow: 'var(--shadow-1)' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</h3>
        <span style={{ fontSize: 12.5, color: C.g400 }}>
          {filteredItems.length === items.length ? `${items.length}` : `${filteredItems.length} de ${items.length}`}
        </span>
      </div>

      <TableFilterBar
        search={search}
        onSearchChange={setSearch}
        selects={[
          { value: statusFilter, onChange: setStatusFilter, allLabel: 'Todos los estados', options: statusOptions },
          { value: groupFilter, onChange: setGroupFilter, allLabel: groupFilterAllLabel, options: groupOptions },
        ]}
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
      />

      <div style={{ overflowX: 'auto', margin: '0 -24px', padding: '0 24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.g100}` }}>
              <th style={thStyle}>Clave</th>
              <th style={thStyle}>Resumen</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Prioridad</th>
              {showActionPointType && <th style={thStyle}>Tipo de Punto de Acción</th>}
              <th style={thStyle}>{groupColumnLabel}</th>
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
                {showActionPointType && (
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{item.actionPointType || '—'}</td>
                )}
                <td style={{ ...tdStyle, color: C.g500 }}>
                  {groupColumn === 'assigned' ? item.assignedGroup || '—' : <GroupTags groups={item.involvedGroups || []} />}
                </td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: C.g400 }}>{formatDate(item.created)}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: C.g400 }}>{formatDate(item.resolutiondate)}</td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={columnCount} style={{ padding: 40, textAlign: 'center', color: C.g400, fontSize: 13 }}>
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
