// Spaced review: a short session of questions about things you've already
// learned, each due on its own schedule. Remembering on purpose, with growing
// gaps in between, is what moves knowledge into long-term memory. Cards you
// miss come back at the end of the session (so you finish having got them
// right) and again tomorrow; cards you know come back later and less often.
import { useState } from 'react';
import { findLevel } from '../content';
import { addDays, answerReview, dayOf, dueReviews, finishReview, nextReviewDay, REVIEW_INTERVALS, REVIEW_MONTH_BOX, REVIEW_SESSION } from '../game/rewards';
import { sfx } from '../game/sound';
import { act, getSave, useSave } from '../game/store';
import type { ReviewItem } from '../game/types';
import { Code } from '../ui/highlight';
import { inline } from '../ui/Markdown';
import { go } from '../ui/router';

/** A stable shuffle of a card's options for today, so the answer isn't always in the same place. */
function order(item: ReviewItem, today: string): number[] {
  const idx = item.options.map((_, i) => i);
  let h = 2166136261;
  for (const ch of item.id + today) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  for (let i = idx.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

function when(day: string | null, today: string): string {
  if (!day) return 'when you clear more levels';
  if (day === addDays(today, 1)) return 'tomorrow';
  const days = Math.round((new Date(`${day}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
  return `in ${days} days`;
}

export function ReviewScreen() {
  // Each round is a fresh session of whatever is due.
  const [round, setRound] = useState(0);
  return <ReviewSession key={round} onAgain={() => setRound((r) => r + 1)} />;
}

function ReviewSession({ onAgain }: { onAgain(): void }) {
  const save = useSave();
  const today = dayOf(new Date());
  const [queue, setQueue] = useState<ReviewItem[]>(() => dueReviews(getSave(), today).slice(0, REVIEW_SESSION));
  const [size] = useState(queue.length);
  const [recorded, setRecorded] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  /** Cards missed this session, waiting at the back of the line for another try. */
  const [retrying, setRetrying] = useState<string[]>([]);
  /** Cards seen for the first time so far, counting the one on screen. */
  const [position, setPosition] = useState(1);
  const deckSize = Object.keys(save.reviews).length;

  const item = queue[0];
  const firstTry = Object.values(recorded).filter(Boolean).length;
  const mistakes = Object.values(recorded).filter((r) => !r).length;

  if (!item || finished) {
    const due = dueReviews(save, today).length;
    const next = nextReviewDay(save, today);
    return (
      <div className="review">
        <section className="panel review-intro">
          <p className="kicker">Review</p>
          {size > 0 ? (
            <>
              <h2>Session complete</h2>
              <div className="final-score">{firstTry}/{size}</div>
              <p>remembered on the first try.</p>
              <p className="muted">
                Cards you knew come back in {REVIEW_INTERVALS[1]} to {REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1]} days, a little later each time you remember them.
                {mistakes > 0 && ` The ${mistakes} you missed come back tomorrow.`}
              </p>
            </>
          ) : deckSize === 0 ? (
            <>
              <h2>Nothing to review yet</h2>
              <p>
                When you finish a quiz, or a TypeScript or React level, its key ideas join your review deck. They come back the next day,
                then again a few days later, then a week, a month… each time you remember them, the gap grows.
              </p>
              <p className="muted">Remembering on purpose, spaced out over days, is the most reliable way to make what you learn stick.</p>
            </>
          ) : (
            <>
              <h2>All caught up</h2>
              <p>Nothing is due today. Your next review is {when(next, today)}.</p>
            </>
          )}
          <p className="muted small">
            {deckSize} card{deckSize === 1 ? '' : 's'} in your deck · {Object.values(save.reviews).filter((r) => r.box >= REVIEW_MONTH_BOX).length} remembered for a month or more
          </p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => go('/map')}>Back to the map</button>
            {due > 0 && size > 0 && <button className="btn primary" autoFocus onClick={onAgain}>Review {Math.min(due, REVIEW_SESSION)} more</button>}
          </div>
        </section>
      </div>
    );
  }

  const shown = order(item, today);
  const answered = picked !== null;
  const correct = answered && shown[picked] === item.answer;
  const source = findLevel(item.after);
  const box = save.reviews[item.id]?.box ?? 0;
  const again = retrying.includes(item.id);

  function pick(i: number) {
    if (answered) return;
    setPicked(i);
    const right = shown[i] === item.answer;
    if (right) sfx.right();
    else sfx.wrong();
    // Only the first answer in a session moves the card through its schedule.
    if (!(item.id in recorded)) {
      setRecorded((r) => ({ ...r, [item.id]: right }));
      act((s) => answerReview(s, item.id, right, today));
    }
  }

  function next() {
    const rest = queue.slice(1);
    // A missed card goes to the back of the line, until you get it right.
    const nextQueue = correct ? rest : [...rest, item];
    setPicked(null);
    setQueue(nextQueue);
    if (!correct && !again) setRetrying((r) => [...r, item.id]);
    if (correct && again) setRetrying((r) => r.filter((id) => id !== item.id));
    if (!again && nextQueue.length && !retrying.includes(nextQueue[0].id) && nextQueue[0].id !== item.id) setPosition((p) => p + 1);
    if (!nextQueue.length) {
      const all = { ...recorded };
      act((s) => finishReview(s, Object.keys(all).length, Object.values(all).filter((r) => !r).length));
      sfx.pass();
      setFinished(true);
    }
  }

  return (
    <div className="review">
      <div className="review-progress">
        <span className="muted small">
          {again ? 'One more try' : `Card ${Math.min(position, size)} of ${size}`}
        </span>
        <span className="pips" aria-label={`Known: box ${box} of ${REVIEW_INTERVALS.length - 1}`} title="How well you know this card">
          {REVIEW_INTERVALS.slice(1).map((_, i) => <span key={i} className={i < box ? 'on' : ''} />)}
        </span>
      </div>
      <section className="panel quiz-card review-card">
        <p className="kicker">From {source ? `${source.deck.name}: ${source.level.title}` : 'an earlier level'}</p>
        <h3 className="prompt">{inline(item.prompt)}</h3>
        {item.code && <Code code={item.code} />}
        <div className="options">
          {shown.map((o, i) => {
            const state = !answered ? '' : o === item.answer ? 'right' : i === picked ? 'wrong' : 'dim';
            return (
              <button key={o} className={`option ${state}`} onClick={() => pick(i)} disabled={answered && state !== 'right' && state !== 'wrong'}>
                <span className="letter">{'ABCD'[i]}</span>
                <span>{inline(item.options[o])}</span>
              </button>
            );
          })}
        </div>
        {answered && (
          <div className={`explain ${correct ? 'right' : 'wrong'}`}>
            <b>{correct ? 'Correct.' : 'Not quite.'}</b> {inline(item.explain)}
            {!correct && !again && <p className="muted small">You'll see this one again at the end of this session, and again tomorrow.</p>}
            <div className="modal-actions">
              {source && (
                <button className="btn ghost" onClick={() => go(`/level/${source.level.id}`)}>
                  Revisit the lesson: {source.level.title}
                </button>
              )}
              <button className="btn primary" autoFocus onClick={next}>
                {queue.length > 1 || !correct ? 'Next card →' : 'Finish'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
