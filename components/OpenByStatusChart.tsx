'use client';

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface OpenByStatusChartProps {
  data: Array<Record<string, string | number>>;
  statuses: string[];
  title?: string;
  backlogLabel?: string;
}

const STATUS_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899'];

export default function OpenByStatusChart({
  data,
  statuses,
  title = 'No Cerradas por Estado y Backlog Acumulado',
  backlogLabel = 'Backlog Acumulado',
}: OpenByStatusChartProps) {
  const formattedData = data.map((item) => {
    const date = new Date(item.date as string);
    return {
      ...item,
      displayDate: date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
    };
  });

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="displayDate" angle={-45} textAnchor="end" height={80} />
          <YAxis yAxisId="left" stroke="#3b82f6" allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" stroke="#111827" allowDecimals={false} />
          <Tooltip />
          <Legend />
          {statuses.map((status, index) => (
            <Bar
              key={status}
              yAxisId="left"
              dataKey={status}
              stackId="status"
              fill={STATUS_COLORS[index % STATUS_COLORS.length]}
              name={status}
              isAnimationActive={false}
            />
          ))}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="backlog"
            stroke="#111827"
            strokeWidth={2}
            dot={false}
            name={backlogLabel}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
