import { C } from '@/lib/theme';

export interface KpiDelta {
  dir: 'up' | 'down';
  text: string;
  good: boolean;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  tone: string;
  sub: string;
  delta?: KpiDelta | null;
}

export function computeDelta(
  current: number,
  previous: number,
  betterDirection: 'up' | 'down' = 'up',
  opts: { absolute?: boolean; unit?: string } = {}
): KpiDelta | null {
  if (previous === 0 && current === 0) return null;

  let dir: 'up' | 'down';
  let text: string;

  if (opts.absolute) {
    const diff = current - previous;
    if (diff === 0) return null;
    dir = diff >= 0 ? 'up' : 'down';
    const rounded = Math.round(Math.abs(diff) * 10) / 10;
    text = rounded + (opts.unit || '');
  } else if (previous === 0) {
    dir = 'up';
    text = `+${current}`;
  } else {
    const pct = ((current - previous) / previous) * 100;
    if (Math.round(pct) === 0) return null;
    dir = pct >= 0 ? 'up' : 'down';
    text = Math.abs(Math.round(pct)) + '%';
  }

  const good = dir === 'up' ? betterDirection === 'up' : betterDirection === 'down';
  return { dir, text, good };
}

export default function KpiCard({ label, value, tone, sub, delta }: KpiCardProps) {
  const deltaColor = delta ? (delta.good ? C.success : C.danger) : C.g400;
  const deltaBg = delta ? (delta.good ? '#E4F1EA' : '#FBE3E1') : C.g100;

  return (
    <div style={{ background: C.white, border: `1px solid ${C.g200}`, borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-1)' }}>
      <div style={{ height: 3, background: tone }} />
      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 600, color: C.g400, minHeight: 26 }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 8 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 800, lineHeight: 1, letterSpacing: '-.03em', color: C.ink }}>
            {value}
          </div>
          {delta && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 12,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 999,
                marginBottom: 4,
                background: deltaBg,
                color: deltaColor,
              }}
            >
              {delta.dir === 'up' ? '↑' : '↓'} {delta.text}
            </div>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: C.g600, marginTop: 9 }}>{sub}</div>
      </div>
    </div>
  );
}
