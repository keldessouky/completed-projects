// The 🎨 button at the top right: pick one of the colour profiles. Hovering or
// arrowing through the list previews a profile live; clicking (or Return)
// keeps it; Escape or clicking away puts the old one back.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { sfx } from '../game/sound';
import { paintTheme, setTheme, THEMES, useTheme, type Theme } from './themes';

function Swatch({ theme }: { theme: Theme }) {
  const p = theme.palette;
  const s = p.syntax;
  return (
    <span className="swatch" style={{ background: p.editor }} aria-hidden>
      <span className="bar-row">
        <i style={{ background: s.keyword, width: 14 }} />
        <i style={{ background: s.fn, width: 22 }} />
      </span>
      <span className="bar-row">
        <i style={{ background: s.variable, width: 10, marginLeft: 6 }} />
        <i style={{ background: s.string, width: 26 }} />
      </span>
      <span className="bar-row">
        <i style={{ background: s.type, width: 18, marginLeft: 6 }} />
        <i style={{ background: s.number, width: 8 }} />
      </span>
      <i style={{ background: p.accent, width: '100%', marginTop: 'auto' }} />
    </span>
  );
}

export function ThemePicker() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);

  const close = (refocus: boolean) => {
    paintTheme(theme.id); // drop any preview
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    options.current[THEMES.findIndex((t) => t.id === theme.id)]?.focus();
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!root.current?.contains(t) && !menu.current?.contains(t)) close(false);
    };
    const resized = () => close(false);
    document.addEventListener('pointerdown', away);
    window.addEventListener('resize', resized);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('resize', resized);
    };
  }, [open]);

  const choose = (t: Theme) => {
    sfx.click();
    setTheme(t.id);
    setOpen(false);
    button.current?.focus();
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    const step = { ArrowDown: 2, ArrowUp: -2, ArrowRight: 1, ArrowLeft: -1, Home: -i, End: THEMES.length - 1 - i }[e.key];
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (step !== undefined) {
      e.preventDefault();
      options.current[Math.min(THEMES.length - 1, Math.max(0, i + step))]?.focus();
    }
  };

  return (
    <div className="theme-picker" ref={root}>
      <button
        ref={button}
        className="icon-btn theme-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Colour profile: ${theme.name}`}
        title={`Colour profile: ${theme.name}`}
        onClick={() => {
          if (open) return close(false);
          // The menu lives above everything (THE FEED's cards included), anchored under this button.
          const r = button.current!.getBoundingClientRect();
          const width = Math.min(560, window.innerWidth - 24); // matches .theme-menu's width
          setPlace({ top: r.bottom + 8, left: Math.min(Math.max(12, r.right - width), window.innerWidth - 12 - width) });
          setOpen(true);
        }}
      >
        <span aria-hidden>🎨</span>
        <span className="dots" aria-hidden>
          {[theme.palette.accent, theme.palette.gold, theme.palette.violet].map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
        </span>
      </button>
      {open &&
        createPortal(
          <div ref={menu} className="theme-menu" style={place} role="dialog" aria-label="Colour profiles" onMouseLeave={() => paintTheme(theme.id)}>
            <header>
              <b>Colour profile</b>
              <span className="muted small">Hover to preview · click to keep</span>
            </header>
            <ul className="theme-grid" role="radiogroup" aria-label="Colour profiles">
              {THEMES.map((t, i) => (
                <li key={t.id}>
                  <button
                    ref={(el) => {
                      options.current[i] = el;
                    }}
                    role="radio"
                    aria-checked={t.id === theme.id}
                    className="theme-option"
                    title={t.blurb}
                    onMouseEnter={() => paintTheme(t.id)}
                    onFocus={() => paintTheme(t.id)}
                    onClick={() => choose(t)}
                    onKeyDown={(e) => onKey(e, i)}
                  >
                    <Swatch theme={t} />
                    <span>
                      <span className="name">
                        {t.name}
                        {t.id === theme.id && <span className="check">✓</span>}
                      </span>
                      <span className="from">{t.from === 'Reactor' ? 'The original' : t.from}{t.scheme === 'light' ? ' · light' : ''}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
