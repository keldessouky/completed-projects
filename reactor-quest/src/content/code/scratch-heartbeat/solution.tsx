import { useEffect, useState } from 'react';

export function useTicker(ms: number, running: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setCount((c) => c + 1), ms);
    return () => clearInterval(id);
  }, [ms, running]);

  return count;
}

export function Heartbeat({ ms }: { ms: number }) {
  const [running, setRunning] = useState(true);
  const beats = useTicker(ms, running);
  return (
    <div className="heartbeat">
      <p className="beats">Beats: {beats}</p>
      <button onClick={() => setRunning((r) => !r)}>{running ? 'Pause' : 'Resume'}</button>
    </div>
  );
}
