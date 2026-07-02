interface StatsCardProps {
  label: string;
  value: number;
  color: string;
  trend?: number;
}

export default function StatsCard({ label, value, color, trend }: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderLeftColor: color }}>
      <div className="text-gray-600 text-sm font-medium">{label}</div>
      <div className="text-4xl font-bold mt-2" style={{ color }}>
        {value}
      </div>
      {trend !== undefined && (
        <div className="text-xs mt-2 text-gray-500">
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}% vs último período
        </div>
      )}
    </div>
  );
}
