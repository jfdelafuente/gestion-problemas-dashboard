import { C } from '@/lib/theme';

export interface LegendItem {
  name: string;
  color: string;
  line?: boolean;
}

export default function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, margin: '12px 0 6px' }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {it.line ? (
            <span style={{ width: 16, height: 2.5, background: it.color, borderRadius: 2 }} />
          ) : (
            <span style={{ width: 11, height: 11, background: it.color, borderRadius: 3 }} />
          )}
          <span style={{ fontSize: 12, color: C.g600 }}>{it.name}</span>
        </div>
      ))}
    </div>
  );
}
