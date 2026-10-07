import { useState } from 'react';
import { levelState, quizStars } from '../game/progress';
import { completeLevel, PET_LINES, type Reward } from '../game/rewards';
import { sfx } from '../game/sound';
import { act, useSave } from '../game/store';
import { overlays } from '../ui/overlays';
import { useLevelTimer } from '../ui/useLevelTimer';
import type { Deck, QuizLevel } from '../game/types';
import { Code } from '../ui/highlight';
import { Markdown, inline } from '../ui/Markdown';
import { Victory } from '../ui/Victory';

export function QuizScreen({ level, deck, index }: { level: QuizLevel; deck: Deck; index: number }) {
  const save = useSave();
  const progress = levelState(save, level.id);
  // Questions still to answer correctly. One you get wrong goes to the back of
  // the line, so every quiz ends with every answer right; only first-try
  // mistakes cost stars.
  const [queue, setQueue] = useState(() => level.questions.map((_, i) => i));
  const [missed, setMissed] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const q = queue[0];
  const mistakes = missed.length;
  const retry = missed.includes(q);
  const [victory, setVictory] = useState<{ stars: number; events: Reward[] } | null>(null);
  const seconds = useLevelTimer(level.id, !victory);
  const [attempt, setAttempt] = useState(0);
  const question = level.questions[q];
  const answered = picked !== null;
  const correct = picked === question.answer;

  function pick(i: number) {
    if (answered) return;
    setPicked(i);
    if (i === question.answer) sfx.right();
    else {
      sfx.wrong();
      if (!missed.includes(q)) setMissed((m) => [...m, q]);
    }
  }

  function next() {
    const rest = correct ? queue.slice(1) : [...queue.slice(1), q];
    if (rest.length) {
      setQueue(rest);
      setPicked(null);
      return;
    }
    const stars = quizStars(mistakes);
    const events = act((s) =>
      completeLevel(s, level, { stars, firstTry: false, failedRuns: 0, clean: false, perfect: mistakes === 0, seconds }, Math.random),
    );
    sfx.pass();
    overlays.petSay(PET_LINES.pass[Math.floor(Math.random() * PET_LINES.pass.length)]);
    setVictory({ stars, events });
  }

  function replay() {
    setQueue(level.questions.map((_, i) => i));
    setPicked(null);
    setMissed([]);
    setVictory(null);
    setAttempt((a) => a + 1);
  }

  return (
    <div className="quiz" key={attempt}>
      <aside className="panel brief">
        <div className="level-head">
          <span className="deck-tag" style={{ ['--hue' as string]: deck.hue }}>{deck.name} · {index + 1}</span>
          <h2>{level.title}</h2>
          <p className="system">System: {level.system}</p>
          {progress.done && <p className="stars-line">Best {'★'.repeat(progress.stars)}{'☆'.repeat(3 - progress.stars)}</p>}
        </div>
        <div className="tab-body">
          <Markdown text={level.brief} />
          <h4>Quick reference</h4>
          <Markdown text={level.lesson} />
        </div>
      </aside>
      <section className="panel quiz-card">
        <div className="quiz-progress">
          {level.questions.map((_, i) => (
            <span key={i} className={!queue.includes(i) ? 'done' : i === q ? 'current' : ''} />
          ))}
          <span className="muted small">
            {retry ? 'One more try' : `Question ${level.questions.length - queue.length + 1} of ${level.questions.length}`} ·{' '}
            {mistakes === 0 ? 'no mistakes yet' : `${mistakes} to revisit`}
          </span>
        </div>
        <h3 className="prompt">{inline(question.prompt)}</h3>
        {question.code && <Code code={question.code} />}
        <div className="options">
          {question.options.map((o, i) => {
            const state = !answered ? '' : i === question.answer ? 'right' : i === picked ? 'wrong' : 'dim';
            return (
              <button key={i} className={`option ${state}`} onClick={() => pick(i)} disabled={answered && state !== 'right' && state !== 'wrong'}>
                <span className="letter">{'ABCD'[i]}</span>
                <span>{inline(o)}</span>
              </button>
            );
          })}
        </div>
        {answered && (
          <div className={`explain ${correct ? 'right' : 'wrong'}`}>
            <b>{correct ? 'Correct.' : 'Not quite.'}</b> {inline(question.explain)}
            {!correct && !retry && <p className="muted small">This one comes back at the end, so you finish the quiz knowing it.</p>}
            <div className="modal-actions">
              <button className="btn primary" autoFocus onClick={next}>
                {queue.length > 1 || !correct ? 'Next question →' : 'Finish'}
              </button>
            </div>
          </div>
        )}
      </section>
      {victory && <Victory level={level} stars={victory.stars} events={victory.events} onReplay={replay} onClose={() => setVictory(null)} />}
    </div>
  );
}
