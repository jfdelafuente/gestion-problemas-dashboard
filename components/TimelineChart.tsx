import { C } from '@/lib/theme';
import ChartCard from '@/components/charts/ChartCard';
import ChartLegend from '@/components/charts/ChartLegend';
import BarLineChart from '@/components/charts/BarLineChart';

interface TimelineData extends Record<string, string | number> {
  date: string;
  created: number;
  closed: number;
  backlog: number;
}

interface TimelineChartProps {
  data: TimelineData[];
  title?: string;
  subtitle?: string;
  createdLabel?: string;
  closedLabel?: string;
  backlogLabel?: string;
  showBacklog?: boolean;
}

export default function TimelineChart({
  data,
  title = 'Tendencia Temporal',
  subtitle,
  createdLabel = 'Entradas',
  closedLabel = 'Resueltas',
  backlogLabel = 'Backlog',
  showBacklog = false,
}: TimelineChartProps) {
  const legendItems = [
    { name: createdLabel, color: C.orange },
    { name: closedLabel, color: C.success },
    ...(showBacklog ? [{ name: backlogLabel, color: C.ink, line: true }] : []),
  ];

  return (
    <ChartCard title={title} subtitle={subtitle} legend={<ChartLegend items={legendItems} />}>
      <BarLineChart
        rows={data}
        bars={[
          { key: 'created', color: C.orange },
          { key: 'closed', color: C.success },
        ]}
        line={showBacklog ? { key: 'backlog', color: C.ink } : null}
      />
    </ChartCard>
  );
}
