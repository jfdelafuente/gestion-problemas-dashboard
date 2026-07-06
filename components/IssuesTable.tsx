'use client';

import { Fragment, useState } from 'react';

interface SubtaskRow {
  key: string;
  summary: string;
  status: string;
  priority: string;
  done: boolean;
  actionPointType?: string;
  assignedGroup?: string;
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
  showType?: boolean;
  showAssignedGroup?: boolean;
  secondGroupColumn?: 'involved' | 'resolving' | 'none';
  showSubtasks?: boolean;
  subtasksLabel?: string;
  showActionPointType?: boolean;
  showSubtaskAssignedGroup?: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  Highest: 'bg-red-100 text-red-800',
  High: 'bg-orange-100 text-orange-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-green-100 text-green-800',
  Lowest: 'bg-gray-100 text-gray-800',
};

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-ES');
}

function issueUrl(key: string) {
  return `https://${process.env.NEXT_PUBLIC_JIRA_DOMAIN}/browse/${key}`;
}

export default function IssuesTable({
  issues,
  showType = true,
  showAssignedGroup = true,
  secondGroupColumn = 'involved',
  showSubtasks = false,
  subtasksLabel = 'Subtareas',
  showActionPointType = false,
  showSubtaskAssignedGroup = false,
}: IssuesTableProps) {
  const showSecondGroupColumn = secondGroupColumn !== 'none';
  const columnCount =
    (showType ? 9 : 8) + (showSubtasks ? 1 : 0) - (showSecondGroupColumn ? 0 : 1) - (showAssignedGroup ? 0 : 1);
  const secondGroupLabel = secondGroupColumn === 'resolving' ? 'Grupo/s Resolutor/es' : 'Grupo Involucrado';
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

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
    <div className="bg-white rounded-lg shadow-md p-6 mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Detalle de Problemas ({issues.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Clave</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Resumen</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prioridad</th>
              {showType && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              )}
              {showAssignedGroup && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grupo Asignado</th>
              )}
              {showSecondGroupColumn && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{secondGroupLabel}</th>
              )}
              {showSubtasks && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{subtasksLabel}</th>
              )}
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Creado</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Resuelto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {issues.map((issue) => {
              const isExpanded = expandedKeys.has(issue.key);
              const canExpand = showSubtasks && issue.subtasksTotal > 0;

              return (
                <Fragment key={issue.key}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-medium whitespace-nowrap">
                      <a
                        href={issueUrl(issue.key)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {issue.key}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{issue.summary}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{issue.status}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[issue.priority] || 'bg-gray-100 text-gray-800'}`}>
                        {issue.priority}
                      </span>
                    </td>
                    {showType && (
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{issue.type}</td>
                    )}
                    {showAssignedGroup && (
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{issue.assignedGroup}</td>
                    )}
                    {showSecondGroupColumn && (
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {secondGroupColumn === 'resolving' ? issue.resolvingGroups : issue.involvedGroups}
                      </td>
                    )}
                    {showSubtasks && (
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                        {canExpand ? (
                          <button
                            onClick={() => toggleExpanded(issue.key)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            <span>{isExpanded ? '▾' : '▸'}</span>
                            <span>{issue.subtasksDone}/{issue.subtasksTotal}</span>
                          </button>
                        ) : (
                          `${issue.subtasksDone}/${issue.subtasksTotal}`
                        )}
                      </td>
                    )}
                    <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{formatDate(issue.created)}</td>
                    <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{formatDate(issue.resolutiondate)}</td>
                  </tr>
                  {canExpand && isExpanded && (
                    <tr>
                      <td colSpan={columnCount} className="px-4 py-3 bg-blue-50 border-l-4 border-blue-300">
                        <table className="min-w-full font-mono text-xs">
                          <thead>
                            <tr className="text-[10px] font-medium text-blue-700 uppercase">
                              <th className="text-left py-1 pr-4">Clave</th>
                              <th className="text-left py-1 pr-4">Resumen</th>
                              <th className="text-left py-1 pr-4">Estado</th>
                              <th className="text-left py-1 pr-4">Prioridad</th>
                              {showActionPointType && (
                                <th className="text-left py-1 pr-4">Tipo de Punto de Acción</th>
                              )}
                              {showSubtaskAssignedGroup && (
                                <th className="text-left py-1 pr-4">Grupo Asignado</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-100">
                            {issue.subtasks.map((task) => (
                              <tr key={task.key}>
                                <td className="py-1 pr-4 font-medium whitespace-nowrap">
                                  <a
                                    href={issueUrl(task.key)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    {task.key}
                                  </a>
                                </td>
                                <td className="py-1 pr-4 text-gray-700">{task.summary}</td>
                                <td className="py-1 pr-4 text-gray-700 whitespace-nowrap">
                                  {task.done ? '✅' : '⏳'} {task.status}
                                </td>
                                <td className="py-1 pr-4 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${PRIORITY_COLORS[task.priority] || 'bg-gray-100 text-gray-800'}`}>
                                    {task.priority}
                                  </span>
                                </td>
                                {showActionPointType && (
                                  <td className="py-1 pr-4 text-gray-700 whitespace-nowrap">{task.actionPointType || '-'}</td>
                                )}
                                {showSubtaskAssignedGroup && (
                                  <td className="py-1 pr-4 text-gray-700 whitespace-nowrap">{task.assignedGroup || '-'}</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {issues.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-sm text-gray-500">
                  No hay problemas para mostrar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
