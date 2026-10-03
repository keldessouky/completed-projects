import { useState } from 'react';
import { ALL_LEVELS, DECKS } from '../content';
import { ACHIEVEMENTS, emptySave, levelState, rankOf, RANKS, stationPower } from '../game/progress';
import { setSave, useSave } from '../game/store';
import { Modal } from '../ui/Modal';

export function ProfileScreen() {
  const save = useSave();
  const rank = rankOf(save.xp);
  const [confirmReset, setConfirmReset] = useState(false);
  const done = ALL_LEVELS.filter((l) => levelState(save, l.id).done).length;
  const stars = ALL_LEVELS.reduce((n, l) => n + levelState(save, l.id).stars, 0);

  return (
    <div className="profile">
      <section className="panel rank-card">
        <p className="kicker">Rank {rank.index + 1} of {RANKS.length}</p>
        <h2>{rank.name}</h2>
        <div className="bar big"><div style={{ width: `${Math.round(rank.progress * 100)}%` }} /></div>
        <p className="muted">{save.xp} XP{rank.next ? ` · ${rank.toNext} to ${rank.next}` : ' · maximum rank'}</p>
        <div className="stat-grid">
          <div><b>{stationPower(save)}%</b><span>station power</span></div>
          <div><b>{done}/{ALL_LEVELS.length}</b><span>systems online</span></div>
          <div><b>{stars}/{ALL_LEVELS.length * 3}</b><span>stars</span></div>
          <div><b>{save.arcadeBest}</b><span>arcade best</span></div>
        </div>
      </section>

      <section className="panel">
        <h3>Achievements</h3>
        <ul className="achievements">
          {ACHIEVEMENTS.map((a) => {
            const got = a.earned(save);
            return (
              <li key={a.id} className={got ? 'got' : ''}>
                <span className="icon" aria-hidden>{got ? a.icon : '◌'}</span>
                <div>
                  <b>{a.name}</b>
                  <span>{a.description}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel">
        <h3>Curriculum</h3>
        <ol className="curriculum">
          {DECKS.map((d) => (
            <li key={d.id}>
              <b>{d.name}</b> <span className="muted">— {d.subtitle}</span>
              <div className="muted small">{d.levels.map((l) => l.title.replace(/^(FINAL )?BOSS: /, '')).join(' · ')}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel settings">
        <h3>Settings</h3>
        <label className="toggle">
          <input type="checkbox" checked={save.sound} onChange={(e) => setSave((s) => ({ ...s, sound: e.target.checked }))} />
          Sound effects
        </label>
        <label className="toggle">
          <input type="checkbox" checked={save.unlockAll} onChange={(e) => setSave((s) => ({ ...s, unlockAll: e.target.checked }))} />
          Open every system (skip ahead — for when you already know the basics)
        </label>
        <button className="btn ghost danger" onClick={() => setConfirmReset(true)}>Reset all progress…</button>
      </section>

      {confirmReset && (
        <Modal title="Reset all progress?" onClose={() => setConfirmReset(false)}>
          <p>Stars, XP, achievements and your saved code for every level will be erased. This can't be undone.</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            <button className="btn danger" onClick={() => { setSave(() => emptySave()); setConfirmReset(false); }}>Erase everything</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
