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
  // Tarjeta más pequeña para KPIs subordinadas (p.ej. PM Tasks bajo Postmortems en la vista
  // General), de forma que su peso visual sea menor que el del bloque padre.
  compact?: boolean;
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

// Icono por rol de la tarjeta (deducido del tono, ya consistente en toda la app: naranja =
// total, rojo = pendiente/abierto, verde = completado/cerrado, gris oscuro = medida/ritmo).
// Da una segunda señal además del color, para no depender solo de distinguir tonos.
function RoleIcon({ tone }: { tone: string }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (tone === C.danger) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="13" />
        <line x1="12" y1="16.5" x2="12" y2="16.5" />
      </svg>
    );
  }
  if (tone === C.success) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 5-5.5" />
      </svg>
    );
  }
  if (tone === C.g600) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3.5" y="4.5" width="17" height="4.5" rx="1.2" />
      <rect x="3.5" y="11" width="17" height="4.5" rx="1.2" />
      <rect x="3.5" y="17.5" width="10" height="2.5" rx="1.2" />
    </svg>
  );
}

export default function KpiCard({ label, value, tone, sub, delta, compact = false }: KpiCardProps) {
  const deltaColor = delta ? (delta.good ? C.success : C.danger) : C.g400;
  const deltaBg = delta ? (delta.good ? '#E4F1EA' : '#FBE3E1') : C.g100;

  return (
    <div style={{ background: compact ? C.g50 : C.white, border: `1px solid ${C.g200}`, borderRadius: compact ? 10 : 14, overflow: 'hidden', boxShadow: compact ? 'none' : 'var(--shadow-1)' }}>
      <div style={{ height: compact ? 2 : 3, background: tone }} />
      <div style={{ padding: compact ? '12px 14px 13px' : '18px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, minHeight: compact ? 18 : 26 }}>
          <div style={{ fontSize: compact ? 10 : 11, textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 600, color: C.g400 }}>
            {label}
          </div>
          <span style={{ color: tone, opacity: 0.5, flexShrink: 0, marginTop: 1 }}>
            <RoleIcon tone={tone} />
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: compact ? 4 : 8 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: compact ? 26 : 42,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-.03em',
              color: C.ink,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </div>
          {delta && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: compact ? 11 : 12,
                fontWeight: 700,
                padding: compact ? '2px 6px' : '3px 8px',
                borderRadius: 999,
                marginBottom: compact ? 2 : 4,
                background: deltaBg,
                color: deltaColor,
              }}
            >
              {delta.dir === 'up' ? '↑' : '↓'} {delta.text}
            </div>
          )}
        </div>
        {!compact && <div style={{ fontSize: 12.5, color: C.g600, marginTop: 9 }}>{sub}</div>}
      </div>
    </div>
  );
}
