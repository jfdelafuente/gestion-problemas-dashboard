'use client';

import { C } from '@/lib/theme';

// Estilos e infraestructura de filtro compartidos entre IssuesTable y ActionPointsTable —
// antes duplicados byte a byte en los dos ficheros.

export const ALL = '__all__';

export const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0 14px 10px',
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  color: C.g400,
  whiteSpace: 'nowrap',
};

export const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 13,
  color: C.g700,
  verticalAlign: 'top',
};

export const selectStyle: React.CSSProperties = {
  padding: '9px 12px',
  border: `1px solid ${C.g200}`,
  borderRadius: 8,
  fontSize: 13,
  color: C.ink,
  cursor: 'pointer',
  outline: 'none',
  backgroundColor: '#fff',
};

export function uniqueSorted(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
}

export interface FilterSelectSpec {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: string[];
}

interface TableFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  selects: FilterSelectSpec[];
  hasActiveFilters: boolean;
  onClear: () => void;
  searchPlaceholder?: string;
}

export function TableFilterBar({
  search,
  onSearchChange,
  selects,
  hasActiveFilters,
  onClear,
  searchPlaceholder = 'Buscar por clave o resumen…',
}: TableFilterBarProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
        <svg
          style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.g400 }}
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="mo-input"
          style={{ width: '100%', padding: '9px 12px 9px 34px', border: `1px solid ${C.g200}`, borderRadius: 8, fontSize: 13, color: C.ink, outline: 'none' }}
        />
      </div>
      {selects.map((s, i) => (
        <select key={i} value={s.value} onChange={(e) => s.onChange(e.target.value)} className="mo-select" style={selectStyle}>
          <option value={ALL}>{s.allLabel}</option>
          {s.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ))}
      {hasActiveFilters && (
        <button
          onClick={onClear}
          style={{ padding: '9px 14px', background: 'none', border: `1px solid ${C.g200}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.orange, cursor: 'pointer' }}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
