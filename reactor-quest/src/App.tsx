import { useEffect } from 'react';
import { findLevel } from './content';
import { warmUp } from './engine/compiler';
import { isUnlocked } from './game/progress';
import { onRewards, useSave } from './game/store';
import { ArcadeScreen } from './screens/ArcadeScreen';
import { CharacterScreen } from './screens/CharacterScreen';
import { CodeLevelScreen } from './screens/CodeLevelScreen';
import { LootScreen } from './screens/LootScreen';
import { MapScreen } from './screens/MapScreen';
import { QuizScreen } from './screens/QuizScreen';
import { ShopScreen } from './screens/ShopScreen';
import { TitleScreen } from './screens/TitleScreen';
import { Announcer } from './ui/Announcer';
import { BoxOpener } from './ui/BoxOpener';
import { Companion } from './ui/Companion';
import { Hud } from './ui/Hud';
import { Offers } from './ui/Offers';
import { overlays } from './ui/overlays';
import { go, useRoute } from './ui/router';

export function App() {
  const route = useRoute();
  const save = useSave();

  useEffect(() => warmUp(), []);
  // Class and pet offers wait for the victory screen to close.
  useEffect(
    () =>
      onRewards((events) => {
        for (const e of events) if (e.kind === 'offer') overlays.queueOffer(e.what);
      }),
    [],
  );

  let screen;
  switch (route.name) {
    case 'title':
      screen = <TitleScreen />;
      break;
    case 'map':
      screen = <MapScreen />;
      break;
    case 'arcade':
      screen = <ArcadeScreen />;
      break;
    case 'loot':
      screen = <LootScreen tab={route.tab} />;
      break;
    case 'shop':
      screen = <ShopScreen />;
      break;
    case 'character':
      screen = <CharacterScreen tab={route.tab} />;
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

  return (
    <div className={`app ${save.equipped.theme}`}>
      {route.name !== 'title' && <Hud route={route} />}
      <main className={route.name === 'title' ? 'title-main' : ''}>{screen}</main>
      <Announcer />
      <BoxOpener />
      <Offers />
      <Companion />
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
      <p>Restore the systems before it first. Or beat the floor's boss to skip ahead, or open everything from Character → Settings.</p>
      <button className="btn primary" onClick={() => go('/map')}>Back to the map</button>
    </div>
  );
}
