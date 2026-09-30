'use client';

import { C } from '@/lib/theme';

export type Tab = 'general' | 'postmortem' | 'pmtasks' | 'problema' | 'actionpoints';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'postmortem', label: 'Postmortem' },
  { id: 'pmtasks', label: 'PM Tasks' },
  { id: 'problema', label: 'Problema' },
  { id: 'actionpoints', label: 'Action Points' },
];

const PERIODS: Array<{ days: number; label: string }> = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 365, label: '1 año' },
];

interface DashboardHeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  selectedDays: number;
  onDaysChange: (days: number) => void;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

export default function DashboardHeader({
  activeTab,
  onTabChange,
  selectedDays,
  onDaysChange,
  lastUpdated,
  onRefresh,
}: DashboardHeaderProps) {
  return (
    <header
      style={{
        background: C.white,
        borderBottom: `1px solid ${C.g200}`,
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          minHeight: 52,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`mo-subbar-tab ${active ? 'active' : ''}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
          <div style={{ display: 'inline-flex', background: C.g100, border: `1px solid ${C.g200}`, borderRadius: 8, padding: 3 }}>
            {PERIODS.map((p) => {
              const active = selectedDays === p.days;
              return (
                <button
                  key={p.days}
                  onClick={() => onDaysChange(p.days)}
                  className={`mo-subbar-period ${active ? 'active' : ''}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div style={{ width: 1, height: 22, background: C.g200 }} />

          <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.1em', color: C.g400, fontWeight: 600 }}>
              Última actualización
            </div>
            <div style={{ fontSize: 12, color: C.g700, marginTop: 2, fontWeight: 600 }}>
              {lastUpdated ? lastUpdated.toLocaleString('es-ES') : '—'}
            </div>
          </div>

          <button
            onClick={onRefresh}
            className="mo-refresh-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: C.orange,
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background var(--dur-fast) var(--ease-out)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            Actualizar
          </button>
        </div>
      </div>
    </header>
  );
}
