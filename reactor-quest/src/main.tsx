import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { isNativeApp, isTouch, keyboardInset } from './ui/device';
import { initTheme } from './ui/themes';

// Paint the remembered colour profile before the first render, so it never flashes.
initTheme();

// Phones: keep the game exactly the size of what's visible. When the keyboard
// opens, iOS shrinks only the *visual* viewport; tracking it keeps the editor,
// the coding keys and the Run button above the keyboard instead of under it.
document.documentElement.classList.toggle('touch', isTouch());
if (isTouch() && window.visualViewport) {
  const vv = window.visualViewport;
  const root = document.documentElement;
  const fit = () => {
    root.style.setProperty('--vvh', `${vv.height}px`);
    root.style.setProperty('--vvt', `${vv.offsetTop}px`);
    root.toggleAttribute('data-keyboard', keyboardInset() > 120);
  };
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', fit);
  window.addEventListener('resize', fit);
  fit();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// When the game is served by one of its app launchers, let the server know a tab
// is still open; it shuts itself down a minute after the last one closes.
// Anywhere else (the dev server, a static host) the first ping fails and stops.
function heartbeat() {
  fetch('./__heartbeat', { method: 'POST' })
    .then((r) => r.ok && setTimeout(heartbeat, 15_000))
    .catch(() => {});
}
heartbeat();

// Offline play: cache this build with the service worker (tools/pwa.mjs writes
// it). The native apps carry their files with them and don't need one.
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext && !isNativeApp()) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
