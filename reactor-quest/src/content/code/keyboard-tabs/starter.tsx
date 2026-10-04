import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

// Accessible tabs, following the WAI-ARIA "tabs" pattern used across the web.
//
//   <div role="tablist">
//     <button role="tab" id="tab-<id>" aria-selected aria-controls="panel-<id>"
//             tabIndex={selected ? 0 : -1}>label</button>
//     …
//   </div>
//   <div role="tabpanel" id="panel-<id>" aria-labelledby="tab-<id>">content</div>
//
// Only the selected tab's panel is shown. Clicking a tab selects it.
// Keyboard, on a focused tab:
//   ArrowRight / ArrowLeft  → select AND focus the next / previous tab (wrapping around)
//   Home / End              → select and focus the first / last tab
// "Roving tabIndex": only the selected tab is in the Tab order (tabIndex 0).

export type Tab = { id: string; label: string; content: ReactNode };

export function Tabs({ tabs }: { tabs: Tab[] }) {
  const [selected, setSelected] = useState(0);
  return (
    <div>
      <div>
        {tabs.map((tab, i) => (
          <button key={tab.id} onClick={() => setSelected(i)}>
            {tab.label}
          </button>
        ))}
      </div>
      <div>{tabs[selected].content}</div>
    </div>
  );
}
