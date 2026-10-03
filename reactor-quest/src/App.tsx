import { useEffect, useState } from 'react';
import { findLevel } from './content';
import { warmUp } from './engine/compiler';
import { isUnlocked, rankOf, stationPower, type Achievement } from './game/progress';
import { sfx } from './game/sound';
import { onAchievement, setSave, useSave } from './game/store';
import { ArcadeScreen } from './screens/ArcadeScreen';
import { CodeLevelScreen } from './screens/CodeLevelScreen';
import { MapScreen } from './screens/MapScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { QuizScreen } from './screens/QuizScreen';
import { TitleScreen } from './screens/TitleScreen';
import { go, useRoute } from './ui/router';

export function App() {
  const route = useRoute();
  const save = useSave();
  const [toasts, setToasts] = useState<(Achievement & { key: number })[]>([]);

  useEffect(() => warmUp(), []);
  useEffect(
    () =>
      onAchievement((a) => {
        sfx.unlock();
        const key = Date.now() + Math.random();
        setToasts((t) => [...t, { ...a, key }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.key !== key)), 4500);
      }),
    [],
  );

  let screen;
  switch (route.name) {
    case 'title':
      return <TitleScreen />;
    case 'map':
      screen = <MapScreen />;
      break;
    case 'arcade':
      screen = <ArcadeScreen />;
      break;
    case 'profile':
      screen = <ProfileScreen />;
      break;
    case 'level': {
      const found = findLevel(route.id);
      if (!found) screen = <NotFound />;
      else if (!isUnlocked(save, route.id)) screen = <Locked />;
      else
        screen =
          found.level.kind === 'code' ? (
            <CodeLevelScreen key={found.level.id} level={found.level} deck={found.deck} index={found.index} />
          ) : (
            <QuizScreen key={found.level.id} level={found.level} deck={found.deck} index={found.index} />
          );
      break;
    }
  }

  const rank = rankOf(save.xp);
  const power = stationPower(save);
  return (
    <div className="app">
      <header className="hud">
        <button className="brand" onClick={() => go('/')} aria-label="Title screen">
          RE<span>ACT</span>OR
        </button>
        <nav>
          <button className={route.name === 'map' ? 'active' : ''} onClick={() => go('/map')}>Map</button>
          <button className={route.name === 'arcade' ? 'active' : ''} onClick={() => go('/arcade')}>Arcade</button>
          <button className={route.name === 'profile' ? 'active' : ''} onClick={() => go('/profile')}>Profile</button>
        </nav>
        <span className="spacer" />
        <div className="meter" title={`Station power ${power}%`}>
          <span className="meter-label">Power</span>
          <div className="bar"><div style={{ width: `${power}%` }} /></div>
          <span>{power}%</span>
        </div>
        <div className="meter rank" title={`${save.xp} XP`}>
          <span className="meter-label">{rank.name}</span>
          <div className="bar xp"><div style={{ width: `${Math.round(rank.progress * 100)}%` }} /></div>
          <span>{save.xp} XP</span>
        </div>
        <button className="icon-btn" onClick={() => setSave((s) => ({ ...s, sound: !s.sound }))} aria-label={save.sound ? 'Mute sound' : 'Unmute sound'}>
          {save.sound ? '🔊' : '🔈'}
        </button>
      </header>
      <main>{screen}</main>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.key} className="toast">
            <span className="icon">{t.icon}</span>
            <div>
              <span className="kicker">Achievement unlocked</span>
              <b>{t.name}</b>
              <span className="muted small">{t.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="panel center-msg">
      <h2>No such system</h2>
      <button className="btn primary" onClick={() => go('/map')}>Back to the map</button>
    </div>
  );
}

function Locked() {
  return (
    <div className="panel center-msg">
      <h2>🔒 This system is still dark</h2>
      <p>Restore the systems before it first — or open everything from Profile → Settings.</p>
      <button className="btn primary" onClick={() => go('/map')}>Back to the map</button>
    </div>
  );
}
