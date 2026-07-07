import { C } from '@/lib/theme';

export interface BarSpec {
  key: string;
  color: string;
}

export interface LineSpec {
  key: string;
  color: string;
}

interface BarLineChartProps {
  rows: Array<Record<string, string | number>>;
  bars: BarSpec[];
  line?: LineSpec | null;
  stacked?: boolean;
  height?: number;
}

export default function BarLineChart({ rows, bars, line, stacked = false, height = 300 }: BarLineChartProps) {
  const W = 860;
  const H = height;
  const padL = 40;
  const padR = line ? 46 : 16;
  const padT = 14;
  const padB = 44;
  const pw = W - padL - padR;
  const ph = H - padT - padB;

  const formatted: Array<Record<string, string | number>> = rows.map((r) => ({
    ...r,
    displayLabel:
      typeof r.date === 'string'
        ? new Date(r.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
        : String(r.date ?? ''),
  }));

  const n = formatted.length || 1;
  const gw = pw / n;

  const maxL = Math.max(
    1,
    ...formatted.map((r) =>
      stacked
        ? bars.reduce((sum, b) => sum + (Number(r[b.key]) || 0), 0)
        : Math.max(0, ...bars.map((b) => Number(r[b.key]) || 0))
    )
  );
  const maxR = line ? Math.max(1, ...formatted.map((r) => Number(r[line.key]) || 0)) : 1;
  const niceL = Math.max(1, Math.ceil(maxL / 4) * 4);
  const yFor = (v: number) => padT + ph - (v / niceL) * ph;

  const els: React.ReactNode[] = [];

  for (let i = 0; i <= 4; i++) {
    const val = (niceL / 4) * i;
    const y = yFor(val);
    els.push(<line key={'g' + i} x1={padL} x2={W - padR} y1={y} y2={y} stroke={C.g100} strokeWidth={1} />);
    els.push(
      <text key={'yl' + i} x={padL - 8} y={y + 4} textAnchor="end" fontSize={11} fill={C.g400}>
        {Math.round(val)}
      </text>
    );
  }

  const labelStep = Math.max(1, Math.ceil(formatted.length / 12));
  formatted.forEach((r, ri) => {
    const gx = padL + ri * gw;
    if (stacked) {
      let acc = 0;
      bars.forEach((b) => {
        const v = Number(r[b.key]) || 0;
        if (v > 0) {
          const bh = (v / niceL) * ph;
          const y = padT + ph - acc - bh;
          const bw = Math.max(1, Math.min(30, gw * 0.62));
          els.push(<rect key={'s' + ri + b.key} x={gx + gw / 2 - bw / 2} y={y} width={bw} height={bh} fill={b.color} />);
          acc += bh;
        }
      });
    } else {
      const bw = Math.min(16, (gw * 0.7) / bars.length);
      const rectWidth = Math.max(1, bw - 2);
      bars.forEach((b, bi) => {
        const v = Number(r[b.key]) || 0;
        const bh = (v / niceL) * ph;
        const x = gx + gw / 2 - (bars.length * bw) / 2 + bi * bw;
        els.push(<rect key={'b' + ri + bi} x={x} y={padT + ph - bh} width={rectWidth} height={bh} fill={b.color} rx={1.5} />);
      });
    }
    if (formatted.length > 0 && ri % labelStep === 0) {
      els.push(
        <text key={'xl' + ri} x={gx + gw / 2} y={H - padB + 18} textAnchor="middle" fontSize={10.5} fill={C.g400}>
          {r.displayLabel}
        </text>
      );
    }
  });

  if (line && formatted.length > 0) {
    const rMax = Math.ceil(maxR / 4) * 4 || 1;
    const yR = (v: number) => padT + ph - (v / rMax) * ph;
    const pts = formatted.map((r, ri) => `${padL + ri * gw + gw / 2},${yR(Number(r[line.key]) || 0)}`).join(' ');
    els.push(<polyline key="ln" points={pts} fill="none" stroke={line.color} strokeWidth={2.5} strokeLinejoin="round" />);
    formatted.forEach((r, ri) =>
      els.push(
        <circle key={'d' + ri} cx={padL + ri * gw + gw / 2} cy={yR(Number(r[line.key]) || 0)} r={2.6} fill={line.color} />
      )
    );
    for (let i = 0; i <= 4; i++) {
      const val = (rMax / 4) * i;
      els.push(
        <text key={'ry' + i} x={W - padR + 8} y={yR(val) + 4} textAnchor="start" fontSize={11} fill={line.color}>
          {Math.round(val)}
        </text>
      );
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {els}
    </svg>
  );
}
