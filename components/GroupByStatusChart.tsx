'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface GroupByStatusChartProps {
  data: Array<Record<string, string | number>>;
  statuses: string[];
  title?: string;
}

const STATUS_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899'];

export default function GroupByStatusChart({
  data,
  statuses,
  title = 'Action Points por Grupo Asignado y Estado',
}: GroupByStatusChartProps) {
  const chartHeight = Math.max(300, data.length * 32);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="group" width={220} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {statuses.map((status, index) => (
            <Bar
              key={status}
              dataKey={status}
              stackId="status"
              fill={STATUS_COLORS[index % STATUS_COLORS.length]}
              name={status}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
