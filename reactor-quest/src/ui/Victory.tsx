import { useEffect } from 'react';
import { ALL_LEVELS } from '../content';
import { rankOf } from '../game/progress';
import { useSave } from '../game/store';
import type { Level } from '../game/types';
import { go } from './router';

const LINES = [
  'System restored. The station hums a little louder.',
  'Compiler satisfied. That is not a small thing.',
  'Green across the board. The crew noticed.',
  'Another light comes on down the corridor.',
  'Clean build. ARIA approves.',
];

export function Victory({ level, stars, xp, onReplay, onClose }: { level: Level; stars: number; xp: number; onReplay(): void; onClose(): void }) {
  const save = useSave();
  const rank = rankOf(save.xp);
  const idx = ALL_LEVELS.findIndex((l) => l.id === level.id);
  const next = ALL_LEVELS[idx + 1];
  const final = !next;
  const line = final
    ? 'The reactor core is online. Orrery Station is alive again — because of you, engineer.'
    : 'boss' in level && level.boss
      ? 'Deck cleared! The next section of the station powers up.'
      : LINES[idx % LINES.length];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) go(next ? `/level/${next.id}` : '/map');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next]);

  return (
    <div className="modal-backdrop victory-backdrop">
      <div className={`modal victory ${final ? 'final' : ''}`} role="dialog" aria-modal="true" aria-label="Level complete">
        <div className="burst" aria-hidden />
        <p className="victory-kicker">{level.system} — online</p>
        <div className="big-stars" aria-label={`${stars} of 3 stars`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < stars ? 'on' : ''} style={{ animationDelay: `${0.15 + i * 0.18}s` }}>★</span>
          ))}
        </div>
        <p className="aria-line"><b>ARIA:</b> {line}</p>
        <div className="xp-gain">{xp > 0 ? `+${xp} XP` : 'No new XP — beat your best stars to earn more'}</div>
        <div className="rank-row">
          <span>{rank.name}</span>
          <div className="bar"><div style={{ width: `${Math.round(rank.progress * 100)}%` }} /></div>
          <span className="muted small">{rank.next ? `${rank.toNext} XP to ${rank.next}` : 'Max rank'}</span>
        </div>
        <div className="modal-actions">
          {stars < 3 && <button className="btn ghost" onClick={onReplay}>Replay for ★★★</button>}
          <button className="btn ghost" onClick={onClose}>Stay here</button>
          {next ? (
            <button className="btn primary" autoFocus onClick={() => go(`/level/${next.id}`)}>Next system →</button>
          ) : (
            <button className="btn primary" autoFocus onClick={() => go('/map')}>See the station</button>
          )}
        </div>
      </div>
    </div>
  );
}
