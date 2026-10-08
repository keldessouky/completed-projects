// THE FEED's announcements: a stack of cards for everything the reward engine
// reports — achievements get the full treatment, smaller things a slim line.
import { useEffect, useRef, useState } from 'react';
import { TIER_INFO, formatViewers, type Reward } from '../game/rewards';
import { SKILLS, SKILL_RANKS } from '../game/skills';
import { sfx } from '../game/sound';
import { getSave, onRewards } from '../game/store';
import { overlays, useOverlays } from './overlays';
import { go } from './router';

interface Card {
  key: number;
  big: boolean;
  icon: string;
  kicker: string;
  title: string;
  body?: string;
  tone: string;
  action?: { label: string; run(): void };
  /** Set on the "You received" card, so a new one can absorb an older one. */
  boxIds?: string[];
}

let nextKey = 1;

function cardsFor(events: Reward[]): Card[] {
  const out: Card[] = [];
  // An achievement's own box rides on the achievement's card instead of getting a card of its own.
  const boxFor = new Map<string, string>();
  for (const e of events) if (e.kind === 'box' && e.box.source.startsWith('Achievement: ')) boxFor.set(e.box.source.slice('Achievement: '.length), e.box.id);
  const boxes = events.filter((e) => e.kind === 'box' && !(e.box.source.startsWith('Achievement: ') && events.some((a) => a.kind === 'achievement' && boxFor.get(a.achievement.name) === e.box.id)));
  for (const e of events) {
    const key = nextKey++;
    switch (e.kind) {
      case 'achievement': {
        const a = e.achievement;
        const box = boxFor.get(a.name);
        out.push({
          key,
          big: true,
          icon: a.icon,
          kicker: 'New achievement!',
          title: a.name,
          body: `${a.description} ${a.quip}${box ? ` +${TIER_INFO[a.tier].name} box` : ''}`,
          tone: TIER_INFO[a.tier].color,
          action: box ? { label: 'Open', run: () => overlays.openBoxes([box]) } : undefined,
        });
        break;
      }
      case 'level-up':
        out.push({ key, big: true, icon: '⬆', kicker: 'Level up!', title: `Crawler level ${e.level}`, body: e.newTitle ? `Promotion! You are now a ${e.title}.` : undefined, tone: '#4fd1ff' });
        break;
      case 'skill-up':
        out.push({ key, big: false, icon: SKILLS[e.skill].icon, kicker: 'Skill up', title: `${SKILLS[e.skill].name} is now level ${e.level}`, body: SKILL_RANKS[e.level], tone: '#b794f6' });
        break;
      case 'sponsor':
        out.push({ key, big: true, icon: e.sponsor.icon, kicker: `Sponsor gift · ${e.floor} cleared`, title: e.sponsor.name, body: e.sponsor.message, tone: '#9be6ff' });
        break;
      case 'fans':
        out.push({ key, big: true, icon: '👁', kicker: 'Viewer milestone!', title: `${formatViewers(e.milestone)} viewers`, body: 'Your fans pooled together and sent you a Fan Box.', tone: '#ff8ad8' });
        break;
      case 'streak':
        if (e.count > 1) out.push({ key, big: false, icon: '🔥', kicker: 'Streak', title: `${e.count} days in a row`, tone: '#ffb347' });
        break;
      case 'feed':
        out.push({ key, big: false, icon: '📺', kicker: 'THE FEED', title: e.text, tone: '#ffb347' });
        break;
    }
  }
  if (boxes.length) out.push(boxCard(boxes.map((b) => (b.kind === 'box' ? b.box.id : '')), boxes.length === 1 && boxes[0].kind === 'box' ? `${TIER_INFO[boxes[0].box.tier].name} box: ${boxes[0].box.source}` : undefined));
  return out;
}

function boxCard(ids: string[], label = `${ids.length} loot boxes`): Card {
  return { key: nextKey++, big: false, icon: '🎁', kicker: 'You received', title: label, tone: '#ffc94d', boxIds: ids, action: { label: 'Open', run: () => overlays.openBoxes(ids) } };
}

/** Fold box cards together: `into`'s boxes (if any) absorb `fresh`'s, keeping `into`'s key. */
function mergeBox(into: Card, fresh: Card): Card {
  const unopened = new Set(getSave().boxes.map((b) => b.id));
  const ids = [...new Set([...into.boxIds!, ...fresh.boxIds!])].filter((id) => unopened.has(id));
  return { ...boxCard(ids, ids.length === 1 ? fresh.title : undefined), key: into.key };
}

// One card at a time: news should be noticed, not pile up over the work.
const MAX_SHOWN = 1;
const MAX_WAITING = 12;

export function Announcer({ quiet }: { quiet?: boolean }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [queued, setQueued] = useState(0);
  const dismissRef = useRef<(key: number) => void>(() => {});
  const { focus } = useOverlays();
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const syncRef = useRef<() => void>(() => {});
  // While the player is working on a level, news waits; it arrives when they finish.
  useEffect(() => syncRef.current(), [focus]);

  // At most four cards on screen; the rest wait their turn, so a burst of news
  // (a boss clear can bring a dozen) never buries a level-up or an achievement.
  useEffect(() => {
    let shown: Card[] = [];
    let waiting: Card[] = [];
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const sync = () => {
      while (!focusRef.current && shown.length < MAX_SHOWN && waiting.length) {
        const c = waiting.shift()!;
        shown.push(c);
        const t = setTimeout(() => {
          timers.delete(t);
          dismiss(c.key);
        }, c.big ? 7000 : 4500);
        timers.add(t);
      }
      setCards([...shown]);
      setQueued(waiting.length);
    };
    const dismiss = (key: number) => {
      shown = shown.filter((c) => c.key !== key);
      sync();
    };
    dismissRef.current = dismiss;
    syncRef.current = sync;
    const off = onRewards((events) => {
      const fresh = cardsFor(events);
      if (!fresh.length) return;
      if (fresh.some((c) => c.big)) sfx.unlock();
      for (const c of fresh) {
        // One "You received" card at a time: a new one tops up the one already there.
        const i = c.boxIds ? shown.findIndex((x) => x.boxIds) : -1;
        const j = c.boxIds ? waiting.findIndex((x) => x.boxIds) : -1;
        if (i !== -1) shown[i] = mergeBox(shown[i], c);
        else if (j !== -1) waiting[j] = mergeBox(waiting[j], c);
        else waiting.push(c);
      }
      // A long backlog sheds its small news first; everything is in the log anyway.
      while (waiting.length > MAX_WAITING) {
        const small = waiting.findIndex((c) => !c.big && !c.action);
        waiting.splice(small === -1 ? 0 : small, 1);
      }
      sync();
    });
    return () => {
      off();
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  if (quiet) return null;
  return (
    <div className="announcer" aria-live="polite">
      {cards.map((c) => (
        <div key={c.key} className={`card-note ${c.big ? 'big' : ''}`} style={{ ['--tone' as string]: c.tone }}>
          <span className="note-icon" aria-hidden>{c.icon}</span>
          <div className="note-body">
            <span className="kicker">{c.kicker}</span>
            <b>{c.title}</b>
            {c.body && <span className="note-text">{c.body}</span>}
          </div>
          {c.action && (
            <button className="btn small-btn" onClick={() => { c.action!.run(); dismissRef.current(c.key); }}>
              {c.action.label}
            </button>
          )}
          <button className="note-close" aria-label="Dismiss" onClick={() => dismissRef.current(c.key)}>×</button>
        </div>
      ))}
      {cards.length > 0 && queued > 0 && (
        <button className="link small" onClick={() => go('/character/log')}>{queued} more · see everything in your log</button>
      )}
    </div>
  );
}
