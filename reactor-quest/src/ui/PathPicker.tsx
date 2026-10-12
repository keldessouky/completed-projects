// Choosing a journey: the TypeScript & React station, or an AWS certification.
// Picking AWS starts with the easiest exam (Cloud Practitioner) unless you've
// already chosen another; progress on every journey is kept when you switch.
import { useMemo } from 'react';
import { CERT_PATHS, DEFAULT_CERT, pathById, pathLevels, REACTOR } from '../content';
import { levelState, stationPower } from '../game/progress';
import { readiness, VERDICTS } from '../game/readiness';
import { choosePath } from '../game/rewards';
import { sfx } from '../game/sound';
import { setSave, useSave } from '../game/store';
import type { Path, PathId } from '../game/types';

const pick = (id: PathId) => {
  sfx.click();
  setSave((s) => choosePath(s, id));
};

function certProgress(path: Path, save: ReturnType<typeof useSave>) {
  const levels = pathLevels(path);
  return { done: levels.filter((l) => levelState(save, l.id).done).length, total: levels.length };
}

export function PathPicker() {
  const save = useSave();
  const onAws = !!pathById(save.path).exam;
  // The certification shown when AWS is chosen: the current one, or the easiest.
  const cert = onAws ? save.path : DEFAULT_CERT;
  const ready = useMemo(() => Object.fromEntries(CERT_PATHS.map((p) => [p.id, readiness(save, p)])), [save]);

  return (
    <section className="path-picker" aria-label="Choose your journey">
      <h2 className="picker-title">Choose your journey</h2>
      <div className="journeys" role="radiogroup" aria-label="Journey">
        <button role="radio" aria-checked={!onAws} className={`journey ${!onAws ? 'on' : ''}`} onClick={() => pick('reactor')}>
          <span className="j-icon">{REACTOR.icon}</span>
          <b>{REACTOR.name}</b>
          <span className="muted small">{REACTOR.tagline}</span>
          <span className="j-progress">⚡ Station power {stationPower(save)}%</span>
        </button>
        <button role="radio" aria-checked={onAws} className={`journey ${onAws ? 'on' : ''}`} onClick={() => !onAws && pick(DEFAULT_CERT)}>
          <span className="j-icon">☁</span>
          <b>AWS Certification</b>
          <span className="muted small">Learn the cloud from zero, practise with exam-style questions, and see how ready you are to pass.</span>
          <span className="j-progress">🎯 {pathById(cert).short}: {ready[cert].percent}% ready</span>
        </button>
      </div>
      {onAws && (
        <div className="certs" role="radiogroup" aria-label="Certification">
          {CERT_PATHS.map((p, i) => {
            const r = ready[p.id];
            const { done, total } = certProgress(p, save);
            return (
              <button key={p.id} role="radio" aria-checked={save.path === p.id} className={`cert ${save.path === p.id ? 'on' : ''}`} onClick={() => pick(p.id)}>
                <span className="cert-top">
                  <span className="cert-icon">{p.icon}</span>
                  <span className="cert-level">{p.exam!.level}</span>
                  {i === 0 && <span className="cert-start">Start here</span>}
                </span>
                <b>{p.short}</b>
                <span className="muted small">{p.exam!.code} · {p.tagline}</span>
                <span className="cert-stats">
                  {done}/{total} lessons · {VERDICTS[r.verdict].icon} {r.percent}% ready
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** The compact switcher in the header. */
export function PathSwitch() {
  const save = useSave();
  return (
    <label className="path-switch" title="Switch journey">
      <span className="sr-only">Journey</span>
      <select
        value={save.path}
        onChange={(e) => {
          pick(e.target.value as PathId);
          window.location.hash = '#/map';
        }}
      >
        <option value="reactor">{REACTOR.icon} {REACTOR.short}</option>
        {CERT_PATHS.map((p) => (
          <option key={p.id} value={p.id}>{p.icon} AWS {p.short}</option>
        ))}
      </select>
    </label>
  );
}
