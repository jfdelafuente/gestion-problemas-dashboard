'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface StateAndPriorityChartProps {
  byState: Record<string, number>;
  byPriority: Record<string, number>;
}

const stateColors: Record<string, string> = {
  'Open': '#ef4444',
  'To Do': '#ef4444',
  'In Progress': '#f59e0b',
  'In Review': '#3b82f6',
  'Done': '#10b981',
  'Closed': '#10b981',
};

const priorityColors: Record<string, string> = {
  'Highest': '#dc2626',
  'High': '#ef4444',
  'Medium': '#f59e0b',
  'Low': '#3b82f6',
  'Lowest': '#06b6d4',
};

export default function StateAndPriorityChart({ byState, byPriority }: StateAndPriorityChartProps) {
  const stateData = Object.entries(byState).map(([name, value]) => ({ name, value }));
  const priorityData = Object.entries(byPriority).map(([name, value]) => ({ name, value }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* By State */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribución por Estado</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stateData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {stateData.map((entry, index) => (
                <Cell key={`state-${index}`} fill={stateColors[entry.name] || '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* By Priority */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribución por Prioridad</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={priorityData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {priorityData.map((entry, index) => (
                <Cell key={`priority-${index}`} fill={priorityColors[entry.name] || '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
