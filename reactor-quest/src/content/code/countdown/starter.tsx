import { useEffect, useState } from 'react';

interface CountdownProps {
  from: number;
  tickMs?: number; // how long one "second" lasts; tests speed it up
  onDone?: () => void;
}

// Shows <p className="countdown">T-3</p>, then T-2, T-1, T-0 — one step per tick.
// At T-0 it stops (never negative) and calls onDone once.
// When the component goes away, its timer must go away too.
//
// Run it: the preview gets stuck at T-2. Why?
export function Countdown({ from, tickMs = 1000, onDone }: CountdownProps) {
  const [left, setLeft] = useState(from);

  useEffect(() => {
    setInterval(() => {
      setLeft(left - 1);
    }, tickMs);
  }, []);

  return <p className="countdown">T-{left}</p>;
}
