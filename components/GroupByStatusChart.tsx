'use client';

import { useState } from 'react';
import { C, statusColor, sortByStatusOrder } from '@/lib/theme';
import { HoverSegment } from '@/components/charts/HoverSegment';
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
  const [hover, setHover] = useState<{ group: string; status: string } | null>(null);
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
              {/* Sin overflow:hidden en la fila: recortaría el tooltip absoluto de cada
                  segmento. El redondeo de los extremos se aplica al primer/último segmento. */}
              <div
                style={{
                  display: 'flex',
                  height: 22,
                  borderRadius: 5,
                  background: C.g50,
                  width: `${(total / maxTotal) * 100}%`,
                  minWidth: 2,
                }}
              >
                {(() => {
                  const visibleStatuses = orderedStatuses.filter((s) => Number(row[s]) > 0);
                  return visibleStatuses.map((s, i) => {
                    const group = String(row.group);
                    const isHovered = hover?.group === group && hover.status === s;
                    return (
                      <HoverSegment
                        key={s}
                        color={statusColor(s)}
                        isFirst={i === 0}
                        isLast={i === visibleStatuses.length - 1}
                        isSingle={visibleStatuses.length === 1}
                        borderRadiusWhenRounded={5}
                        tooltip={`${s}: ${row[s]}`}
                        tooltipMarginBottom={6}
                        isHovered={isHovered}
                        onMouseEnter={() => setHover({ group, status: s })}
                        onMouseLeave={() => setHover((cur) => (cur?.group === group && cur.status === s ? null : cur))}
                        style={{ flex: Number(row[s]) }}
                      />
                    );
                  });
                })()}
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
