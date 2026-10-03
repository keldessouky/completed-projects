import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// When the game is served by its macOS launcher, let the launcher know a tab
// is still open; it shuts itself down a minute after the last one closes.
// Anywhere else (the dev server, a static host) the first ping fails and stops.
function heartbeat() {
  fetch('./__heartbeat', { method: 'POST' })
    .then((r) => r.ok && setTimeout(heartbeat, 15_000))
    .catch(() => {});
}
heartbeat();
