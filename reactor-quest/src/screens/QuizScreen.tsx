import { useState } from 'react';
import { complete, levelState, quizStars } from '../game/progress';
import { sfx } from '../game/sound';
import { setSave, useSave } from '../game/store';
import type { Deck, QuizLevel } from '../game/types';
import { Code } from '../ui/highlight';
import { Markdown, inline } from '../ui/Markdown';
import { Victory } from '../ui/Victory';

export function QuizScreen({ level, deck, index }: { level: QuizLevel; deck: Deck; index: number }) {
  const save = useSave();
  const progress = levelState(save, level.id);
  const [q, setQ] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [victory, setVictory] = useState<{ stars: number; xp: number } | null>(null);
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
      setMistakes((m) => m + 1);
    }
  }

  function next() {
    if (q + 1 < level.questions.length) {
      setQ(q + 1);
      setPicked(null);
      return;
    }
    const stars = quizStars(mistakes);
    let xp = 0;
    setSave((s) => {
      const r = complete(s, level, stars);
      xp = r.xpGained;
      return { ...r.save, flags: { ...r.save.flags, quizPerfect: r.save.flags.quizPerfect || mistakes === 0 } };
    });
    sfx.pass();
    setVictory({ stars, xp });
  }

  function replay() {
    setQ(0);
    setPicked(null);
    setMistakes(0);
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
            <span key={i} className={i < q ? 'done' : i === q ? 'current' : ''} />
          ))}
          <span className="muted small">Question {q + 1} of {level.questions.length} · {mistakes === 0 ? 'no mistakes yet' : `${mistakes} mistake${mistakes > 1 ? 's' : ''}`}</span>
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
            <div className="modal-actions">
              <button className="btn primary" autoFocus onClick={next}>
                {q + 1 < level.questions.length ? 'Next question →' : 'Finish'}
              </button>
            </div>
          </div>
        )}
      </section>
      {victory && <Victory level={level} stars={victory.stars} xp={victory.xp} onReplay={replay} onClose={() => setVictory(null)} />}
    </div>
  );
}
