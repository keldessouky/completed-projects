// Browse the whole card universe.
import { useDeferredValue, useMemo, useState } from 'react';
import { COLORS, COLOR_NAMES, type Card, type Color, type Universe } from '../data/cards';
import type { Theme } from '../data/themes';
import { playability } from '../game/abilities';
import { deckable } from '../game/deck';
import { cardScore } from '../game/quality';
import { CardFace, ManaCost } from './CardFace';
import { GradeBadge } from './Grade';
import { useHover } from './Inspector';

const TYPES = ['Any type', 'Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Land', 'Planeswalker', 'Battle'];
const SORTS = { name: 'Name', best: 'Best first', new: 'Newest', old: 'Oldest', mv: 'Mana value' } as const;
const PAGE = 48;

export function Library({ universe, themes }: { universe: Universe; themes: Theme[] }) {
  const [text, setText] = useState('');
  const [type, setType] = useState(TYPES[0]);
  const [colors, setColors] = useState<(Color | 'C')[]>([]);
  const [themeId, setThemeId] = useState('universal');
  const [sort, setSort] = useState<keyof typeof SORTS>('name');
  const [onlyPlayable, setOnlyPlayable] = useState(false);
  const [page, setPage] = useState(0);
  const query = useDeferredValue(text);
  const hover = useHover();

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const theme = themes.find((t) => t.id === themeId);
    const out = universe.cards.filter((c) => {
      if (type !== TYPES[0] && !c.types.includes(type)) return false;
      if (colors.length) {
        const ok = colors.some((col) => (col === 'C' ? c.colors.length === 0 : c.colors.includes(col)));
        if (!ok) return false;
      }
      if (onlyPlayable && !deckable(c)) return false;
      if (theme && theme.id !== 'universal' && !theme.match(c)) return false;
      if (words.length) {
        const hay = `${c.fullName}\n${c.typeLine}\n${c.text}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const by: Record<keyof typeof SORTS, (a: Card, b: Card) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      best: (a, b) => cardScore(b) - cardScore(a) || a.name.localeCompare(b.name),
      new: (a, b) => b.year - a.year || a.name.localeCompare(b.name),
      old: (a, b) => a.year - b.year || a.name.localeCompare(b.name),
      mv: (a, b) => a.cmc - b.cmc || a.name.localeCompare(b.name),
    };
    return out.sort(by[sort]);
  }, [universe, themes, query, type, colors, themeId, sort, onlyPlayable]);

  const pages = Math.max(1, Math.ceil(results.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = results.slice(current * PAGE, current * PAGE + PAGE);
  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(0);
  };

  return (
    <div className="library">
      <div className="library-filters">
        <input value={text} onChange={(e) => reset(setText)(e.target.value)} placeholder="Search names, types and rules text…" aria-label="Search cards" />
        <select value={type} onChange={(e) => reset(setType)(e.target.value)} aria-label="Card type">
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select value={themeId} onChange={(e) => reset(setThemeId)(e.target.value)} aria-label="Theme or set">
          {['Universal', 'Franchises', 'Planes', 'Creature types', 'Play styles', 'Eras', 'Sets'].map((group) => (
            <optgroup key={group} label={group === 'Universal' ? 'Everything' : group}>
              {themes.filter((t) => t.group === group).map((t) => (
                <option key={t.id} value={t.id}>{t.id === 'universal' ? 'All cards' : t.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select value={sort} onChange={(e) => reset(setSort)(e.target.value as keyof typeof SORTS)} aria-label="Sort">
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div className="color-row">
          {[...COLORS, 'C' as const].map((c) => (
            <button
              key={c}
              type="button"
              className={`pill color-pill ${colors.includes(c) ? 'on' : ''}`}
              title={c === 'C' ? 'Colourless' : COLOR_NAMES[c]}
              aria-label={c === 'C' ? 'Colourless' : COLOR_NAMES[c]}
              onClick={() => reset(setColors)(colors.includes(c) ? colors.filter((x) => x !== c) : [...colors, c])}
            >
              <ManaCost cost={`{${c}}`} size={18} />
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={onlyPlayable} onChange={(e) => reset(setOnlyPlayable)(e.target.checked)} /> Only cards decks can use
        </label>
      </div>
      <div className="library-count muted small">
        {results.length.toLocaleString()} of {universe.cards.length.toLocaleString()} cards
        {pages > 1 && <> · page {current + 1} of {pages}</>}
      </div>
      <div className="card-grid">
        {shown.map((c) => {
          const p = playability(c);
          const usable = deckable(c);
          return (
            <div key={c.id} className="grid-card" onMouseEnter={() => hover({ card: c })}>
              <CardFace card={c} />
              {!c.supertypes.includes('Basic') && <GradeBadge card={c} />}
              <span className={`sim-badge ${usable ? p : 'none'}`} title={usable ? (p === 'full' ? 'Fully simulated' : 'Partly simulated') : 'Not used in generated decks'}>
                {usable ? (p === 'full' ? '✓' : '◐') : '–'}
              </span>
            </div>
          );
        })}
      </div>
      {pages > 1 && (
        <div className="pager">
          <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>‹ Previous</button>
          <span className="muted small">{current + 1} / {pages}</span>
          <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next ›</button>
        </div>
      )}
    </div>
  );
}
