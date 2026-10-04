import { useEffect, useState } from 'react';

/**
 * Seconds spent on a level during this visit — counting only while the tab is
 * visible and `running` is true (it stops once you've won).
 */
export function useLevelTimer(levelId: string, running: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => setSeconds(0), [levelId]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running, levelId]);

  return seconds;
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
