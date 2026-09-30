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
        background: C.ink,
        color: C.white,
        borderBottom: '1px solid rgba(255,255,255,.08)',
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
                style={{
                  background: 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,.6)',
                  border: 'none',
                  borderBottom: `2.5px solid ${active ? C.orange : 'transparent'}`,
                  padding: '15px 16px 13px',
                  fontSize: 13.5,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'color var(--dur-fast) var(--ease-out)',
                  letterSpacing: '-.01em',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,.08)', borderRadius: 8, padding: 3 }}>
            {PERIODS.map((p) => {
              const active = selectedDays === p.days;
              return (
                <button
                  key={p.days}
                  onClick={() => onDaysChange(p.days)}
                  style={{
                    background: active ? C.orange : 'transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,.7)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 11px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all var(--dur-fast) var(--ease-out)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,.15)' }} />

          <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(255,255,255,.45)', fontWeight: 600 }}>
              Última actualización
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)', marginTop: 2, fontWeight: 500 }}>
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
