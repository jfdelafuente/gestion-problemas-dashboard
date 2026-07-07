import { C, statusColor, sortByStatusOrder } from '@/lib/theme';
import ChartCard from '@/components/charts/ChartCard';
import ChartLegend from '@/components/charts/ChartLegend';

interface GroupByStatusChartProps {
  data: Array<Record<string, string | number>>;
  statuses: string[];
  title?: string;
  subtitle?: string;
}

export default function GroupByStatusChart({
  data,
  statuses,
  title = 'Action Points por Grupo Asignado y Estado',
  subtitle = 'Apilado por estado',
}: GroupByStatusChartProps) {
  const orderedStatuses = sortByStatusOrder(statuses);
  const maxTotal = Math.max(1, ...data.map((r) => Number(r.total) || 0));

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      legend={<ChartLegend items={orderedStatuses.map((s) => ({ name: s, color: statusColor(s) }))} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
        {data.map((row) => {
          const total = Number(row.total) || 0;
          return (
            <div key={row.group} style={{ display: 'grid', gridTemplateColumns: '190px 1fr 34px', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 12.5, color: C.g700, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.group}
              </div>
              <div
                style={{
                  display: 'flex',
                  height: 22,
                  borderRadius: 5,
                  overflow: 'hidden',
                  background: C.g50,
                  width: `${(total / maxTotal) * 100}%`,
                  minWidth: 2,
                }}
              >
                {orderedStatuses
                  .filter((s) => Number(row[s]) > 0)
                  .map((s) => (
                    <div key={s} title={`${s}: ${row[s]}`} style={{ flex: Number(row[s]), background: statusColor(s) }} />
                  ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{total}</div>
            </div>
          );
        })}
        {data.length === 0 && <div style={{ fontSize: 13, color: C.g400 }}>Sin datos</div>}
      </div>
    </ChartCard>
  );
}
