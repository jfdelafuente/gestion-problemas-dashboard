'use client';

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TimelineData {
  date: string;
  created: number;
  closed: number;
  backlog?: number;
}

interface TimelineChartProps {
  data: TimelineData[];
  createdLabel?: string;
  closedLabel?: string;
  backlogLabel?: string;
  showBacklog?: boolean;
}

export default function TimelineChart({
  data,
  createdLabel = 'Problemas Creados',
  closedLabel = 'Problemas Resueltos',
  backlogLabel = 'Backlog',
  showBacklog = false,
}: TimelineChartProps) {
  // Format dates to be more readable
  const formattedData = data.map((item) => {
    const date = new Date(item.date);
    return {
      ...item,
      displayDate: date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
    };
  });

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Tendencia Temporal</h3>
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="displayDate" angle={-45} textAnchor="end" height={80} />
          <YAxis yAxisId="left" stroke="#3b82f6" allowDecimals={false} />
          {showBacklog && (
            <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" allowDecimals={false} />
          )}
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="created" fill="#3b82f6" name={createdLabel} isAnimationActive={false} />
          <Bar yAxisId="left" dataKey="closed" fill="#10b981" name={closedLabel} isAnimationActive={false} />
          {showBacklog && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="backlog"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name={backlogLabel}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
