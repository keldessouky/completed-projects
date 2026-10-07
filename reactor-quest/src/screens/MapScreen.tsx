import { ALL_LEVELS, DECKS } from '../content';
import { isBoss, isUnlocked, levelState } from '../game/progress';
import { addDays, claimQuest, dayOf, dueReviews, nextReviewDay, QUESTS, questProgress, REVIEW_MONTH_BOX, SPONSORS } from '../game/rewards';
import { sfx } from '../game/sound';
import { act, useSave } from '../game/store';
import { go } from '../ui/router';

/** Spaced review: what's due today, and how much you've kept. */
function Review() {
  const save = useSave();
  const today = dayOf(new Date());
  const deck = Object.values(save.reviews);
  if (!deck.length) return null;
  const due = dueReviews(save, today).length;
  const next = nextReviewDay(save, today);
  const kept = deck.filter((r) => r.box >= REVIEW_MONTH_BOX).length;
  return (
    <section className={`panel review-panel ${due ? 'due' : ''}`} aria-label="Review">
      <div>
        <p className="kicker">Review</p>
        <h3>{due ? `${due} card${due === 1 ? '' : 's'} to review` : 'All caught up'}</h3>
        <p className="muted small">
          {due
            ? 'A few minutes of remembering what you\'ve learned, spaced out over days, is what makes it stick.'
            : `Next cards come back ${next === addDays(today, 1) ? 'tomorrow' : next ? `on ${next}` : 'as you clear more levels'}.`}{' '}
          {deck.length} in your deck · {kept} remembered for a month or more.
        </p>
      </div>
      {due > 0 && (
        <button className="btn primary" onClick={() => go('/review')}>
          Start review →
        </button>
      )}
    </section>
  );
}

function Quests() {
  const save = useSave();
  const today = dayOf(new Date());
  const quests = (save.quests?.ids ?? []).map((id) => QUESTS.find((q) => q.id === id)!).filter(Boolean);
  if (!quests.length) return null;
  return (
    <section className="panel quests" aria-label="Daily quests">
      <header>
        <div>
          <p className="kicker">Daily quests</p>
          <h3>Today's contracts</h3>
        </div>
        <div className="streak" title={`Best streak: ${save.streak.best} days`}>
          🔥 <b>{save.streak.count}</b> day streak
        </div>
      </header>
      <ul>
        {quests.map((q) => {
          const progress = questProgress(save, q);
          const claimed = save.quests!.claimed.includes(q.id);
          const done = progress >= q.goal;
          return (
            <li key={q.id} className={claimed ? 'claimed' : done ? 'done' : ''}>
              <span className="q-text">{q.text}</span>
              <span className="q-bar"><span style={{ width: `${(progress / q.goal) * 100}%` }} /></span>
              <span className="q-count">{progress}/{q.goal}</span>
              {claimed ? (
                <span className="muted small">Claimed ✓</span>
              ) : (
                <button className="btn small-btn" disabled={!done} onClick={() => { sfx.unlock(); act((s) => claimQuest(s, q.id, today)); }}>
                  {done ? 'Claim 🎁' : 'Reward: Silver box + 30 gold'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function MapScreen() {
  const save = useSave();
  const nextUp = ALL_LEVELS.find((l) => isUnlocked(save, l.id) && !levelState(save, l.id).done);

  return (
    <div className="map">
      {nextUp && (
        <button className="panel next-up" onClick={() => go(`/level/${nextUp.id}`)}>
          <span className="kicker">Next up</span>
          <span className="next-title">{nextUp.title}</span>
          <span className="muted">{nextUp.system}</span>
          <span className="go-arrow">→</span>
        </button>
      )}
      <Review />
      <Quests />
      {DECKS.map((deck, d) => {
        const done = deck.levels.filter((l) => levelState(save, l.id).done).length;
        const stars = deck.levels.reduce((n, l) => n + levelState(save, l.id).stars, 0);
        const locked = !isUnlocked(save, deck.levels[0].id);
        const cleared = done === deck.levels.length;
        const sponsor = SPONSORS[deck.id];
        return (
          <section key={deck.id} className={`panel deck ${locked ? 'locked' : ''} ${cleared ? 'cleared' : ''}`} style={{ ['--hue' as string]: deck.hue }}>
            <header>
              <div>
                <p className="kicker">Floor {d + 1} · {deck.subtitle}</p>
                <h3>{deck.name}</h3>
                <p className="outcome">{cleared ? '✓ ' : ''}{deck.outcome}</p>
              </div>
              <div className="deck-stats">
                <span>{done}/{deck.levels.length} online</span>
                <span className="star-count">★ {stars}/{deck.levels.length * 3}</span>
                {cleared && sponsor && <span className="sponsor-chip" title={`Sponsored by ${sponsor.name}`}>{sponsor.icon} {sponsor.name}</span>}
              </div>
            </header>
            <ol className="nodes">
              {deck.levels.map((level, i) => {
                const p = levelState(save, level.id);
                const open = isUnlocked(save, level.id);
                const boss = isBoss(level);
                const cls = ['node', p.done ? 'done' : '', open ? '' : 'locked', boss ? 'boss' : '', level.kind === 'quiz' ? 'is-quiz' : '', nextUp?.id === level.id ? 'next' : '']
                  .filter(Boolean)
                  .join(' ');
                const skipHint = boss && open && !p.done && !isUnlocked(save, deck.levels[deck.levels.length - 2].id);
                return (
                  <li key={level.id} className={cls}>
                    <button
                      disabled={!open}
                      onClick={() => {
                        sfx.click();
                        go(`/level/${level.id}`);
                      }}
                      title={skipHint ? 'Already know this? Beat the boss to skip ahead to the next floor.' : undefined}
                      aria-label={`${level.title}${p.done ? `, ${p.stars} stars` : open ? '' : ', locked'}`}
                    >
                      <span className="orb">{!open ? '🔒' : boss ? '☢' : level.kind === 'quiz' ? '?' : i + 1}</span>
                      <span className="node-title">{level.title}</span>
                      <span className="node-stars">{p.done ? '★'.repeat(p.stars) + '☆'.repeat(3 - p.stars) : skipHint ? 'skip ahead?' : ' '}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
