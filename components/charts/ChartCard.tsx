import { C } from '@/lib/theme';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
}

export default function ChartCard({ title, subtitle, legend, children }: ChartCardProps) {
  return (
    <div
      className="mo-anim"
      style={{
        background: C.white,
        border: `1px solid ${C.g200}`,
        borderRadius: 14,
        padding: '22px 24px',
        boxShadow: 'var(--shadow-1)',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</h3>
        {subtitle && <span style={{ fontSize: 12, color: C.g400 }}>{subtitle}</span>}
      </div>
      {legend}
      {children}
    </div>
  );
}
