// The row of coding keys that sits on top of a phone's keyboard. Phone
// keyboards bury { } ( ) < > = ; behind two layers of shift keys; this puts
// them (and Tab, undo and the arrow keys) one tap away. Brackets and quotes
// close themselves, just as they do when typed.
import { insertBracket } from '@codemirror/autocomplete';
import { cursorCharLeft, cursorCharRight, indentMore, redo, undo } from '@codemirror/commands';
import type { EditorView } from '@codemirror/view';

type Key = { label: string; aria?: string; insert?: string; run?: (v: EditorView) => boolean; wide?: boolean };

const KEYS: Key[] = [
  { label: '⇥', aria: 'Indent', run: indentMore },
  ...['{', '}', '(', ')', '[', ']', '<', '>', '=', ';', ':', '.', ',', '"', "'", '`', '=>', '!', '?', '&&', '||', '+', '-', '*', '/', '_'].map((t) => ({ label: t, insert: t, wide: t.length > 1 })),
  { label: '←', aria: 'Cursor left', run: cursorCharLeft },
  { label: '→', aria: 'Cursor right', run: cursorCharRight },
  { label: '↶', aria: 'Undo', run: undo },
  { label: '↷', aria: 'Redo', run: redo },
];

function press(view: EditorView, key: Key) {
  if (key.run) key.run(view);
  else if (key.insert) {
    // Opening brackets and quotes get their partner, like the keyboard does.
    const bracket = key.insert.length === 1 ? insertBracket(view.state, key.insert) : null;
    view.dispatch(bracket ?? view.state.update(view.state.replaceSelection(key.insert), { scrollIntoView: true, userEvent: 'input.type' }));
  }
}

export function KeyBar({ view, onDone }: { view: EditorView | null; onDone(): void }) {
  if (!view) return null;
  return (
    <div className="keybar" role="toolbar" aria-label="Coding keys">
      <div className="keybar-keys">
        {KEYS.map((k) => (
          <button
            key={k.label}
            className={`key ${k.wide ? 'wide' : ''}`}
            aria-label={k.aria ?? k.label}
            tabIndex={-1}
            // Don't take focus from the editor (that would close the keyboard). Only
            // the mouse-compatibility event is cancelled: cancelling the pointer or
            // touch event would make iPhone Safari swallow the tap (and the bar's scroll).
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              press(view, k);
              view.focus();
            }}
          >
            {k.label}
          </button>
        ))}
      </div>
      <button className="key done" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={onDone} aria-label="Hide keyboard">
        ⌄
      </button>
    </div>
  );
}
