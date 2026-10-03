export function Alert({ level, message }: { level: 'ok' | 'warn' | 'critical'; message?: string }) {
  if (level === 'ok') return null;
  if (level === 'warn') return <p className="warn">⚠ {message ?? 'Check systems'}</p>;
  return <p className="critical">CRITICAL: {message}</p>;
}

export function AlertBadge({ count }: { count: number }) {
  return <span className="badge">Alerts{count > 0 && ` (${count})`}</span>;
}
