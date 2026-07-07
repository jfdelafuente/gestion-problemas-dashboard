'use client';

import { useMemo, useState } from 'react';

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

const PRIORITY_COLORS: Record<string, string> = {
  Highest: 'bg-red-100 text-red-800',
  High: 'bg-orange-100 text-orange-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-green-100 text-green-800',
  Lowest: 'bg-gray-100 text-gray-800',
};

const ALL = '__all__';

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-ES');
}

function issueUrl(key: string) {
  return `https://${process.env.NEXT_PUBLIC_JIRA_DOMAIN}/browse/${key}`;
}

function uniqueSorted(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) =>
    a.localeCompare(b)
  );
}

export default function ActionPointsTable({ items }: ActionPointsTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [assignedGroupFilter, setAssignedGroupFilter] = useState(ALL);
  const [involvedGroupFilter, setInvolvedGroupFilter] = useState(ALL);

  const statusOptions = useMemo(() => uniqueSorted(items.map((i) => i.status)), [items]);
  const assignedGroupOptions = useMemo(() => uniqueSorted(items.map((i) => i.assignedGroup)), [items]);
  const involvedGroupOptions = useMemo(
    () => uniqueSorted(items.flatMap((i) => i.involvedGroups || [])),
    [items]
  );

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== ALL && item.status !== statusFilter) return false;
      if (assignedGroupFilter !== ALL && item.assignedGroup !== assignedGroupFilter) return false;
      if (involvedGroupFilter !== ALL && !(item.involvedGroups || []).includes(involvedGroupFilter)) return false;
      if (term && !item.key.toLowerCase().includes(term) && !item.summary.toLowerCase().includes(term)) {
        return false;
      }
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
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Detalle de Action Points ({filteredItems.length}
        {filteredItems.length !== items.length ? ` de ${items.length}` : ''})
      </h2>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por clave o resumen..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value={ALL}>Todos los estados</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={assignedGroupFilter}
          onChange={(e) => setAssignedGroupFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value={ALL}>Todos los grupos asignados</option>
          {assignedGroupOptions.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
        <select
          value={involvedGroupFilter}
          onChange={(e) => setInvolvedGroupFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
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
            className="px-3 py-2 text-sm text-blue-600 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Clave</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Resumen</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prioridad</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo de Punto de Acción</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grupo Asignado</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grupo Involucrado</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Creado</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Resuelto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredItems.map((item) => (
              <tr key={item.key} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm font-medium whitespace-nowrap">
                  <a
                    href={issueUrl(item.key)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {item.key}
                  </a>
                </td>
                <td className="px-4 py-2 text-sm text-gray-700">{item.summary}</td>
                <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                  {item.done ? '✅' : '⏳'} {item.status}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[item.priority] || 'bg-gray-100 text-gray-800'}`}>
                    {item.priority}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{item.actionPointType || '-'}</td>
                <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{item.assignedGroup || '-'}</td>
                <td className="px-4 py-2 text-sm text-gray-700">
                  {item.involvedGroups && item.involvedGroups.length > 0 ? item.involvedGroups.join(', ') : '-'}
                </td>
                <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{formatDate(item.created)}</td>
                <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{formatDate(item.resolutiondate)}</td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-500">
                  No hay Action Points para mostrar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
