// Choose a deck for each side: Universal (the whole multiverse) or a theme.
import { useEffect, useMemo, useState } from 'react';
import { COLORS, COLOR_NAMES, type Card, type Color, type Universe } from '../data/cards';
import { searchTheme, UNIVERSAL, type Theme, type ThemeGroup } from '../data/themes';
import { buildDeck, type Deck } from '../game/deck';
import { ManaCost } from './CardFace';
import { useHover } from './Inspector';

interface Choice {
  themeId: string;
  colors: 'auto' | Color[];
  seed: number;
}

const STORAGE_KEY = 'multiverse-duel:setup';
const GROUPS: ThemeGroup[] = ['Franchises', 'Planes', 'Creature types', 'Play styles', 'Eras', 'Sets', 'Search'];
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

function loadChoices(): [Choice, Choice] {
  const fallback: [Choice, Choice] = [
    { themeId: 'universal', colors: 'auto', seed: newSeed() },
    { themeId: 'universal', colors: 'auto', seed: newSeed() },
  ];
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as [Choice, Choice] | null;
    if (Array.isArray(saved) && saved.length === 2) return saved.map((c) => ({ ...c, seed: newSeed() })) as [Choice, Choice];
  } catch {
    /* private mode or bad data: use defaults */
  }
  return fallback;
}

function resolveTheme(themes: Theme[], id: string): Theme {
  if (id.startsWith('q-')) return searchTheme(id.slice(2));
  return themes.find((t) => t.id === id) ?? UNIVERSAL;
}

export function Setup({ universe, themes, onStart }: { universe: Universe; themes: Theme[]; onStart: (decks: [Deck, Deck]) => void }) {
  const [choices, setChoices] = useState<[Choice, Choice]>(loadChoices);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
    } catch {
      /* ignore */
    }
  }, [choices]);
  const decks = useMemo(
    () => choices.map((c) => buildDeck(universe.cards, resolveTheme(themes, c.themeId), { colors: c.colors, seed: c.seed })) as [Deck, Deck],
    [choices, universe, themes],
  );
  const update = (i: 0 | 1, patch: Partial<Choice>) =>
    setChoices((cs) => {
      const next = [...cs] as [Choice, Choice];
      next[i] = { ...cs[i], seed: newSeed(), ...patch };
      return next;
    });

  return (
    <div className="setup">
      <div className="setup-intro">
        <div>
          <h1>Build your duel</h1>
          <p className="muted">
            Every deck is 40 cards — 23 spells and 17 basic lands — drawn from {universe.cards.length.toLocaleString()} real Magic cards.
            Play <strong>Universal</strong> for a deck from the whole multiverse, or pick a franchise, plane, creature type, play style, era or single set.
          </p>
        </div>
        <button type="button" className="primary big" onClick={() => onStart(decks)}>
          Start duel ▸
        </button>
      </div>
      <div className="pickers">
        {([0, 1] as const).map((i) => (
          <DeckPicker
            key={i}
            label={i === 0 ? 'Your deck' : 'Opponent’s deck'}
            themes={themes}
            choice={choices[i]}
            deck={decks[i]}
            onChange={(patch) => update(i, patch)}
          />
        ))}
      </div>
    </div>
  );
}

function DeckPicker({ label, themes, choice, deck, onChange }: { label: string; themes: Theme[]; choice: Choice; deck: Deck; onChange: (p: Partial<Choice>) => void }) {
  const current = resolveTheme(themes, choice.themeId);
  const [group, setGroup] = useState<ThemeGroup>(current.group === 'Universal' ? 'Franchises' : current.group);
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState(current.group === 'Search' ? choice.themeId.slice(2) : '');
  const universal = current.id === 'universal';
  const list = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return themes.filter((t) => t.group === group && (!f || `${t.name} ${t.blurb}`.toLowerCase().includes(f)));
  }, [themes, group, filter]);

  const toggleColor = (c: Color) => {
    const now = choice.colors === 'auto' ? [] : choice.colors;
    const next = now.includes(c) ? now.filter((x) => x !== c) : [...now, c];
    onChange({ colors: next.length ? next : 'auto' });
  };

  return (
    <section className="picker">
      <div className="picker-head">
        <h2>{label}</h2>
        <div className="segmented" role="tablist">
          <button type="button" role="tab" aria-selected={universal} className={universal ? 'on' : ''} onClick={() => onChange({ themeId: 'universal' })}>
            Universal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!universal}
            className={!universal ? 'on' : ''}
            onClick={() => !universal || onChange({ themeId: list[0]?.id ?? themes.find((t) => t.group === 'Franchises')!.id })}
          >
            Themed
          </button>
        </div>
      </div>

      {universal ? (
        <p className="universal-note">
          <strong>Universal mode.</strong> {UNIVERSAL.blurb} Colours are random unless you pick them below.
        </p>
      ) : (
        <div className="theme-chooser">
          <div className="tabs">
            {GROUPS.map((g) => (
              <button key={g} type="button" className={g === group ? 'on' : ''} onClick={() => setGroup(g)}>
                {g}
              </button>
            ))}
          </div>
          {group === 'Search' ? (
            <form
              className="search-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) onChange({ themeId: `q-${query.trim()}` });
              }}
            >
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. dragon, hobbit, sliver, flying knight…" aria-label="Search words" />
              <button type="submit">Use</button>
            </form>
          ) : (
            <>
              <input className="filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Filter ${group.toLowerCase()}…`} aria-label="Filter themes" />
              <div className="theme-list">
                {list.map((t) => (
                  <button key={t.id} type="button" className={`theme ${t.id === current.id ? 'on' : ''}`} onClick={() => onChange({ themeId: t.id })}>
                    <span className="theme-name">{t.name}</span>
                    <span className="theme-blurb">{t.blurb}</span>
                  </button>
                ))}
                {!list.length && <p className="muted small">Nothing matches.</p>}
              </div>
            </>
          )}
        </div>
      )}

      <div className="color-row">
        <span className="muted small">Colours</span>
        <button type="button" className={`pill ${choice.colors === 'auto' ? 'on' : ''}`} onClick={() => onChange({ colors: 'auto' })}>
          Auto
        </button>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`pill color-pill ${choice.colors !== 'auto' && choice.colors.includes(c) ? 'on' : ''}`}
            onClick={() => toggleColor(c)}
            title={COLOR_NAMES[c]}
            aria-label={COLOR_NAMES[c]}
          >
            <ManaCost cost={`{${c}}`} size={18} />
          </button>
        ))}
        <button type="button" className="pill" onClick={() => onChange({})} title="Build a different deck from the same choices">
          ↻ Reroll
        </button>
      </div>

      <DeckList deck={deck} />
    </section>
  );
}

function DeckList({ deck }: { deck: Deck }) {
  const hover = useHover();
  const groups = useMemo(() => {
    const count = new Map<Card, number>();
    for (const c of deck.cards) count.set(c, (count.get(c) ?? 0) + 1);
    const rows = [...count.entries()];
    return [
      ['Creatures', rows.filter(([c]) => c.types.includes('Creature'))],
      ['Spells & permanents', rows.filter(([c]) => !c.types.includes('Creature') && !c.types.includes('Land'))],
      ['Lands', rows.filter(([c]) => c.types.includes('Land'))],
    ] as const;
  }, [deck]);
  const curve = useMemo(() => {
    const bins = [0, 0, 0, 0, 0, 0, 0];
    for (const c of deck.cards) if (!c.types.includes('Land')) bins[Math.min(6, c.cmc)]++;
    return bins;
  }, [deck]);
  const filler = deck.cards.filter((c) => !c.types.includes('Land') && !deck.themed.has(c)).length;
  const max = Math.max(...curve, 1);

  return (
    <div className="decklist">
      <div className="deck-title">
        <strong>{deck.name}</strong>
        <span className="muted small">
          {deck.poolSize.toLocaleString()} playable cards in this theme{filler ? ` · ${filler} filler from the wider multiverse` : ''}
        </span>
      </div>
      <div className="curve" aria-label="Mana curve">
        {curve.map((n, i) => (
          <div key={i} className="curve-col" title={`${n} card${n === 1 ? '' : 's'} at mana value ${i}${i === 6 ? '+' : ''}`}>
            <div className="curve-bar" style={{ height: `${(n / max) * 100}%` }} />
            <span>{i === 6 ? '6+' : i}</span>
          </div>
        ))}
      </div>
      <div className="deck-groups">
        {groups.map(([name, rows]) => (
          <div key={name} className="deck-group">
            <h3>
              {name} <span className="muted">({rows.reduce((n, [, k]) => n + k, 0)})</span>
            </h3>
            {rows.map(([c, n]) => (
              <div key={c.id} className="deck-row" onMouseEnter={() => hover({ card: c })}>
                <span className="deck-count">{n}×</span>
                <span className="deck-name">{c.name}</span>
                {!c.types.includes('Land') && !deck.themed.has(c) && <span className="tag">filler</span>}
                <ManaCost cost={c.cost} size={13} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
