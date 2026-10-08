import { useRef, useState } from 'react';
import { ALL_LEVELS, DECKS } from '../content';
import { item } from '../game/items';
import { CAREER, crawlerLevel, emptySave, levelState, parseSave, stationPower, type Save } from '../game/progress';
import { ACHIEVEMENTS, classInfo, dayOf, formatViewers, PETS, TIER_INFO } from '../game/rewards';
import { MAX_SKILL_LEVEL, SKILLS, SKILL_RANKS, SKILL_THRESHOLDS, skillLevel, type SkillId } from '../game/skills';
import { getSave, setSave, useSave } from '../game/store';
import { Modal } from '../ui/Modal';
import { overlays } from '../ui/overlays';
import { go } from '../ui/router';

type Tab = 'sheet' | 'achievements' | 'notebook' | 'log' | 'settings';

export function CharacterScreen({ tab: initial }: { tab?: string }) {
  const save = useSave();
  // The tab lives in the URL, so links and the back button work.
  const tab: Tab = (['sheet', 'achievements', 'notebook', 'log', 'settings'] as Tab[]).find((t) => t === initial) ?? 'sheet';
  const [confirmReset, setConfirmReset] = useState(false);
  const [restore, setRestore] = useState<Save | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const backupInput = useRef<HTMLInputElement>(null);

  // Progress lives in this browser only, so offer a file to keep or move it.
  function downloadBackup() {
    const blob = new Blob([JSON.stringify({ game: 'reactor-quest', exported: new Date().toISOString(), save: getSave() }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reactor-quest-backup-${dayOf(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function chooseBackup(file: File | undefined) {
    setRestoreError('');
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const raw = data && data.game === 'reactor-quest' ? data.save : data;
      if (!raw || (raw.v !== 1 && raw.v !== 2)) throw new Error('not a save');
      setRestore(parseSave(JSON.stringify(raw)));
    } catch {
      setRestoreError("That file isn't a Reactor Quest backup.");
    }
  }
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
        {(['sheet', 'achievements', 'notebook', 'log', 'settings'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => go(`/character/${t}`)}>
            {t === 'sheet' ? 'Skills' : t === 'achievements' ? 'Achievements' : t === 'notebook' ? `Notebook (${Object.keys(save.notes).length})` : t === 'log' ? 'Log' : 'Settings'}
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

      {tab === 'notebook' && (
        <section className="panel notebook">
          <p className="muted small">
            Your own explanations, written when you cleared each level. Rereading them is quick review; rewriting one when you understand it better is even better.
          </p>
          {Object.keys(save.notes).length === 0 ? (
            <p className="muted">Nothing here yet. When you clear a level, the victory screen asks you to explain it back in a sentence or two.</p>
          ) : (
            <ol>
              {ALL_LEVELS.filter((l) => save.notes[l.id]).map((l) => (
                <li key={l.id}>
                  <b>{l.title}</b> <span className="muted small">· {DECKS.find((d) => d.levels.includes(l))?.name}</span>{' '}
                  <button className="link small" onClick={() => go(`/level/${l.id}`)}>revisit</button>
                  <p>{save.notes[l.id].text}</p>
                </li>
              ))}
            </ol>
          )}
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
          <h4>Your progress</h4>
          <p className="muted small">
            Progress is saved in this browser, on this computer. Download a backup now and then, and use it to move your progress to another browser or computer.
          </p>
          <div className="modal-actions left">
            <button className="btn" onClick={downloadBackup}>Download a backup</button>
            <button className="btn" onClick={() => backupInput.current?.click()}>Restore from a backup…</button>
            <input ref={backupInput} type="file" accept=".json,application/json" hidden aria-label="Backup file" onChange={(e) => { void chooseBackup(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          {restoreError && <p className="err small" role="alert">{restoreError}</p>}
          <hr />
          <button className="btn ghost danger" onClick={() => setConfirmReset(true)}>Reset all progress…</button>
        </section>
      )}

      {restore && (
        <Modal title="Restore this backup?" onClose={() => setRestore(null)}>
          <p>
            The backup has {ALL_LEVELS.filter((l) => restore.levels[l.id]?.done).length} systems online and crawler level {crawlerLevel(restore.xp).level}
            {restore.name ? `, for ${restore.name}` : ''}. Your current progress will be replaced by it.
          </p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setRestore(null)}>Cancel</button>
            <button className="btn primary" onClick={() => { setSave(() => restore); setRestore(null); }}>Restore it</button>
          </div>
        </Modal>
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
