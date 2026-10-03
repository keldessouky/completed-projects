import { ALL_LEVELS } from '../content';
import { isUnlocked, levelState, stationPower } from '../game/progress';
import { sfx } from '../game/sound';
import { useSave } from '../game/store';
import { go } from '../ui/router';

export function TitleScreen() {
  const save = useSave();
  const power = stationPower(save);
  const started = Object.keys(save.levels).length > 0;
  const nextUp = ALL_LEVELS.find((l) => isUnlocked(save, l.id) && !levelState(save, l.id).done);

  return (
    <div className="title-screen">
      <div className="core" style={{ ['--power' as string]: Math.max(0.08, power / 100) }} aria-hidden>
        <div className="ring r1" />
        <div className="ring r2" />
        <div className="ring r3" />
        <div className="nucleus" />
      </div>
      <h1 className="logo">
        RE<span>ACT</span>OR
      </h1>
      <p className="tagline">A TypeScript &amp; React quest</p>
      <p className="intro">
        Orrery Station has been dark for nine days. Its every system is written in TypeScript and React — and the compiler refuses to bring any of
        them back online until they're right. Write real code, in a real editor, checked by the real TypeScript compiler. Restore the station one
        system at a time.
      </p>
      <div className="title-actions">
        <button
          className="btn primary big"
          onClick={() => {
            sfx.unlock();
            go(started && nextUp ? `/level/${nextUp.id}` : started ? '/map' : `/level/${ALL_LEVELS[0].id}`);
          }}
        >
          {started ? (nextUp ? 'Continue' : 'Return to the station') : 'Begin'}
        </button>
        <button className="btn big" onClick={() => go('/map')}>Station map</button>
        <button className="btn big" onClick={() => go('/arcade')}>Compiler Says <span className="muted">arcade</span></button>
      </div>
      <p className="power-readout">
        Station power <b>{power}%</b>
      </p>
    </div>
  );
}
