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

function KpiGroup({
  title,
  data,
  colors,
}: {
  title: string;
  data: Record<string, number>;
  colors: Record<string, string>;
}) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="flex flex-wrap gap-3">
        {entries.map(([name, value]) => {
          const pct = total > 0 ? (value / total) * 100 : 0;
          return (
            <div key={name} className="flex-1 min-w-[110px] border border-gray-100 rounded-md p-3">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: colors[name] || '#6b7280' }}
                />
                <span className="text-xs text-gray-600 truncate" title={name}>
                  {name}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{pct.toFixed(0)}%</div>
              <div className="text-xs text-gray-400">{value} issues</div>
            </div>
          );
        })}
        {entries.length === 0 && <div className="text-sm text-gray-500">Sin datos</div>}
      </div>
    </div>
  );
}

export default function StateAndPriorityChart({ byState, byPriority }: StateAndPriorityChartProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <KpiGroup title="Distribución por Estado" data={byState} colors={stateColors} />
      <KpiGroup title="Distribución por Prioridad" data={byPriority} colors={priorityColors} />
    </div>
  );
}
