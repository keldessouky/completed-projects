import { item } from '../game/items';
import { crawlerLevel, stationPower } from '../game/progress';
import { classInfo, dayOf, dueReviews, formatViewers } from '../game/rewards';
import { setSave, useSave } from '../game/store';
import { overlays } from './overlays';
import { go, type Route } from './router';
import { ThemePicker } from './ThemePicker';

export function Hud({ route }: { route: Route }) {
  const save = useSave();
  const lvl = crawlerLevel(save.xp);
  const power = stationPower(save);
  const cls = classInfo(save.classId);
  const due = dueReviews(save, dayOf(new Date())).length;
  const nav: [Route['name'], string, string][] = [
    ['map', '/map', 'Map'],
    ['review', '/review', 'Review'],
    ['loot', '/loot', 'Loot'],
    ['shop', '/shop', 'Safe Room'],
    ['character', '/character', 'Character'],
  ];
  return (
    <header className="hud">
      <button className="brand" onClick={() => go('/')} aria-label="Title screen">
        RE<span>ACT</span>OR
      </button>
      <nav>
        {nav.map(([name, path, label]) => (
          <button key={name} className={route.name === name ? 'active' : ''} onClick={() => go(path)}>
            {label}
            {name === 'loot' && save.boxes.length > 0 && <span className="badge">{save.boxes.length}</span>}
            {name === 'review' && due > 0 && <span className="badge" title={`${due} card${due === 1 ? '' : 's'} due for review`}>{due}</span>}
          </button>
        ))}
      </nav>
      <span className="spacer" />
      <button className="crawler" onClick={() => go('/character')} title={`${save.xp} XP — ${lvl.toNext} to level ${lvl.level + 1}`}>
        <span className="lvl">Lv {lvl.level}</span>
        <span className="who">
          <b>{save.name || 'Engineer'}</b>
          <span className="muted small">{cls ? `${cls.icon} ` : ''}{lvl.title} · {item(save.equipped.title).name}</span>
        </span>
        <span className="bar xp" aria-label={`XP ${Math.round(lvl.progress * 100)}%`}><span style={{ width: `${Math.round(lvl.progress * 100)}%` }} /></span>
      </button>
      <div className="stats">
        <span title="Gold — spend it in the Safe Room">🪙 {save.gold}</span>
        <span title="Viewers watching THE FEED">👁 {formatViewers(save.viewers)}</span>
        <span title="Hint tokens — reveal a hint without losing a star">🎟 {save.hintTokens}</span>
        {save.boosts > 0 && <span title="XP boost: +50% on your next clears">🚀 {save.boosts}</span>}
        <button className="stat-btn" title="Open your boxes" onClick={() => (save.boxes.length ? overlays.openBoxes(save.boxes.map((b) => b.id)) : go('/loot'))}>
          🎁 {save.boxes.length}
        </button>
        <span className="power" title={`Station power ${power}%`}>⚡ {power}%</span>
      </div>
      <button className="icon-btn" onClick={() => setSave((s) => ({ ...s, sound: !s.sound }))} aria-label={save.sound ? 'Mute sound' : 'Unmute sound'}>
        {save.sound ? '🔊' : '🔈'}
      </button>
      <ThemePicker />
    </header>
  );
}
