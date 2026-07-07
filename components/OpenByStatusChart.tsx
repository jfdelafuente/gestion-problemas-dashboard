import { C, statusColor } from '@/lib/theme';
import ChartCard from '@/components/charts/ChartCard';
import ChartLegend from '@/components/charts/ChartLegend';
import BarLineChart from '@/components/charts/BarLineChart';

interface OpenByStatusChartProps {
  data: Array<Record<string, string | number>>;
  statuses: string[];
  title?: string;
  subtitle?: string;
  backlogLabel?: string;
}

export default function OpenByStatusChart({
  data,
  statuses,
  title = 'No Cerradas por Estado y Backlog Acumulado',
  subtitle = 'Apilado por estado · backlog acumulado',
  backlogLabel = 'Backlog',
}: OpenByStatusChartProps) {
  const legendItems = [
    ...statuses.map((s) => ({ name: s, color: statusColor(s) })),
    { name: backlogLabel, color: C.ink, line: true },
  ];

  return (
    <ChartCard title={title} subtitle={subtitle} legend={<ChartLegend items={legendItems} />}>
      <BarLineChart
        rows={data}
        bars={statuses.map((s) => ({ key: s, color: statusColor(s) }))}
        line={{ key: 'backlog', color: C.ink }}
        stacked
      />
    </ChartCard>
  );
}
