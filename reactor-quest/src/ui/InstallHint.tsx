// On a phone's browser, tell people they can keep the game as an app: on an
// iPhone that's Share → Add to Home Screen (Safari has no install button); on
// Android, Chrome offers to install it, and the site may also carry the APK.
import { useEffect, useState } from 'react';
import { isApple, isStandalone, isTouch } from './device';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}

let deferred: InstallPrompt | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // we offer it ourselves, at a better moment
  deferred = e as InstallPrompt;
});

export function InstallHint() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(deferred);
  const [apk, setApk] = useState(false);
  const android = /Android/.test(navigator.userAgent);

  useEffect(() => {
    const onPrompt = () => setPrompt(deferred);
    window.addEventListener('beforeinstallprompt', onPrompt);
    if (android && !isStandalone()) {
      fetch('./Reactor-Quest.apk', { method: 'HEAD' })
        .then((r) => setApk(r.ok && !/text\/html/.test(r.headers.get('content-type') ?? '')))
        .catch(() => {});
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [android]);

  if (isStandalone() || !isTouch()) return null;
  if (isApple()) {
    return (
      <p className="install-hint">
        📲 <b>Play it like an app:</b> tap <span className="ios-share" aria-label="Share">Share</span> below, then <b>Add to Home Screen</b>. It works offline too.
      </p>
    );
  }
  if (!prompt && !apk) return null;
  return (
    <p className="install-hint">
      📲{' '}
      {prompt && (
        <button className="link" onClick={() => prompt.prompt().then(() => setPrompt(null), () => {})}>
          Install Reactor Quest as an app
        </button>
      )}
      {prompt && apk && ' · '}
      {apk && <a href="./Reactor-Quest.apk" download>{prompt ? 'or get the Android app (APK)' : 'Get the Android app (APK)'}</a>}
    </p>
  );
}
