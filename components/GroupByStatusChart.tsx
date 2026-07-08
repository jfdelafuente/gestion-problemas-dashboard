'use client';

import { useState } from 'react';
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
                      <div
                        key={s}
                        onMouseEnter={() => setHover({ group, status: s })}
                        onMouseLeave={() => setHover((cur) => (cur?.group === group && cur.status === s ? null : cur))}
                        style={{
                          position: 'relative',
                          flex: Number(row[s]),
                          background: statusColor(s),
                          cursor: 'pointer',
                          borderRadius:
                            visibleStatuses.length === 1
                              ? 5
                              : i === 0
                                ? '5px 0 0 5px'
                                : i === visibleStatuses.length - 1
                                  ? '0 5px 5px 0'
                                  : 0,
                        }}
                      >
                        {isHovered && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              marginBottom: 6,
                              background: C.ink,
                              color: C.white,
                              fontSize: 11.5,
                              fontWeight: 600,
                              padding: '5px 9px',
                              borderRadius: 6,
                              whiteSpace: 'nowrap',
                              pointerEvents: 'none',
                              boxShadow: 'var(--shadow-2)',
                              zIndex: 5,
                            }}
                          >
                            {s}: {row[s]}
                          </div>
                        )}
                      </div>
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
