// The big card on the right: whatever you're pointing at, and exactly what it does in this game.
import { createContext, useContext, useState } from 'react';
import { scryfallUrl, type Card } from '../data/cards';
import { abilitiesOf } from '../game/abilities';
import { cardGrade, cardScore, gradeInfo } from '../game/quality';
import { imageUrl, VARIANT_NAMES } from '../data/cards';
import { useArt, useArtSettings } from './Art';
import { CardFace, ManaCost } from './CardFace';
import { GradeBadge } from './Grade';

export interface Hovered {
  card: Card;
  /** Live numbers for a permanent on the battlefield. */
  live?: { power: number; toughness: number; keywords: string[]; notes: string[] };
}

export const HoverContext = createContext<(h: Hovered | null) => void>(() => {});
export const useHover = () => useContext(HoverContext);

export function Inspector({ hovered, setName }: { hovered: Hovered | null; setName: (code: string) => string }) {
  const [back, setBack] = useState(false);
  if (!hovered) {
    return (
      <div className="inspector empty">
        <p>Point at any card to see it up close, along with exactly which of its abilities this game simulates.</p>
      </div>
    );
  }
  const { card, live } = hovered;
  const a = abilitiesOf(card);
  const isToken = card.id.startsWith('token-');
  return (
    <div className="inspector">
      <div className="inspector-card">
        <CardFace key={`${card.id}-${back}`} card={card} size="large" back={back} />
      </div>
      <Versions card={card} />
      {card.hasBack && (
        <button type="button" className="link-button" onClick={() => setBack((b) => !b)}>
          {back ? 'Show front face' : 'Show back face'} (the game plays the front)
        </button>
      )}
      <div className="inspector-head">
        <strong>{card.fullName}</strong> <ManaCost cost={card.cost} size={15} />
      </div>
      <div className="muted">{card.typeLine}</div>
      {!isToken && !card.supertypes.includes('Basic') && (
        <div className={`inspector-grade q-${cardGrade(card)}`}>
          <GradeBadge card={card} size="md" />
          <span className={`graded q-${cardGrade(card)}`}>{gradeInfo(cardGrade(card)).name}</span>
          <span className="muted small">
            {cardScore(card)}/100 · {gradeInfo(cardGrade(card)).blurb}
            {card.edhrecRank ? ` · #${card.edhrecRank.toLocaleString()} most played` : ''}
          </span>
        </div>
      )}
      {live && (
        <div className="live">
          {card.types.includes('Creature') && (
            <span className="live-pt">
              {live.power}/{live.toughness}
            </span>
          )}
          {live.keywords.map((k) => (
            <span key={k} className="chip">{k}</span>
          ))}
          {live.notes.map((n) => (
            <span key={n} className="chip note">{n}</span>
          ))}
        </div>
      )}
      {(a.simulated.length > 0 || a.unsupported.length > 0) && (
        <ul className="sim-list">
          {a.simulated.map((l, i) => (
            <li key={`s${i}`} className="sim-yes" title="Simulated in this game">{l}</li>
          ))}
          {a.unsupported.map((l, i) => (
            <li key={`u${i}`} className="sim-no" title="Not simulated in this game">{l}</li>
          ))}
        </ul>
      )}
      {!card.text && card.types.includes('Creature') && <p className="muted small">No rules text — fully simulated.</p>}
      {card.flavor && <p className="flavor">{card.flavor}</p>}
      {!isToken && (
        <p className="muted small">
          {setName(card.set)} · first printed {card.year} in {setName(card.firstSet)}
          {card.artist && <> · art by {card.artist}</>} ·{' '}
          <a href={scryfallUrl(card)} target="_blank" rel="noreferrer">Scryfall</a>
        </p>
      )}
    </div>
  );
}

/** Every special printing of a card; click one to use its art everywhere. */
function Versions({ card }: { card: Card }) {
  const { pick } = useArtSettings();
  const current = useArt(card);
  if (!card.variants.length) return null;
  const options = [{ id: card.id, label: 'Classic', title: 'The standard printing' }, ...card.variants.map((v) => {
    const label = v.note === '1of1' ? 'Serialized 1 of 1' : `${VARIANT_NAMES[v.kind]}${v.note ? ` (${v.note})` : ''}`;
    return { id: v.id, label, title: `${label} · ${v.set.toUpperCase()}` };
  })];
  return (
    <div className="versions">
      <div className="muted small">
        {card.variants.length} special version{card.variants.length > 1 ? 's' : ''} · click to use that art
      </div>
      <div className="version-strip">
        {options.map((o) => (
          <button key={o.id} type="button" className={`version ${current.id === o.id ? 'on' : ''}`} title={o.title} onClick={() => pick(card, o.id)}>
            <img src={imageUrl(o.id, 'small')} alt="" loading="lazy" />
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
