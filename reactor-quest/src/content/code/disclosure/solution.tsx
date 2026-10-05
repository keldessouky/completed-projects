import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export function Details({ summary, children }: { summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      setOpen(false);
      button.current?.focus();
    }
  }

  return (
    <div className="details" onKeyDown={onKeyDown}>
      <button ref={button} aria-expanded={open} aria-controls="details-panel" onClick={() => setOpen(!open)}>
        {summary}
      </button>
      {open && <div id="details-panel">{children}</div>}
    </div>
  );
}
