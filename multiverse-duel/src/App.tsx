import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadUniverse, type Universe } from './data/cards';
import { buildThemes, type Theme } from './data/themes';
import { deckable, type Deck } from './game/deck';
import { Board } from './ui/Board';
import { HowToPlay } from './ui/HowToPlay';
import { HoverContext, Inspector, type Hovered } from './ui/Inspector';
import { Library } from './ui/Library';
import { Setup } from './ui/Setup';

type Screen = 'setup' | 'game' | 'library';

function useUniverse() {
  const [state, setState] = useState<{ u: Universe | null; error: string | null; progress: string }>({ u: null, error: null, progress: 'Loading the card database…' });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await loadUniverse();
        // Read every card's rules text once, in slices, so the page stays responsive.
        for (let i = 0; i < u.cards.length; i += 1500) {
          if (cancelled) return;
          for (const c of u.cards.slice(i, i + 1500)) deckable(c);
          setState({ u: null, error: null, progress: `Reading rules text… ${Math.min(i + 1500, u.cards.length).toLocaleString()} / ${u.cards.length.toLocaleString()} cards` });
          await new Promise((r) => setTimeout(r, 0));
        }
        if (!cancelled) setState({ u, error: null, progress: '' });
      } catch (e) {
        if (!cancelled) setState({ u: null, error: e instanceof Error ? e.message : String(e), progress: '' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export function App() {
  const { u, error, progress } = useUniverse();
  const themes = useMemo<Theme[]>(() => (u ? buildThemes(u) : []), [u]);
  const [screen, setScreen] = useState<Screen>('setup');
  const [decks, setDecks] = useState<[Deck, Deck] | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [help, setHelp] = useState(false);
  const setName = useCallback((code: string) => u?.setsByCode.get(code)?.n ?? code.toUpperCase(), [u]);

  if (error) {
    return (
      <div className="splash">
        <h1>Multiverse Duel</h1>
        <p className="error">{error}</p>
        <p>Run <code>npm run cards:update</code> to download the card database, then reload.</p>
      </div>
    );
  }
  if (!u) {
    return (
      <div className="splash">
        <h1>Multiverse Duel</h1>
        <p>{progress}</p>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <HoverContext.Provider value={setHovered}>
      <div className={`app screen-${screen}`}>
        <header className="topbar">
          <button type="button" className="brand" onClick={() => setScreen('setup')}>
            Multiverse Duel
          </button>
          <nav>
            <button type="button" className={screen === 'setup' ? 'active' : ''} onClick={() => setScreen('setup')}>Decks</button>
            <button type="button" className={screen === 'game' ? 'active' : ''} disabled={!decks} onClick={() => setScreen('game')}>Duel</button>
            <button type="button" className={screen === 'library' ? 'active' : ''} onClick={() => setScreen('library')}>Card library</button>
            <button type="button" onClick={() => setHelp(true)}>How to play</button>
          </nav>
          <span className="muted small">
            {u.cards.length.toLocaleString()} cards · {u.sets.length} sets · data {u.generated}
          </span>
        </header>
        <div className="layout">
          <main className="main">
            {screen === 'setup' && (
              <Setup
                universe={u}
                themes={themes}
                onStart={(d) => {
                  setDecks(d);
                  setGameKey((k) => k + 1);
                  setScreen('game');
                }}
              />
            )}
            {screen === 'game' && decks && (
              <Board key={gameKey} decks={decks} onRematch={() => setGameKey((k) => k + 1)} onNewDecks={() => setScreen('setup')} onHelp={() => setHelp(true)} />
            )}
            {screen === 'library' && <Library universe={u} themes={themes} />}
          </main>
          <aside className="sidebar">
            <Inspector hovered={hovered} setName={setName} />
          </aside>
        </div>
        {help && <HowToPlay onClose={() => setHelp(false)} />}
      </div>
    </HoverContext.Provider>
  );
}
