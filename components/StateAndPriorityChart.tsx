'use client';

import { useState } from 'react';
import { C, priorityStyle, statusColor, sortByStatusOrder } from '@/lib/theme';
import { HoverSegment } from '@/components/charts/HoverSegment';

interface StateAndPriorityChartProps {
  byState: Record<string, number>;
  byPriority: Record<string, number>;
}

const PRIORITY_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

function sortByPriorityOrder(priorities: string[]) {
  return [...priorities].sort((a, b) => {
    const ia = PRIORITY_ORDER.indexOf(a);
    const ib = PRIORITY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function DistributionPanel({
  title,
  data,
  colorFor,
  order,
}: {
  title: string;
  data: Record<string, number>;
  colorFor: (key: string) => string;
  order: string[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  const entries = order.filter((k) => data[k]).map((k) => [k, data[k]] as [string, number]);
  const total = entries.reduce((sum, [, v]) => sum + v, 0) || 1;

  return (
    <div style={{ background: C.white, border: `1px solid ${C.g200}`, borderRadius: 14, padding: '22px 24px', boxShadow: 'var(--shadow-1)' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</h3>
      {entries.length === 0 ? (
        <div style={{ fontSize: 13, color: C.g400 }}>Sin datos</div>
      ) : (
        <>
          {/* Sin overflow:hidden en la fila: recortaría el tooltip absoluto de cada segmento.
              El redondeo de los extremos se aplica solo al primer/último segmento en su lugar. */}
          <div style={{ display: 'flex', height: 12, borderRadius: 999, background: C.g100 }}>
            {entries.map(([k, v], i) => (
              <HoverSegment
                key={k}
                color={colorFor(k)}
                isFirst={i === 0}
                isLast={i === entries.length - 1}
                isSingle={entries.length === 1}
                borderRadiusWhenRounded={999}
                tooltip={`${k}: ${v} (${Math.round((v / total) * 100)}%)`}
                tooltipMarginBottom={8}
                isHovered={hover === k}
                onMouseEnter={() => setHover(k)}
                onMouseLeave={() => setHover((cur) => (cur === k ? null : cur))}
                style={{ width: `${(v / total) * 100}%` }}
              />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginTop: 16 }}>
            {entries.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: colorFor(k), flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.g600, flex: 1 }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{v}</span>
                <span style={{ fontSize: 12, color: C.g400, width: 38, textAlign: 'right' }}>{Math.round((v / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function StateAndPriorityChart({ byState, byPriority }: StateAndPriorityChartProps) {
  const stateOrder = sortByStatusOrder(Object.keys(byState));
  const priorityOrder = sortByPriorityOrder(Object.keys(byPriority));

  return (
    <div className="mo-anim" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
      <DistributionPanel title="Distribución por Estado" data={byState} colorFor={statusColor} order={stateOrder} />
      <DistributionPanel
        title="Distribución por Prioridad"
        data={byPriority}
        colorFor={(k) => priorityStyle(k).c}
        order={priorityOrder}
      />
    </div>
  );
}
