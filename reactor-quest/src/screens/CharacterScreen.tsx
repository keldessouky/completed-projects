import { useState } from 'react';
import { ALL_LEVELS, DECKS } from '../content';
import { item } from '../game/items';
import { CAREER, crawlerLevel, emptySave, levelState, stationPower } from '../game/progress';
import { ACHIEVEMENTS, classInfo, formatViewers, PETS, TIER_INFO } from '../game/rewards';
import { MAX_SKILL_LEVEL, SKILLS, SKILL_RANKS, SKILL_THRESHOLDS, skillLevel, type SkillId } from '../game/skills';
import { setSave, useSave } from '../game/store';
import { Modal } from '../ui/Modal';
import { overlays } from '../ui/overlays';
import { go } from '../ui/router';

type Tab = 'sheet' | 'achievements' | 'log' | 'settings';

export function CharacterScreen({ tab: initial }: { tab?: string }) {
  const save = useSave();
  // The tab lives in the URL, so links and the back button work.
  const tab: Tab = (['sheet', 'achievements', 'log', 'settings'] as Tab[]).find((t) => t === initial) ?? 'sheet';
  const [confirmReset, setConfirmReset] = useState(false);
  const lvl = crawlerLevel(save.xp);
  const cls = classInfo(save.classId);
  const pet = save.pet ? PETS.find((p) => p.kind === save.pet!.kind) : null;
  const done = ALL_LEVELS.filter((l) => levelState(save, l.id).done).length;
  const stars = ALL_LEVELS.reduce((n, l) => n + levelState(save, l.id).stars, 0);
  const classEligible = !save.classId && levelState(save, DECKS[2].levels.at(-1)!.id).done;
  const petEligible = !save.pet && levelState(save, DECKS[0].levels.at(-1)!.id).done;

  return (
    <div className="character">
      <section className="panel char-head">
        <div className="portrait" aria-hidden>{cls?.icon ?? '🧑‍🚀'}</div>
        <div className="char-id">
          <p className="kicker">{item(save.equipped.title).name}</p>
          <h2>{save.name || 'Engineer'} <button className="link small" onClick={() => overlays.offer('name')}>rename</button></h2>
          <p><b>Crawler level {lvl.level}</b> · {lvl.title}{cls ? ` · ${cls.name}` : ''}</p>
          <div className="bar big"><div style={{ width: `${Math.round(lvl.progress * 100)}%` }} /></div>
          <p className="muted small">{save.xp} XP · {lvl.toNext} to level {lvl.level + 1}</p>
          {classEligible && <button className="btn primary" onClick={() => overlays.offer('class')}>Choose your class</button>}
          {petEligible && <button className="btn primary" onClick={() => overlays.offer('pet')}>Adopt your companion</button>}
        </div>
        <div className="stat-grid">
          <div><b>{stationPower(save)}%</b><span>station power</span></div>
          <div><b>{done}/{ALL_LEVELS.length}</b><span>systems online</span></div>
          <div><b>{stars}</b><span>stars of {ALL_LEVELS.length * 3}</span></div>
          <div><b>{formatViewers(save.viewers)}</b><span>viewers</span></div>
          <div><b>{ACHIEVEMENTS.filter((a) => save.achievements.includes(a.id)).length}/{ACHIEVEMENTS.length}</b><span>achievements</span></div>
          <div><b>{save.streak.best}</b><span>best streak</span></div>
        </div>
      </section>

      <div className="tabs pill-tabs" role="tablist">
        {(['sheet', 'achievements', 'log', 'settings'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => go(`/character/${t}`)}>
            {t === 'sheet' ? 'Skills' : t === 'achievements' ? 'Achievements' : t === 'log' ? 'Log' : 'Settings'}
          </button>
        ))}
      </div>

      {tab === 'sheet' && (
        <>
          <section className="panel skills">
            <h3>Skills</h3>
            <p className="muted small">Every level trains skills. Clearing it gives a point; earning three stars gives another. Five levels per skill: Novice, Apprentice, Adept, Expert, Master.</p>
            {(['JavaScript', 'TypeScript', 'React'] as const).map((school) => (
              <div key={school} className="school">
                <h4>{school}</h4>
                <ul>
                  {(Object.keys(SKILLS) as SkillId[]).filter((k) => SKILLS[k].school === school).map((k) => {
                    const points = save.skills[k] ?? 0;
                    const level = skillLevel(points);
                    const next = SKILL_THRESHOLDS[level];
                    return (
                      <li key={k} className={`skill lv${level}`}>
                        <span className="skill-icon">{SKILLS[k].icon}</span>
                        <span className="skill-name">{SKILLS[k].name}</span>
                        <span className="pips" aria-label={`level ${level} of ${MAX_SKILL_LEVEL}`}>
                          {Array.from({ length: MAX_SKILL_LEVEL }, (_, i) => <span key={i} className={i < level ? 'on' : ''} />)}
                        </span>
                        <span className="skill-rank">{SKILL_RANKS[level]}</span>
                        <span className="muted small">{next ? `${points}/${next}` : 'max'}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
          <section className="panel career">
            <h3>Career</h3>
            <ol className="career-path">
              {CAREER.map((c) => (
                <li key={c.title} className={lvl.level >= c.level ? 'reached' : ''}>
                  <b>{c.title}</b> <span className="muted small">level {c.level}</span>
                </li>
              ))}
            </ol>
            <div className="companions">
              <p>{cls ? <>Class: <b>{cls.icon} {cls.name}</b>: {cls.perk}</> : <span className="muted">Class: chosen after Floor 3.</span>}</p>
              <p>{pet ? <>Companion: <b>{pet.icon} {save.pet!.name}</b>, your {pet.name.toLowerCase()}</> : <span className="muted">Companion: one finds you after Floor 1.</span>}</p>
            </div>
          </section>
        </>
      )}

      {tab === 'achievements' && (
        <section className="panel">
          <ul className="achievements">
            {ACHIEVEMENTS.map((a) => {
              const got = save.achievements.includes(a.id);
              return (
                <li key={a.id} className={got ? 'got' : ''} style={{ ['--tone' as string]: TIER_INFO[a.tier].color }}>
                  <span className="icon" aria-hidden>{got ? a.icon : '◌'}</span>
                  <div>
                    <b>{a.name}</b>
                    <span>{a.description}</span>
                    {got && <span className="quip">“{a.quip}”</span>}
                    <span className="reward-tag">{TIER_INFO[a.tier].name} box{a.title ? ` + title “${item(a.title).name}”` : ''}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tab === 'log' && (
        <section className="panel">
          {save.inbox.length === 0 ? (
            <p className="muted">Nothing yet. Achievements, level-ups, sponsors and more will be logged here.</p>
          ) : (
            <ul className="inbox">
              {[...save.inbox].reverse().map((n) => (
                <li key={n.id}>
                  <span className="icon">{n.icon}</span>
                  <div>
                    <b>{n.title}</b>
                    <span className="muted small">{n.body}</span>
                  </div>
                  <span className="muted small">{new Date(n.at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'settings' && (
        <section className="panel settings">
          <label className="toggle">
            <input type="checkbox" checked={save.sound} onChange={(e) => setSave((s) => ({ ...s, sound: e.target.checked }))} />
            Sound effects
          </label>
          <label className="toggle">
            <input type="checkbox" checked={save.unlockAll} onChange={(e) => setSave((s) => ({ ...s, unlockAll: e.target.checked }))} />
            Open every system (skip ahead, for when you already know the basics)
          </label>
          <p className="muted small">Tip: you can also skip a floor by beating its boss. Each floor's boss is open from the moment you reach the floor.</p>
          <button className="btn ghost danger" onClick={() => setConfirmReset(true)}>Reset all progress…</button>
        </section>
      )}

      {confirmReset && (
        <Modal title="Reset all progress?" onClose={() => setConfirmReset(false)}>
          <p>Levels, stars, XP, gold, loot, skills, achievements, your companion and your saved code will all be erased. This can't be undone.</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            <button className="btn danger" onClick={() => { setSave(() => emptySave()); setConfirmReset(false); }}>Erase everything</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
