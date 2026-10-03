// "Compiler Says": 60 seconds, a stream of TypeScript snippets, and one
// question each time — does this compile under strict mode?
import { useCallback, useEffect, useRef, useState } from 'react';
import { ARCADE_CARDS } from '../content/arcade';
import { compile } from '../engine/compiler';
import { sfx } from '../game/sound';
import { getSave, setSave } from '../game/store';
import type { ArcadeCard } from '../game/types';
import { Code } from '../ui/highlight';
import { inline } from '../ui/Markdown';

const ROUND_SECONDS = 60;

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = 'intro' | 'playing' | 'over';

export function ArcadeScreen() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [deck, setDeck] = useState<ArcadeCard[]>([]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [feedback, setFeedback] = useState<{ right: boolean; said: boolean } | null>(null);
  const [compilerSays, setCompilerSays] = useState<string | null>(null);
  const [result, setResult] = useState<{ best: boolean; xp: number } | null>(null);
  const card = deck[i];
  const timer = useRef<number | undefined>(undefined);

  const start = () => {
    setDeck(shuffle(ARCADE_CARDS));
    setI(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setTimeLeft(ROUND_SECONDS);
    setFeedback(null);
    setResult(null);
    setPhase('playing');
    sfx.click();
  };

  // The clock pauses while a wrong answer's explanation is on screen.
  useEffect(() => {
    if (phase !== 'playing' || (feedback && !feedback.right)) return;
    timer.current = window.setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer.current);
  }, [phase, feedback]);

  const finish = useCallback(() => {
    setPhase('over');
    const xp = score * 5;
    const best = score > getSave().arcadeBest;
    setSave((s) => ({ ...s, xp: s.xp + xp, arcadeBest: Math.max(s.arcadeBest, score), arcadeCombo: Math.max(s.arcadeCombo, bestCombo) }));
    setResult({ best, xp });
    sfx.pass();
  }, [score, bestCombo]);

  useEffect(() => {
    if (phase === 'playing' && timeLeft === 0 && !feedback) finish();
  }, [phase, timeLeft, feedback, finish]);

  const advance = useCallback(() => {
    setFeedback(null);
    setCompilerSays(null);
    if (timeLeft === 0) return; // the finish effect takes it from here
    if (i + 1 >= deck.length) {
      setDeck(shuffle(ARCADE_CARDS));
      setI(0);
    } else setI(i + 1);
  }, [i, deck.length, timeLeft]);

  const answer = useCallback(
    (said: boolean) => {
      if (!card || feedback || phase !== 'playing') return;
      const right = said === card.ok;
      setFeedback({ right, said });
      if (right) {
        sfx.right();
        setScore((s) => s + 1);
        const streak = combo + 1;
        setCombo(streak);
        setBestCombo((b) => Math.max(b, streak));
        setTimeout(() => advance(), 900);
      } else {
        sfx.wrong();
        setCombo(0);
      }
      if (!card.ok) {
        compile({ '/card.tsx': `${card.code}\nexport {};\n` })
          .then((r) => setCompilerSays(r.diagnostics[0] ? `line ${r.diagnostics[0].line}: ${r.diagnostics[0].message}` : null))
          .catch(() => {});
      }
    },
    [card, feedback, phase, advance, combo],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'intro' || phase === 'over') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
        return;
      }
      if (feedback && !feedback.right && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        advance();
      } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'n') answer(false);
      else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'y') answer(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (phase === 'intro' || phase === 'over') {
    const best = getSave().arcadeBest;
    return (
      <div className="arcade">
        <div className="panel arcade-intro">
          <p className="kicker">Arcade</p>
          <h2>Compiler Says</h2>
          {phase === 'over' && result ? (
            <>
              <div className="final-score">{score}</div>
              <p>{result.best ? '🏆 New personal best!' : `Personal best: ${best}`} · longest streak {bestCombo} · +{result.xp} XP</p>
            </>
          ) : (
            <>
              <p>
                You have <b>60 seconds</b>. Each card is a snippet of TypeScript, checked with <code>strict</code> on. Does it compile?
              </p>
              <p className="muted">
                <kbd>←</kbd> / <kbd>N</kbd> type error · <kbd>→</kbd> / <kbd>Y</kbd> compiles. A wrong answer pauses the clock and shows you why.
              </p>
              {best > 0 && <p>Personal best: <b>{best}</b></p>}
            </>
          )}
          <button className="btn primary big" onClick={start}>
            {phase === 'over' ? 'Play again' : 'Start'} <kbd>↵</kbd>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="arcade">
      <div className="arcade-hud">
        <div className={`clock ${timeLeft <= 10 ? 'low' : ''}`}>{timeLeft}s</div>
        <div className="score">Score <b>{score}</b></div>
        <div className={`combo ${combo >= 3 ? 'hot' : ''}`}>{combo >= 2 ? `🔥 ${combo} streak` : ''}</div>
      </div>
      <div className={`panel arcade-card ${feedback ? (feedback.right ? 'right' : 'wrong') : ''}`}>
        <p className="kicker">Does this compile?</p>
        {card && <Code code={card.code} />}
        {feedback && (
          <div className={`explain ${feedback.right ? 'right' : 'wrong'}`}>
            <b>{card.ok ? '✓ It compiles.' : '✗ Type error.'}</b> {inline(card.why)}
            {!card.ok && compilerSays && <div className="compiler-says">tsc: {compilerSays}</div>}
            {!feedback.right && (
              <div className="modal-actions">
                <button className="btn primary" autoFocus onClick={advance}>Next card <kbd>↵</kbd></button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="arcade-buttons">
        <button className="btn big no" onClick={() => answer(false)} disabled={!!feedback}>
          <kbd>←</kbd> Type error
        </button>
        <button className="btn big yes" onClick={() => answer(true)} disabled={!!feedback}>
          Compiles <kbd>→</kbd>
        </button>
      </div>
    </div>
  );
}
