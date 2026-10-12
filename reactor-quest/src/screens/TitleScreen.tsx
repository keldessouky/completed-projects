import { pathById, pathLevels } from '../content';
import { crawlerLevel, isUnlocked, levelState, stationPower } from '../game/progress';
import { readiness } from '../game/readiness';
import { dayOf, dueReviews, formatViewers } from '../game/rewards';
import { sfx } from '../game/sound';
import { useSave } from '../game/store';
import { overlays } from '../ui/overlays';
import { PathPicker } from '../ui/PathPicker';
import { go } from '../ui/router';

export function TitleScreen() {
  const save = useSave();
  const path = pathById(save.path);
  const levels = pathLevels(path);
  const power = stationPower(save);
  const started = levels.some((l) => save.levels[l.id]);
  const nextUp = levels.find((l) => isUnlocked(save, l.id) && !levelState(save, l.id).done);
  const due = dueReviews(save, dayOf(new Date())).length;
  const cert = path.exam ? readiness(save, path) : null;

  return (
    <div className="title-screen">
      <div className="core" style={{ ['--power' as string]: Math.max(0.08, cert ? cert.percent / 100 : power / 100) }} aria-hidden>
        <div className="ring r1" />
        <div className="ring r2" />
        <div className="ring r3" />
        <div className="nucleus" />
      </div>
      <h1 className="logo">
        RE<span>ACT</span>OR
      </h1>
      <p className="tagline">{cert ? `AWS certification prep · ${cert.exam.code}` : 'A TypeScript & React quest'}</p>
      {cert ? (
        <p className="intro">
          Orrery Station's ground control runs on AWS, and nobody down there is certified. Start from zero: what the cloud even is. Each floor of
          lessons covers one domain of the <b>{path.name}</b> exam, then practise with exam-style questions and timed mock exams. The game keeps track
          of every answer and tells you how ready you are to pass.
        </p>
      ) : (
        <p className="intro">
          Orrery Station has been dark for nine days. Every system aboard runs on code, and none of it works. You've never written a line of code?
          Perfect. Start from your very first <code>console.log</code> and climb ten floors, all the way to professional TypeScript and React.
          Real code, a real editor, the real compiler.
        </p>
      )}
      <p className="intro feed-intro">
        <b>THE FEED:</b> <i>And it's all being broadcast LIVE to four billion viewers. Loot boxes! Achievements! Sponsors! Bosses! Welcome to Repair Crew LIVE.</i>
      </p>
      <PathPicker />
      <div className="title-actions">
        <button
          className="btn primary big"
          onClick={() => {
            sfx.unlock();
            if (!save.name) overlays.offer('name');
            go(started && nextUp ? `/level/${nextUp.id}` : started ? '/map' : `/level/${levels[0].id}`);
          }}
        >
          {started ? (nextUp ? 'Continue' : cert ? 'Back to the lessons' : 'Return to the station') : 'Begin'}
        </button>
        <button className="btn big" onClick={() => go('/map')}>{cert ? 'Lessons map' : 'Station map'}</button>
        {cert && (
          <button className="btn big" onClick={() => go('/exam')}>
            Exam prep <span className="muted">{cert.percent}% ready</span>
          </button>
        )}
        {due > 0 && (
          <button className="btn big" onClick={() => go('/review')}>
            Review <span className="muted">{due} due</span>
          </button>
        )}
      </div>
      <p className="power-readout">
        {cert ? (
          <>
            {cert.exam.code} readiness <b>{cert.percent}%</b>
          </>
        ) : (
          <>
            Station power <b>{power}%</b>
          </>
        )}
        {(started || Object.keys(save.levels).length > 0) && (
          <>
            {' '}· {save.name || 'Engineer'}, crawler level <b>{crawlerLevel(save.xp).level}</b> · 👁 <b>{formatViewers(save.viewers)}</b> viewers
          </>
        )}
      </p>
    </div>
  );
}
