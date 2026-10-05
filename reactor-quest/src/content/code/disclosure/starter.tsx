import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

// The incident panel opens when you click its title… with a mouse. With a
// keyboard you can't even reach it: a <div> with onClick isn't focusable, and a
// screen reader has no idea it does anything.
//
// Make it a proper "disclosure" widget:
//   1. The toggle is a real <button>. Buttons are focusable, and Enter and
//      Space press them, for free.
//   2. The button says whether it's open, and what it opens:
//        aria-expanded={open}   aria-controls="details-panel"
//   3. The panel is  <div id="details-panel">…</div>, shown only while open.
//   4. Pressing Escape (on the button, or anywhere inside the panel) closes it
//      and puts keyboard focus back on the button.

export function Details({ summary, children }: { summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="details">
      <div className="summary" onClick={() => setOpen(!open)}>
        {summary}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}
