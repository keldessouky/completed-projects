// A card's face: the real Scryfall image when it loads, a drawn frame when it doesn't
// (offline, or tokens, which have no image).
import { memo, useState } from 'react';
import { imageUrl, type Card } from '../data/cards';

const FRAME: Record<string, string> = { W: '#f3ead2', U: '#bcd7ee', B: '#b7aeb0', R: '#f0b8a0', G: '#b9d8b5' };

function frameColor(c: Card) {
  if (c.colors.length > 1) return '#e6cf86';
  if (c.colors.length === 1) return FRAME[c.colors[0]];
  if (c.types.includes('Land')) return '#d8c8b0';
  return '#c9ccd2';
}

/** "{2}{R}{R}" as mana symbols (Scryfall's SVGs, with a text fallback). */
export const ManaCost = memo(function ManaCost({ cost, size = 16 }: { cost: string; size?: number }) {
  const syms = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  if (!syms.length) return null;
  return (
    <span className="mana-cost" aria-label={cost}>
      {syms.map((s, i) => (
        <ManaSymbol key={i} sym={s} size={size} />
      ))}
    </span>
  );
});

function ManaSymbol({ sym, size }: { sym: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const file = sym.replace('/', '');
  if (failed) return <span className={`mana-fallback mana-${file}`} style={{ width: size, height: size, fontSize: size * 0.62 }}>{sym}</span>;
  return <img className="mana-symbol" src={`https://svgs.scryfall.io/card-symbols/${file}.svg`} alt={`{${sym}}`} width={size} height={size} onError={() => setFailed(true)} draggable={false} />;
}

/** Card rules text with {T}, {R} etc. drawn as symbols. */
export function RulesText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i}>
          {line.split(/(\{[^}]+\})/).map((part, j) => (part.startsWith('{') ? <ManaCost key={j} cost={part} size={13} /> : part))}
        </p>
      ))}
    </>
  );
}

function DrawnCard({ card }: { card: Card }) {
  const pt = card.powerText !== undefined ? `${card.powerText}/${card.toughnessText}` : card.loyalty ? `◈${card.loyalty}` : '';
  return (
    <div className="drawn-card" style={{ background: frameColor(card) }}>
      <div className="drawn-title">
        <span className="drawn-name">{card.name}</span>
        <ManaCost cost={card.cost} size={11} />
      </div>
      <div className="drawn-art">{card.types.includes('Land') ? card.name : card.subtypes.join(' ') || card.types.join(' ')}</div>
      <div className="drawn-type">{card.typeLine}</div>
      <div className="drawn-text">
        <RulesText text={card.text} />
      </div>
      {pt && <div className="drawn-pt">{pt}</div>}
    </div>
  );
}

/** Whether to load card images at all (players can turn them off to play fully offline). */
export const imagesEnabled = { current: true };

export const CardFace = memo(function CardFace({ card, size = 'normal', back = false }: { card: Card; size?: 'normal' | 'large' | 'small'; back?: boolean }) {
  const [failed, setFailed] = useState(false);
  const hasImage = !card.id.startsWith('token-') && imagesEnabled.current;
  if (!hasImage || failed) return <DrawnCard card={card} />;
  return (
    <img
      className="card-img"
      src={imageUrl(card.id, size, back)}
      alt={card.fullName}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
});

export function CardBack() {
  return <div className="card-back" aria-label="Card back" />;
}
