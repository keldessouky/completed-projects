import { useEffect } from 'react';
import { ALL_LEVELS } from '../content';
import { crawlerLevel, isBoss } from '../game/progress';
import { formatViewers, type Reward } from '../game/rewards';
import { SKILLS, SKILL_RANKS } from '../game/skills';
import { useSave } from '../game/store';
import type { Level } from '../game/types';
import { overlays } from './overlays';
import { go } from './router';

const LINES = [
  'System restored. The station hums a little louder.',
  'Compiler satisfied. That is not a small thing.',
  'Green across the board. The crew noticed.',
  'Another light comes on down the corridor.',
  'Clean build. ARIA approves.',
];

export function Victory({ level, stars, events, onReplay, onClose }: { level: Level; stars: number; events: Reward[]; onReplay(): void; onClose(): void }) {
  const save = useSave();
  const lvl = crawlerLevel(save.xp);
  const idx = ALL_LEVELS.findIndex((l) => l.id === level.id);
  const next = ALL_LEVELS[idx + 1];
  const final = !next;
  const boss = isBoss(level);

  const xp = events.filter((e) => e.kind === 'xp').reduce((n, e) => n + (e.kind === 'xp' ? e.amount : 0), 0);
  const xpDetail = events.find((e) => e.kind === 'xp' && e.detail !== 'level clear');
  const gold = events.reduce((n, e) => n + (e.kind === 'gold' ? e.amount : 0), 0);
  const viewers = events.find((e) => e.kind === 'viewers');
  const skillUps = events.filter((e) => e.kind === 'skill-up');
  const boxes = events.flatMap((e) => (e.kind === 'box' ? [e.box] : []));
  const feed = events.find((e) => e.kind === 'feed');
  const levelUps = events.filter((e) => e.kind === 'level-up');

  const leave = (path?: string) => {
    onClose();
    overlays.flushOffers();
    if (path) go(path);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLButtonElement)) leave(next ? `/level/${next.id}` : '/map');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const line = final ? 'The last system is online. Orrery Station is alive again — because of you, engineer.' : boss ? 'Floor boss defeated! The next section of the station powers up.' : LINES[idx % LINES.length];
  return (
    <div className="modal-backdrop victory-backdrop">
      <div className={`modal victory ${final ? 'final' : ''} ${boss ? 'boss-win' : ''}`} role="dialog" aria-modal="true" aria-label="Level complete">
        <div className="burst" aria-hidden />
        <p className="victory-kicker">{boss ? `☢ BOSS DEFEATED · ${level.system}` : `${level.system} — online`}</p>
        <div className="big-stars" aria-label={`${stars} of 3 stars`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < stars ? 'on' : ''} style={{ animationDelay: `${0.15 + i * 0.18}s` }}>★</span>
          ))}
        </div>
        <p className="aria-line"><b>ARIA:</b> {line}</p>
        {feed?.kind === 'feed' && <p className="feed-line"><b>THE FEED:</b> <i>{feed.text}</i></p>}

        <div className="reward-row">
          <div className="reward"><b>{xp > 0 ? `+${xp}` : '—'}</b><span>XP{xpDetail?.kind === 'xp' ? ` (${xpDetail.detail})` : ''}</span></div>
          <div className="reward"><b>{gold > 0 ? `+${gold}` : '—'}</b><span>gold</span></div>
          <div className="reward"><b>{viewers?.kind === 'viewers' ? `+${formatViewers(viewers.amount)}` : '—'}</b><span>viewers</span></div>
          <div className="reward"><b>{boxes.length || '—'}</b><span>box{boxes.length === 1 ? '' : 'es'}</span></div>
        </div>
        {xp === 0 && <p className="muted small">No new rewards: beat your best stars to earn more.</p>}

        {(skillUps.length > 0 || levelUps.length > 0) && (
          <ul className="ups">
            {levelUps.map((e) => e.kind === 'level-up' && (
              <li key={`l${e.level}`}>⬆ Crawler level <b>{e.level}</b>{e.newTitle && <> — promoted to <b>{e.title}</b></>}</li>
            ))}
            {skillUps.map((e) => e.kind === 'skill-up' && (
              <li key={e.skill}>{SKILLS[e.skill].icon} <b>{SKILLS[e.skill].name}</b> is now level {e.level} <span className="muted">({SKILL_RANKS[e.level]})</span></li>
            ))}
          </ul>
        )}

        <div className="rank-row">
          <span>Lv {lvl.level} · {lvl.title}</span>
          <div className="bar"><div style={{ width: `${Math.round(lvl.progress * 100)}%` }} /></div>
          <span className="muted small">{lvl.toNext} XP to level {lvl.level + 1}</span>
        </div>

        <div className="modal-actions">
          {stars < 3 && <button className="btn ghost" onClick={onReplay}>Replay for ★★★</button>}
          {boxes.length > 0 && (
            <button className="btn" onClick={() => overlays.openBoxes(boxes.map((b) => b.id))}>
              🎁 Open {boxes.length === 1 ? 'box' : `${boxes.length} boxes`}
            </button>
          )}
          <button className="btn ghost" onClick={() => leave()}>Stay here</button>
          {next ? (
            <button className="btn primary" autoFocus onClick={() => leave(`/level/${next.id}`)}>Next system →</button>
          ) : (
            <button className="btn primary" autoFocus onClick={() => leave('/map')}>See the station</button>
          )}
        </div>
      </div>
    </div>
  );
}
