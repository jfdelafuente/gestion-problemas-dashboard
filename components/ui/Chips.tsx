import { C, statusColor, priorityStyle, issueUrl } from '@/lib/theme';

export function PriorityPill({ priority }: { priority: string }) {
  const m = priorityStyle(priority);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 700,
        color: m.c,
        background: m.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {priority}
    </span>
  );
}

export function StatusChip({ status }: { status: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: C.g700, whiteSpace: 'nowrap' }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: statusColor(status), flexShrink: 0 }} />
      {status}
    </span>
  );
}

export function KeyLink({ jiraKey }: { jiraKey: string }) {
  return (
    <a
      href={issueUrl(jiraKey)}
      target="_blank"
      rel="noopener noreferrer"
      style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700, color: C.orange, textDecoration: 'none' }}
    >
      {jiraKey}
    </a>
  );
}
