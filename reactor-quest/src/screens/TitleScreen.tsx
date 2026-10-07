import { ALL_LEVELS } from '../content';
import { crawlerLevel, isUnlocked, levelState, stationPower } from '../game/progress';
import { dayOf, dueReviews, formatViewers } from '../game/rewards';
import { sfx } from '../game/sound';
import { useSave } from '../game/store';
import { overlays } from '../ui/overlays';
import { go } from '../ui/router';

export function TitleScreen() {
  const save = useSave();
  const power = stationPower(save);
  const started = Object.keys(save.levels).length > 0;
  const nextUp = ALL_LEVELS.find((l) => isUnlocked(save, l.id) && !levelState(save, l.id).done);
  const due = dueReviews(save, dayOf(new Date())).length;

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
        Orrery Station has been dark for nine days. Every system aboard runs on code, and none of it works. You've never written a line of code?
        Perfect. Start from your very first <code>console.log</code> and climb ten floors, all the way to professional TypeScript and React.
        Real code, a real editor, the real compiler.
      </p>
      <p className="intro feed-intro">
        <b>THE FEED:</b> <i>And it's all being broadcast LIVE to four billion viewers. Loot boxes! Achievements! Sponsors! Bosses! Welcome to Repair Crew LIVE.</i>
      </p>
      <div className="title-actions">
        <button
          className="btn primary big"
          onClick={() => {
            sfx.unlock();
            if (!save.name) overlays.offer('name');
            go(started && nextUp ? `/level/${nextUp.id}` : started ? '/map' : `/level/${ALL_LEVELS[0].id}`);
          }}
        >
          {started ? (nextUp ? 'Continue' : 'Return to the station') : 'Begin'}
        </button>
        <button className="btn big" onClick={() => go('/map')}>Station map</button>
        {due > 0 && (
          <button className="btn big" onClick={() => go('/review')}>
            Review <span className="muted">{due} due</span>
          </button>
        )}
      </div>
      <p className="power-readout">
        Station power <b>{power}%</b>
        {started && (
          <>
            {' '}· {save.name || 'Engineer'}, crawler level <b>{crawlerLevel(save.xp).level}</b> · 👁 <b>{formatViewers(save.viewers)}</b> viewers
          </>
        )}
      </p>
    </div>
  );
}
