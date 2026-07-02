'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TimelineData {
  date: string;
  created: number;
  closed: number;
}

interface TimelineChartProps {
  data: TimelineData[];
}

export default function TimelineChart({ data }: TimelineChartProps) {
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
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="displayDate" angle={-45} textAnchor="end" height={80} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="created"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Problemas Creados"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="closed"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            name="Problemas Resueltos"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
