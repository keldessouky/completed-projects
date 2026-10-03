import { useEffect, useState } from 'react';

interface CountdownProps {
  from: number;
  tickMs?: number;
  onDone?: () => void;
}

export function Countdown({ from, tickMs = 1000, onDone }: CountdownProps) {
  const [left, setLeft] = useState(from);

  useEffect(() => {
    if (left <= 0) {
      onDone?.();
      return;
    }
    const id = setTimeout(() => setLeft((n) => n - 1), tickMs);
    return () => clearTimeout(id);
  }, [left, tickMs]);

  return <p className="countdown">T-{left}</p>;
}
