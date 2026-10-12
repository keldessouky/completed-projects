// Exam prep for the certification paths: how ready you are, domain by domain,
// and three ways to practise. Drills and quick quizzes explain each answer as
// you go; the full mock exam is timed and silent until the end, like the real one.
import { useEffect, useMemo, useState } from 'react';
import { pathById } from '../content';
import { answers, isRight, pickQuestions, readiness, VERDICTS, type Readiness } from '../game/readiness';
import { dayOf, finishPractice, type Reward } from '../game/rewards';
import { sfx } from '../game/sound';
import { act, getSave, useSave } from '../game/store';
import type { ExamQuestion, Path } from '../game/types';
import type { MockResult } from '../game/progress';
import { Code } from '../ui/highlight';
import { inline } from '../ui/Markdown';
import { go } from '../ui/router';

/** Questions in a quick mixed quiz, and in a one-domain drill. */
export const QUICK_SIZE = 15;
export const DRILL_SIZE = 10;

interface Session {
  mode: MockResult['mode'];
  questions: ExamQuestion[];
  /** Each question's options in the order shown. */
  orders: number[][];
  domain?: string;
  /** For the timed mock: when it ends, in ms since the epoch. */
  endsAt?: number;
  before: Readiness;
}

function shuffled(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function ExamScreen() {
  const save = useSave();
  const path = pathById(save.path);
  const [session, setSession] = useState<Session | null>(null);
  const [result, setResult] = useState<{ session: Session; picks: number[][]; events: Reward[] } | null>(null);

  if (!path.exam) {
    return (
      <div className="panel center-msg">
        <h2>Exam prep is for the AWS certification paths</h2>
        <p>Pick an AWS certification as your journey to see how ready you are for its exam.</p>
        <button className="btn primary" onClick={() => go('/')}>Choose a journey</button>
      </div>
    );
  }

  function start(mode: MockResult['mode'], domain?: string) {
    const s = getSave();
    const count = mode === 'full' ? path.exam!.questions : mode === 'quick' ? QUICK_SIZE : DRILL_SIZE;
    const questions = pickQuestions(s, path, { count, domain, mode }, Math.random);
    sfx.unlock();
    setResult(null);
    setSession({
      mode,
      domain,
      questions,
      orders: questions.map((q) => shuffled(q.options.length)),
      endsAt: mode === 'full' ? Date.now() + path.exam!.minutes * 60_000 : undefined,
      before: readiness(s, path),
    });
    window.scrollTo?.(0, 0);
  }

  function finish(picks: number[][]) {
    if (!session) return;
    const results = session.questions.map((q, i) => ({ q, correct: isRight(q, picks[i] ?? []) }));
    const events = act((s) => finishPractice(s, results, session.mode, dayOf(new Date())));
    sfx.pass();
    setResult({ session, picks, events });
    setSession(null);
    window.scrollTo?.(0, 0);
  }

  if (session) return <PracticeSession key={session.questions.map((q) => q.id).join()} path={path} session={session} onFinish={finish} onQuit={() => setSession(null)} />;
  if (result) return <Results path={path} {...result} onAgain={() => start(result.session.mode, result.session.domain)} onHome={() => setResult(null)} />;
  return <Prep path={path} onStart={start} />;
}

// ---------------------------------------------------------------- the prep page

function Gauge({ r }: { r: Readiness }) {
  const v = VERDICTS[r.verdict];
  return (
    <div className={`gauge verdict-${r.verdict}`} role="img" aria-label={`Readiness ${r.percent}%: ${v.label}`}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle className="track" cx="60" cy="60" r="52" />
        <circle className={`fill ${r.percent ? '' : 'empty'}`} cx="60" cy="60" r="52" style={{ strokeDasharray: `${(r.percent / 100) * 326.7} 326.7` }} />
      </svg>
      <div className="gauge-text">
        <b className="readiness-percent">{r.percent}%</b>
        <span>ready</span>
      </div>
    </div>
  );
}

/** Estimated score against the passing score, on AWS's 100–1000 scale. */
function ScoreBar({ r }: { r: Readiness }) {
  const at = (n: number) => `${((n - 100) / 900) * 100}%`;
  return (
    <div className="score-bar" aria-label={`Estimated score ${r.estimate} of 1000; passing is ${r.exam.pass}`}>
      <span className={`score-fill ${r.estimate >= r.exam.pass ? 'pass' : ''}`} style={{ width: at(r.estimate) }} />
      <span className="score-mark" style={{ left: at(r.exam.pass) }} title={`Passing score: ${r.exam.pass}`} />
      <span className="score-mark target" style={{ left: at(r.target) }} title={`Ready target: ${r.target}`} />
    </div>
  );
}

export function ReadinessSummary({ path, compact }: { path: Path; compact?: boolean }) {
  const save = useSave();
  const r = useMemo(() => readiness(save, path), [save, path]);
  const v = VERDICTS[r.verdict];
  return (
    <div className={`readiness-summary ${compact ? 'compact' : ''}`}>
      <Gauge r={r} />
      <div>
        <p className="kicker">{r.exam.code} readiness</p>
        <h3 className="verdict">{v.icon} {v.label}</h3>
        <p className="muted small">
          Estimated score <b className="estimate">{r.answered ? r.estimate : '—'}</b> of 1000 · passing is {r.exam.pass} · ready at {r.target}
        </p>
        {r.answered > 0 && <ScoreBar r={r} />}
        <p className="advice">{r.advice}</p>
      </div>
    </div>
  );
}

function Prep({ path, onStart }: { path: Path; onStart(mode: MockResult['mode'], domain?: string): void }) {
  const save = useSave();
  const exam = path.exam!;
  const r = useMemo(() => readiness(save, path), [save, path]);
  const history = save.exam.mocks.filter((m) => m.cert === path.id).slice(-6).reverse();
  return (
    <div className="exam-prep">
      <section className="panel exam-head">
        <div>
          <p className="kicker">{exam.level} · {exam.code}</p>
          <h2>{exam.name}</h2>
          <p className="muted">
            {exam.questions} questions · {exam.minutes} minutes · pass mark {exam.pass} of 1000 ·{' '}
            <a href={exam.guide} target="_blank" rel="noreferrer">official exam guide ↗</a>
          </p>
          {exam.note && <p className="muted small exam-note">{exam.note}</p>}
        </div>
        <button className="btn ghost" onClick={() => go('/map')}>Lessons map</button>
      </section>

      <section className="panel">
        <ReadinessSummary path={path} />
      </section>

      <section className="panel practice-modes" aria-label="Practice">
        <h3>Practise</h3>
        <div className="mode-grid">
          <button className="mode-card" onClick={() => onStart('quick')}>
            <b>⚡ Quick quiz</b>
            <span>{QUICK_SIZE} mixed questions, weighted like the exam. Answers explained as you go.</span>
          </button>
          <button className="mode-card" onClick={() => onStart('drill', r.weakest.id)}>
            <b>🎯 Drill your weakest domain</b>
            <span>{DRILL_SIZE} questions on {r.weakest.name}, favouring what you've missed or not seen.</span>
          </button>
          <button className="mode-card mock" onClick={() => onStart('full')}>
            <b>📝 Full mock exam</b>
            <span>{exam.questions} questions in {exam.minutes} minutes. No feedback until the end, like the real thing.</span>
          </button>
        </div>
      </section>

      <section className="panel domains" aria-label="Domains">
        <h3>Domain by domain</h3>
        <table className="domain-table">
          <thead>
            <tr><th>Domain</th><th>Of the exam</th><th>Estimated</th><th>Practised</th><th>Lessons</th><th /></tr>
          </thead>
          <tbody>
            {r.domains.map((d) => (
              <tr key={d.id} className={d.id === r.weakest.id ? 'weakest' : ''}>
                <td>{d.name}<span className="phone-weight">{d.weight}% of the exam</span></td>
                <td>{d.weight}%</td>
                <td>
                  <span className="mini-bar" aria-hidden>
                    <span className={d.accuracy >= 0.7 ? 'good' : ''} style={{ width: d.answered ? `${Math.round(d.accuracy * 100)}%` : 0 }} />
                  </span>{' '}
                  {d.answered ? `${Math.round(d.accuracy * 100)}%` : '—'}
                </td>
                <td>{Math.min(d.answered, d.need)}/{d.need}</td>
                <td>{d.lessonsDone}/{d.lessonsTotal}</td>
                <td><button className="btn small-btn" onClick={() => onStart('drill', d.id)}>Drill</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel checklist-panel">
        <h3>Ready to book the exam when…</h3>
        <ul className="checklist">
          {r.checklist.map((c) => (
            <li key={c.label} className={c.done ? 'done' : ''}>{c.done ? '✅' : '⬜'} {c.label}</li>
          ))}
        </ul>
        <p className="muted small">
          The estimate comes from your answers to this game's {exam.code} questions, domain by domain, weighted like the real exam, starting from a guess until you've answered enough.
          It is a guide, not a guarantee: AWS updates its exams, so read the official exam guide before you book.
        </p>
      </section>

      {history.length > 0 && (
        <section className="panel">
          <h3>Recent practice</h3>
          <ul className="history">
            {history.map((m, i) => (
              <li key={i}>
                <span>{m.mode === 'full' ? '📝 Mock exam' : m.mode === 'quick' ? '⚡ Quick quiz' : `🎯 Drill: ${exam.domains.find((d) => m.domains[d.id])?.name ?? ''}`}</span>
                <span className="muted small">{m.day}</span>
                <span>{m.correct}/{m.total}</span>
                <b className={m.passed ? 'pass' : 'fail'}>{m.score}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- a practice session

function Clock({ endsAt, onTimeUp }: { endsAt: number; onTimeUp(): void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, endsAt - now);
  useEffect(() => {
    if (left === 0) onTimeUp();
  }, [left === 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = Math.floor(left / 60_000);
  const sec = Math.floor((left % 60_000) / 1000);
  return <span className={`exam-clock ${left < 5 * 60_000 ? 'low' : ''}`} aria-label="Time left">⏱ {m}:{String(sec).padStart(2, '0')}</span>;
}

function PracticeSession({ path, session, onFinish, onQuit }: { path: Path; session: Session; onFinish(picks: number[][]): void; onQuit(): void }) {
  const mock = session.mode === 'full';
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<number[][]>(() => session.questions.map(() => []));
  const [checked, setChecked] = useState<boolean[]>(() => session.questions.map(() => false));
  const [flags, setFlags] = useState<boolean[]>(() => session.questions.map(() => false));
  const [confirm, setConfirm] = useState(false);
  const q = session.questions[index];
  const order = session.orders[index];
  const multi = answers(q).length > 1;
  const picked = picks[index];
  const done = checked[index];
  const right = done && isRight(q, picked);
  const unanswered = picks.filter((p) => p.length === 0).length;
  const domainName = path.exam!.domains.find((d) => d.id === q.domain)?.name ?? '';

  function toggle(option: number) {
    if (done) return;
    setPicks((all) => {
      const next = [...all];
      const cur = next[index];
      next[index] = multi ? (cur.includes(option) ? cur.filter((o) => o !== option) : cur.length < answers(q).length ? [...cur, option] : cur) : [option];
      return next;
    });
    sfx.click();
  }

  function check() {
    setChecked((c) => c.map((v, i) => (i === index ? true : v)));
    if (isRight(q, picked)) sfx.right();
    else sfx.wrong();
  }

  const last = index === session.questions.length - 1;
  const canCheck = picked.length === answers(q).length;

  return (
    <div className="practice">
      <div className="practice-head">
        <span className="kicker">{mock ? `${path.exam!.code} mock exam` : session.mode === 'quick' ? 'Quick quiz' : `Drill: ${domainName}`}</span>
        <span className="muted small">Question {index + 1} of {session.questions.length}{mock ? '' : ` · ${domainName}`}</span>
        <span className="spacer" />
        {mock && session.endsAt && <Clock endsAt={session.endsAt} onTimeUp={() => onFinish(picks)} />}
        <button className="btn ghost small-btn" onClick={onQuit}>Quit</button>
      </div>

      {mock && (
        <nav className="q-grid" aria-label="Questions">
          {session.questions.map((_, i) => (
            <button
              key={i}
              className={[i === index ? 'current' : '', picks[i].length ? 'answered' : '', flags[i] ? 'flagged' : ''].filter(Boolean).join(' ')}
              onClick={() => setIndex(i)}
              aria-label={`Question ${i + 1}${picks[i].length ? ', answered' : ''}${flags[i] ? ', flagged' : ''}`}
            >
              {i + 1}
            </button>
          ))}
        </nav>
      )}

      <section className="panel quiz-card exam-card">
        <h3 className="prompt">{inline(q.prompt)}</h3>
        {q.code && <Code code={q.code} />}
        {multi && <p className="muted small choose-n">Choose {answers(q).length === 2 ? 'TWO' : 'THREE'}.</p>}
        <div className="options" role={multi ? 'group' : 'radiogroup'}>
          {order.map((o, i) => {
            const isPicked = picked.includes(o);
            const state = !done ? (isPicked ? 'picked' : '') : answers(q).includes(o) ? 'right' : isPicked ? 'wrong' : 'dim';
            return (
              <button key={o} className={`option ${state}`} onClick={() => toggle(o)} aria-pressed={isPicked} disabled={done && state === 'dim'}>
                <span className="letter">{multi ? (isPicked ? '☑' : '☐') : 'ABCDE'[i]}</span>
                <span>{inline(q.options[o])}</span>
              </button>
            );
          })}
        </div>

        {!mock && done && (
          <div className={`explain ${right ? 'right' : 'wrong'}`}>
            <b>{right ? 'Correct.' : 'Not quite.'}</b> {inline(q.explain)}
          </div>
        )}

        <div className="modal-actions">
          {mock ? (
            <>
              <button className="btn ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>← Back</button>
              <button className={`btn ghost ${flags[index] ? 'flag-on' : ''}`} onClick={() => setFlags((f) => f.map((v, i) => (i === index ? !v : v)))}>
                {flags[index] ? '🚩 Flagged' : '🏳 Flag for review'}
              </button>
              {last ? (
                <button className="btn primary" onClick={() => setConfirm(true)}>Finish exam</button>
              ) : (
                <button className="btn primary" onClick={() => setIndex(index + 1)}>Next →</button>
              )}
            </>
          ) : !done ? (
            <button className="btn primary" disabled={!canCheck} onClick={check}>Check answer</button>
          ) : last ? (
            <button className="btn primary" autoFocus onClick={() => onFinish(picks)}>See results</button>
          ) : (
            <button className="btn primary" autoFocus onClick={() => setIndex(index + 1)}>Next question →</button>
          )}
        </div>
        {mock && !last && (
          <p className="muted small finish-early">
            <button className="link-btn" onClick={() => setConfirm(true)}>Finish the exam now</button>
          </p>
        )}
      </section>

      {confirm && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Finish the exam?">
            <h3>Finish the exam?</h3>
            <p>
              {unanswered ? `${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered; they count as wrong. ` : 'Every question is answered. '}
              {flags.filter(Boolean).length ? `${flags.filter(Boolean).length} flagged for review.` : ''}
            </p>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setConfirm(false)}>Keep going</button>
              <button className="btn primary" onClick={() => onFinish(picks)}>Finish and score it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- results

function Results({ path, session, picks, events, onAgain, onHome }: { path: Path; session: Session; picks: number[][]; events: Reward[]; onAgain(): void; onHome(): void }) {
  const save = useSave();
  const exam = path.exam!;
  const result = save.exam.mocks.filter((m) => m.cert === path.id).at(-1)!;
  const after = useMemo(() => readiness(save, path), [save, path]);
  const missed = session.questions.map((q, i) => ({ q, picked: picks[i] })).filter(({ q, picked }) => !isRight(q, picked));
  const xp = events.reduce((n, e) => n + (e.kind === 'xp' ? e.amount : 0), 0);
  const delta = after.percent - session.before.percent;
  const lesson = (id?: string) => (id ? path.decks.flatMap((d) => d.levels).find((l) => l.id === id) : undefined);
  return (
    <div className="exam-results">
      <section className="panel results-head">
        <p className="kicker">{session.mode === 'full' ? `${exam.code} mock exam` : session.mode === 'quick' ? 'Quick quiz' : 'Drill'} · results</p>
        <div className={`final-score ${result.passed ? 'pass' : 'fail'}`}>{result.score}</div>
        <p>
          {result.correct} of {result.total} right · {session.mode === 'full' ? (result.passed ? `✅ Pass (${exam.pass} needed)` : `❌ Below the pass mark of ${exam.pass}`) : `that would score about ${result.score} on the exam`}
        </p>
        <p className="muted">
          Readiness {session.before.percent}% → <b>{after.percent}%</b> {delta > 0 ? `(+${delta})` : delta < 0 ? `(${delta})` : ''} · {VERDICTS[after.verdict].icon} {VERDICTS[after.verdict].label}
          {xp > 0 && <> · +{xp} XP</>}
        </p>
        <p className="advice">{after.advice}</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onHome}>Back to exam prep</button>
          <button className="btn primary" onClick={onAgain}>Another {session.mode === 'full' ? 'mock exam' : session.mode === 'quick' ? 'quick quiz' : 'drill'}</button>
        </div>
      </section>

      <section className="panel">
        <h3>By domain</h3>
        <table className="domain-table">
          <tbody>
            {exam.domains.filter((d) => result.domains[d.id]).map((d) => {
              const [r, t] = result.domains[d.id];
              return (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>
                    <span className="mini-bar"><span className={r / t >= 0.7 ? 'good' : ''} style={{ width: `${(r / t) * 100}%` }} /></span>
                  </td>
                  <td>{r}/{t}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {missed.length > 0 && (
        <section className="panel missed">
          <h3>To learn from ({missed.length})</h3>
          {missed.map(({ q, picked }) => (
            <article key={q.id} className="missed-q">
              <p className="prompt">{inline(q.prompt)}</p>
              <p className="muted small">
                {picked.length ? <>You answered: {picked.map((p) => q.options[p]).join(' + ')}. </> : 'Not answered. '}
              </p>
              <p><b>Answer:</b> {answers(q).map((a) => q.options[a]).join(' + ')}</p>
              <p className="muted">{inline(q.explain)}</p>
              {lesson(q.from) && (
                <button className="link-btn" onClick={() => go(`/level/${q.from}`)}>Revisit the lesson: {lesson(q.from)!.title}</button>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
