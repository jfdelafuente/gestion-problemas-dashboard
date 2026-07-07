export const C = {
  ink: '#000000',
  white: '#FFFFFF',
  orange: '#FF7900',
  orangeHover: '#E66D00',
  orangeTint: '#FFE7D1',
  yellow: '#FFD200',
  g50: '#F7F6F4',
  g100: '#EFEDE9',
  g200: '#DEDAD3',
  g300: '#B8B2A9',
  g400: '#8A857C',
  g500: '#5C5852',
  g600: '#3D3A36',
  g700: '#26241F',
  danger: '#D43A2F',
  warning: '#E6A100',
  success: '#1D8754',
  info: '#2E6BD4',
};

// Colores por estado de Jira (nombres reales en español, no los del mock de diseño).
const STATUS_COLOR_MAP: Record<string, string> = {
  Registrada: C.danger,
  'En progreso': C.orange,
  'En Validación': C.warning,
  'En revisión': C.warning,
  Resuelta: C.success,
  Cerrada: C.g700,
  Cancelada: C.g400,
  'Postmortem Final': C.info,
};

// Orden estable para leyendas/gráficos cuando el estado no está en el mapa conocido.
export const STATUS_ORDER = [
  'Registrada',
  'En progreso',
  'En Validación',
  'En revisión',
  'Resuelta',
  'Cerrada',
  'Cancelada',
  'Postmortem Final',
];

const FALLBACK_PALETTE = [C.orange, C.info, C.success, C.warning, C.danger, C.g500, C.yellow];

export function statusColor(status: string): string {
  if (STATUS_COLOR_MAP[status]) return STATUS_COLOR_MAP[status];
  let hash = 0;
  for (let i = 0; i < status.length; i++) hash = (hash * 31 + status.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

export function sortByStatusOrder(statuses: string[]): string[] {
  return [...statuses].sort((a, b) => {
    const ia = STATUS_ORDER.indexOf(a);
    const ib = STATUS_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// Prioridades reales de Jira (inglés) mapeadas a la paleta semántica del diseño.
const PRIORITY_COLOR_MAP: Record<string, { c: string; bg: string }> = {
  Highest: { c: C.danger, bg: '#FBE3E1' },
  High: { c: '#C85A00', bg: C.orangeTint },
  Medium: { c: '#8A6500', bg: '#FBEFCB' },
  Low: { c: C.g500, bg: C.g100 },
  Lowest: { c: C.g400, bg: C.g50 },
};

export function priorityStyle(priority: string): { c: string; bg: string } {
  return PRIORITY_COLOR_MAP[priority] || { c: C.g500, bg: C.g100 };
}

export function issueUrl(key: string) {
  return `https://${process.env.NEXT_PUBLIC_JIRA_DOMAIN}/browse/${key}`;
}

export function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
