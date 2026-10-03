import { DECKS, ALL_LEVELS } from '../content';
import { isUnlocked, levelState } from '../game/progress';
import { sfx } from '../game/sound';
import { useSave } from '../game/store';
import { go } from '../ui/router';

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
      {DECKS.map((deck, d) => {
        const done = deck.levels.filter((l) => levelState(save, l.id).done).length;
        const stars = deck.levels.reduce((n, l) => n + levelState(save, l.id).stars, 0);
        const locked = !isUnlocked(save, deck.levels[0].id);
        return (
          <section key={deck.id} className={`panel deck ${locked ? 'locked' : ''}`} style={{ ['--hue' as string]: deck.hue }}>
            <header>
              <div>
                <p className="kicker">Deck {d + 1} · {deck.subtitle}</p>
                <h3>{deck.name}</h3>
              </div>
              <div className="deck-stats">
                <span>{done}/{deck.levels.length} online</span>
                <span className="star-count">★ {stars}/{deck.levels.length * 3}</span>
              </div>
            </header>
            <ol className="nodes">
              {deck.levels.map((level, i) => {
                const p = levelState(save, level.id);
                const open = isUnlocked(save, level.id);
                const boss = level.kind === 'code' && level.boss;
                const cls = ['node', p.done ? 'done' : '', open ? '' : 'locked', boss ? 'boss' : '', level.kind === 'quiz' ? 'is-quiz' : '', nextUp?.id === level.id ? 'next' : '']
                  .filter(Boolean)
                  .join(' ');
                return (
                  <li key={level.id} className={cls}>
                    <button
                      disabled={!open}
                      onClick={() => {
                        sfx.click();
                        go(`/level/${level.id}`);
                      }}
                      aria-label={`${level.title}${p.done ? `, ${p.stars} stars` : open ? '' : ', locked'}`}
                    >
                      <span className="orb">{!open ? '🔒' : boss ? '☢' : level.kind === 'quiz' ? '?' : i + 1}</span>
                      <span className="node-title">{level.title}</span>
                      <span className="node-stars">{p.done ? '★'.repeat(p.stars) + '☆'.repeat(3 - p.stars) : ' '}</span>
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
