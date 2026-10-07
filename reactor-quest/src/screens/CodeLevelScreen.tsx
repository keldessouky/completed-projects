import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Diagnostic } from '../engine/checker';
import { compile, isReady, onReady } from '../engine/compiler';
import { explainDiagnostic } from '../engine/explain';
import { grade, type Report } from '../engine/grade';
import { codeStars, isBoss, levelState } from '../game/progress';
import { codeOutcome, completeLevel, PET_LINES, recordRun, replayLevel, revealHint as revealHintAction, revealSolution as revealSolutionAction, type Reward } from '../game/rewards';
import { sfx } from '../game/sound';
import { act, getSave, setSave, useSave } from '../game/store';
import type { CodeLevel, Deck } from '../game/types';
import { CodeEditor } from '../ui/CodeEditor';
import { Code } from '../ui/highlight';
import { Markdown, inline } from '../ui/Markdown';
import { Modal } from '../ui/Modal';
import { overlays } from '../ui/overlays';
import { Preview } from '../ui/Preview';
import { Victory } from '../ui/Victory';
import { useLevelTimer } from '../ui/useLevelTimer';

type Tab = 'mission' | 'lesson' | 'hints';

const RUN_SHORTCUT = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ ↵' : 'Ctrl ↵';

export function CodeLevelScreen({ level, deck, index }: { level: CodeLevel; deck: Deck; index: number }) {
  const save = useSave();
  const progress = levelState(save, level.id);
  const [code, setCode] = useState(() => progress.code ?? level.starter);
  const [tab, setTabState] = useState<Tab>('mission');
  const [lessonSeen, setLessonSeen] = useState(false);
  const [failedRuns, setFailedRuns] = useState(0);
  const setTab = (t: Tab) => {
    if (t === 'lesson') setLessonSeen(true);
    setTabState(t);
  };
  const [report, setReport] = useState<Report | null>(null);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<{ code: string; diagnostics: Diagnostic[] }>({ code: '', diagnostics: [] });
  const [logs, setLogs] = useState<string[]>([]);
  const [runId, setRunId] = useState(0);
  const [modal, setModal] = useState<'reset' | 'solution' | null>(null);
  const [victory, setVictory] = useState<{ stars: number; events: Reward[] } | null>(null);
  // Time is tracked quietly for the speed bonus, but never shown ticking:
  // a visible clock adds pressure and pulls attention away from the problem.
  const seconds = useLevelTimer(level.id, !victory);
  const [compilerReady, setCompilerReady] = useState(isReady());
  const mainPath = `/${level.file}`;

  useEffect(() => onReady(() => setCompilerReady(true)), []);

  // Live type checking as you type, debounced.
  useEffect(() => {
    const t = setTimeout(() => {
      compile({ [mainPath]: code }).then((r) => setLive({ code, diagnostics: r.diagnostics.filter((d) => d.file === mainPath) }), () => {});
    }, 350);
    return () => clearTimeout(t);
  }, [code, mainPath]);

  // Autosave the player's code.
  useEffect(() => {
    const t = setTimeout(() => {
      setSave((s) => ({ ...s, levels: { ...s.levels, [level.id]: { ...levelState(s, level.id), code } } }));
    }, 500);
    return () => clearTimeout(t);
  }, [code, level.id]);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    sfx.run();
    try {
      const r = await grade(level, code, compile);
      setReport(r);
      setLogs(r.logs);
      setRunId((n) => n + 1);
      act((st) => recordRun({ ...st, levels: { ...st.levels, [level.id]: { ...levelState(st, level.id), code } } }, level.id, r.passed));
      if (r.passed) {
        const outcome = codeOutcome(getSave(), level, seconds);
        const events = act((st) => completeLevel(st, level, outcome, Math.random));
        sfx.pass();
        overlays.petSay(PET_LINES.pass[Math.floor(Math.random() * PET_LINES.pass.length)]);
        setVictory({ stars: outcome.stars, events });
      } else {
        sfx.fail();
        setFailedRuns((n) => n + 1);
        if (Math.random() < 0.4) overlays.petSay(PET_LINES.fail[Math.floor(Math.random() * PET_LINES.fail.length)]);
      }
    } catch (e) {
      setLogs([`✖ ${(e as Error).message}`]);
      sfx.fail();
    } finally {
      setRunning(false);
    }
  }, [code, level, running, seconds]);

  // The Run shortcut works anywhere on the level screen, not only in the editor
  // (the editor handles it itself and marks the event as handled).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.defaultPrevented || modal || victory) return;
      e.preventDefault();
      void run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, modal, victory]);

  function revealHint(useToken: boolean) {
    sfx.click();
    act((s) => revealHintAction(s, level.id, level.hints.length, useToken));
  }

  function revealSolution() {
    act((s) => revealSolutionAction(s, level.id));
  }

  function loadSolution() {
    setCode(level.solution);
    setModal(null);
  }

  function replay() {
    setSave((s) => replayLevel(s, level.id, level.starter));
    setCode(level.starter);
    setReport(null);
    setVictory(null);
  }

  const diagnostics = live.code === code ? live.diagnostics : [];
  const potential = codeStars(progress);
  const allChecks = report ? [...report.typeChecks.map((c) => ({ ...c, type: true })), ...report.checks.map((c) => ({ ...c, type: false }))] : [];
  const passCount = allChecks.filter((c) => c.pass).length;

  // The lesson's sections, as a list of what this level teaches.
  const goals = useMemo(() => [...level.lesson.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1].trim()), [level]);
  const hintsLeft = level.hints.length - progress.hints;
  const note = save.notes[level.id];

  const objectives = useMemo(
    () => [...(level.typeChecks ?? []).map((c) => ({ label: c.label, type: true })), ...level.checks.map((c) => ({ label: c.label, type: false }))],
    [level],
  );

  return (
    <div className="level">
      <aside className="panel brief">
        <div className="level-head">
          <span className="deck-tag" style={{ ['--hue' as string]: deck.hue }}>{deck.name} · {index + 1}</span>
          <h2>{level.title}</h2>
          <p className="system">System: {level.system}</p>
          <p className="stars-line" title="Stars you can still earn on this attempt">
            {progress.done && <span className="best">Best {'★'.repeat(progress.stars)}{'☆'.repeat(3 - progress.stars)} · </span>}
            Worth {'★'.repeat(potential)}{'☆'.repeat(3 - potential)}
          </p>
        </div>
        <div className="tabs" role="tablist">
          {(['mission', 'lesson', 'hints'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'mission' ? 'Mission' : t === 'lesson' ? 'Lesson' : `Hints ${progress.hints}/${level.hints.length}`}
            </button>
          ))}
        </div>
        <div className="tab-body">
          {tab === 'mission' && (
            <>
              <Markdown text={level.brief} />
              {goals.length > 0 && (
                <div className="learn-goals">
                  <h4>You'll learn</h4>
                  <ul>
                    {goals.map((g) => <li key={g}>{inline(g)}</li>)}
                  </ul>
                  <button className="link" onClick={() => setTab('lesson')}>Read the lesson first →</button>
                </div>
              )}
              <h4>Objectives</h4>
              <ul className="objectives">
                {objectives.map((o) => {
                  const r = allChecks.find((c) => c.label === o.label);
                  return (
                    <li key={o.label} className={r ? (r.pass ? 'pass' : 'fail') : ''}>
                      <span className="mark">{r ? (r.pass ? '✓' : '✗') : '○'}</span>
                      {o.type && <span className="type-tag">type</span>}
                      {inline(o.label)}
                    </li>
                  );
                })}
                <li className={report ? (report.typeErrors.length ? 'fail' : 'pass') : ''}>
                  <span className="mark">{report ? (report.typeErrors.length ? '✗' : '✓') : '○'}</span>
                  <span className="type-tag">type</span>
                  No type errors
                </li>
              </ul>
              <p className="muted small">Stuck? The <button className="link" onClick={() => setTab('lesson')}>Lesson</button> tab teaches the idea; <button className="link" onClick={() => setTab('hints')}>Hints</button> nudge you toward the answer.</p>
              {note && (
                <div className="your-note">
                  <b>Your note from last time</b>
                  <p>{note.text}</p>
                </div>
              )}
            </>
          )}
          {tab === 'lesson' && <Markdown text={level.lesson} />}
          {tab === 'hints' && (
            <div className="hints">
              {level.hints.slice(0, progress.hints).map((h, i) => (
                <div className="hint" key={i}>
                  <span className="hint-n">Hint {i + 1}</span>
                  <Markdown text={h} />
                </div>
              ))}
              {progress.hints < level.hints.length ? (
                <div className="hint-buttons">
                  {save.hintTokens > 0 && (
                    <button className="btn" onClick={() => revealHint(true)}>
                      🎟 Use a hint token <span className="muted small">(free · {save.hintTokens} left)</span>
                    </button>
                  )}
                  <button className={`btn ${save.hintTokens > 0 ? 'ghost' : ''}`} onClick={() => revealHint(false)}>
                    Reveal hint {progress.hints + 1}
                    {potential > 1 && !progress.solution && <span className="cost"> (−1 ★)</span>}
                  </button>
                </div>
              ) : (
                <p className="muted">That's every hint.</p>
              )}
              <hr />
              <button className="btn ghost danger" onClick={() => setModal('solution')}>Show the solution…</button>
              {hintsLeft > 0 && !progress.done && !progress.solution && <p className="muted small">The solution opens once you've seen all three hints.</p>}
            </div>
          )}
        </div>
      </aside>

      <section className="panel work">
        <div className="toolbar">
          <span className="file">{level.file}</span>
          <span className="spacer" />
          {!compilerReady && <span className="muted small">Loading compiler…</span>}
          <button className="btn ghost" onClick={() => setModal('reset')}>Reset</button>
          <button className="btn primary" onClick={run} disabled={running}>
            {running ? 'Running…' : 'Run'} <kbd>{RUN_SHORTCUT}</kbd>
          </button>
        </div>
        <CodeEditor value={code} path={mainPath} tsx={level.file.endsWith('tsx')} diagnostics={diagnostics} onChange={setCode} onRun={run} />
        <div className="status-line">
          {live.code === code && (live.diagnostics.length ? <span className="err">✗ {live.diagnostics.length} type error{live.diagnostics.length > 1 ? 's' : ''} — hover the red squiggles</span> : <span className="ok">✓ No type errors</span>)}
        </div>
      </section>

      <section className="panel results">
        {isBoss(level) && <BossBar name={level.system} report={report} />}
        {level.preview && (
          <div className="preview">
            <h4>Preview</h4>
            {report && !report.loadError ? (
              <Preview level={level} js={report.js} runId={runId} log={(l) => setLogs((ls) => [...ls.slice(-49), l])} />
            ) : (
              <p className="muted small">{report?.loadError ? 'Your code crashed — see below.' : 'Run your code to see it here.'}</p>
            )}
          </div>
        )}
        <div className="report">
          {failedRuns >= 2 && !lessonSeen && !report?.passed && (
            <div className="nudge">
              💡 <b>Stuck?</b> The lesson explains exactly the idea this level needs, with an example.{' '}
              <button className="link" onClick={() => setTab('lesson')}>Open the lesson</button>
            </div>
          )}
          <h4>
            Checks {report && <span className={report.passed ? 'ok' : 'err'}>{passCount}/{allChecks.length}</span>}
          </h4>
          {!report && <p className="muted small">Press <b>Run</b> to compile your code and test it.</p>}
          {report?.loadError && <div className="crash">💥 {report.loadError}</div>}
          {report && report.typeErrors.length > 0 && (
            <div className="type-errors">
              {report.typeErrors.map((d, i) => (
                <div key={i} className="diag">
                  <span className="loc">line {d.line}</span> {d.message}
                  {explainDiagnostic(d.code, d.message) && <span className="plain">💡 {inline(explainDiagnostic(d.code, d.message)!)}</span>}
                </div>
              ))}
            </div>
          )}
          {report && (
            <ul className="checks">
              {allChecks.map((c) => (
                <li key={c.label} className={c.pass ? 'pass' : 'fail'}>
                  <span className="mark">{c.pass ? '✓' : '✗'}</span>
                  <div>
                    {c.type && <span className="type-tag">type</span>}
                    {inline(c.label)}
                    {c.message && <div className="why">{c.message}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {logs.length > 0 && (
            <div className="console">
              <h4>Console</h4>
              {logs.map((l, i) => <div key={i} className={`log ${l.startsWith('✖') ? 'err' : l.startsWith('⚠') ? 'warn' : ''}`}>{l}</div>)}
            </div>
          )}
        </div>
      </section>

      {modal === 'reset' && (
        <Modal title="Reset the code?" onClose={() => setModal(null)}>
          <p>Your changes to {level.file} will be replaced with the starter code.</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn danger" onClick={() => { setCode(level.starter); setReport(null); setModal(null); }}>Reset</button>
          </div>
        </Modal>
      )}
      {modal === 'solution' && (
        <Modal title="Reference solution" onClose={() => setModal(null)} wide>
          {progress.solution || progress.done ? (
            <>
              <Code code={level.solution} />
              {!progress.done && <p className="muted">Close it, then write it yourself. Rebuilding it from memory is what makes it stick; pasting it doesn't.</p>}
              <div className="modal-actions">
                <button className="btn ghost" onClick={() => setModal(null)}>Close</button>
                {progress.done && <button className="btn" onClick={loadSolution}>Load it into the editor</button>}
              </div>
            </>
          ) : hintsLeft > 0 ? (
            <>
              <p>
                Try the hints first: {hintsLeft === level.hints.length ? 'there are three' : `${hintsLeft} left`}. Each one gets you closer without giving the answer away,
                and working it out (even slowly) is what makes it stick.
              </p>
              <p className="muted">The solution opens once you've seen every hint.</p>
              <div className="modal-actions">
                <button className="btn primary" onClick={() => { setModal(null); setTab('hints'); }}>Back to the hints</button>
              </div>
            </>
          ) : (
            <>
              <p>Seeing the solution caps this attempt at <b>★☆☆</b>. You can always replay the level later for three stars.</p>
              <p className="muted">Reading it, closing it, and writing it yourself from memory is a perfectly good way to learn.</p>
              <div className="modal-actions">
                <button className="btn ghost" onClick={() => setModal(null)}>Keep trying</button>
                <button className="btn danger" onClick={revealSolution}>Reveal the solution</button>
              </div>
            </>
          )}
        </Modal>
      )}
      {victory && <Victory level={level} stars={victory.stars} events={victory.events} onReplay={replay} onClose={() => setVictory(null)} />}
    </div>
  );
}

/** A boss's health: every failing check is armour it still has. Each Run that passes more checks does damage. */
function BossBar({ name, report }: { name: string; report: Report | null }) {
  const total = report ? report.checks.length + report.typeChecks.length + 1 : 1;
  const failing = report ? report.checks.filter((c) => !c.pass).length + report.typeChecks.filter((c) => !c.pass).length + (report.typeErrors.length ? 1 : 0) : total;
  const hp = report ? Math.round((failing / total) * 100) : 100;
  return (
    <div className={`boss-bar ${hp === 0 ? 'defeated' : ''}`} role="meter" aria-label={`Boss health ${hp}%`} aria-valuenow={hp} aria-valuemin={0} aria-valuemax={100}>
      <div className="boss-name">
        <span>☢ BOSS: {name}</span>
        <span>{hp === 0 ? 'DEFEATED' : `${hp}% HP`}</span>
      </div>
      <div className="boss-hp"><div style={{ width: `${hp}%` }} /></div>
      {report && hp > 0 && <span className="muted small">Each check you pass is a hit. {failing} to go.</span>}
    </div>
  );
}
