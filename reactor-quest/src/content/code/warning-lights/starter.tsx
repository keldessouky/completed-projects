// level "ok"       → render nothing at all
// level "warn"     → <p className="warn">⚠ {message}</p>, message defaults to "Check systems"
// level "critical" → <p className="critical">CRITICAL: {message}</p>
export function Alert({ level, message }: { level: 'ok' | 'warn' | 'critical'; message?: string }) {
  return <p className="warn">⚠ {message}</p>;
}

// "Alerts (3)" when there are alerts; just "Alerts" when the count is 0.
export function AlertBadge({ count }: { count: number }) {
  return <span className="badge">Alerts{count && ` (${count})`}</span>;
}
