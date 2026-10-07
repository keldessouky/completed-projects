import { describe, expect, test } from 'vitest';
import { ALL_LEVELS, DECKS } from '../src/content';
import { ALL_ITEMS, FLOOR_SCROLLS, item } from '../src/game/items';
import { emptySave, levelState, type Save } from '../src/game/progress';
import {
  ACHIEVEMENTS,
  addBox,
  addViewers,
  buy,
  changeClass,
  checkAchievements,
  claimQuest,
  completeLevel,
  ensureQuests,
  FAN_MILESTONES,
  addDays,
  answerReview,
  dueReviews,
  finishReview,
  NOTE_MIN_WORDS,
  REVIEW_INTERVALS,
  saveNote,
  syncReviews,
  openBox,
  QUESTS,
  questProgress,
  recordRun,
  revealHint,
  revealSolution,
  touchStreak,
  WARES,
} from '../src/game/rewards';
import { skillLevel } from '../src/game/skills';
import { REVIEW_ITEMS } from '../src/content/review';
import { perfect, seeded } from './progress.test';

const first = ALL_LEVELS[0];
const kinds = (events: { kind: string }[]) => events.map((e) => e.kind);

describe('clearing a level', () => {
  test('pays XP, gold, viewers, skill points and a box — and the first clear levels you up', () => {
    const { save, events } = completeLevel(emptySave(), first, perfect, seeded());
    expect(save.xp).toBeGreaterThan(0);
    expect(save.gold).toBeGreaterThan(0);
    expect(save.viewers).toBeGreaterThan(0);
    for (const s of first.skills) expect(save.skills[s]).toBe(2); // first clear + three stars
    expect(kinds(events)).toEqual(expect.arrayContaining(['xp', 'level-up', 'gold', 'viewers', 'skill-up', 'box', 'achievement', 'feed']));
    expect(save.boxes.map((b) => b.source)).toEqual(expect.arrayContaining([`Level clear: ${first.title}`, `Flawless: ${first.title}`]));
  });

  test('replaying for the same stars pays nothing', () => {
    const once = completeLevel(emptySave(), first, perfect, seeded()).save;
    const twice = completeLevel(once, first, perfect, seeded()).save;
    expect(twice.xp).toBe(once.xp);
    expect(twice.gold).toBe(once.gold);
    expect(twice.viewers).toBe(once.viewers);
    expect(twice.boxes.length).toBe(once.boxes.length);
  });

  test('improving your stars pays only the difference', () => {
    const one = completeLevel(emptySave(), first, { ...perfect, stars: 1, firstTry: false }, seeded()).save;
    const three = completeLevel(one, first, perfect, seeded()).save;
    expect(three.xp).toBeGreaterThan(one.xp);
    expect(levelState(three, first.id).stars).toBe(3);
    expect(three.boxes.some((b) => b.source.startsWith('Flawless'))).toBe(true);
  });

  test('a boss drops a Gold Boss Box guaranteeing that floor\'s Codex scroll', () => {
    const boss = DECKS[0].levels.at(-1)!;
    const { save } = completeLevel(emptySave(), boss, perfect, seeded());
    const box = save.boxes.find((b) => b.source.startsWith('Boss Box'))!;
    expect(box.tier).toBe('gold');
    expect(box.guarantee).toBe(FLOOR_SCROLLS.boot);
    const opened = openBox(save, box.id, seeded())!;
    expect(opened.save.items[FLOOR_SCROLLS.boot]).toBe(1);
  });

  test('clearing a whole floor brings a sponsor and a Platinum box', () => {
    let s = emptySave();
    const events: string[] = [];
    for (const l of DECKS[0].levels) {
      const r = completeLevel(s, l, perfect, seeded());
      s = r.save;
      events.push(...kinds(r.events));
    }
    expect(events).toContain('sponsor');
    expect(s.sponsors).toEqual(['boot']);
    expect(s.boxes.some((b) => b.tier === 'platinum' && b.source.includes('Quasar Cola'))).toBe(true);
  });

  test('the pet is offered after Floor 1\'s boss, the class after Floor 3\'s', () => {
    const boss1 = completeLevel(emptySave(), DECKS[0].levels.at(-1)!, perfect, seeded());
    expect(boss1.events).toContainEqual({ kind: 'offer', what: 'pet' });
    const boss3 = completeLevel(emptySave(), DECKS[2].levels.at(-1)!, perfect, seeded());
    expect(boss3.events).toContainEqual({ kind: 'offer', what: 'class' });
  });

  test('classes boost their school', () => {
    const tsLevel = DECKS[3].levels[0];
    const plain = completeLevel(emptySave(), tsLevel, perfect, seeded()).save.xp;
    const sorcerer = completeLevel({ ...emptySave(), classId: 'type-sorcerer' }, tsLevel, perfect, seeded()).save.xp;
    expect(sorcerer).toBe(Math.round(plain * 1.25));
  });

  test('an XP boost adds 50% and is used up', () => {
    const plain = completeLevel(emptySave(), first, perfect, seeded()).save;
    const boosted = completeLevel({ ...emptySave(), boosts: 2 }, first, perfect, seeded()).save;
    expect(boosted.xp).toBe(Math.round(plain.xp * 1.5));
    expect(boosted.boosts).toBe(1);
  });

  test('finishing the whole station awards the Celestial box', () => {
    let s = emptySave();
    for (const l of ALL_LEVELS) s = completeLevel(s, l, perfect, seeded()).save;
    expect(s.boxes.some((b) => b.tier === 'celestial')).toBe(true);
    expect(s.achievements).toContain('all-levels');
  });
});

describe('skills', () => {
  test('perfect play takes every skill past level 1, and many to mastery', () => {
    let s = emptySave();
    for (const l of ALL_LEVELS) s = completeLevel(s, l, perfect, seeded()).save;
    const levels = Object.values(s.skills).map((p) => skillLevel(p ?? 0));
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(2);
    expect(levels.filter((l) => l === 5).length).toBeGreaterThanOrEqual(5);
  });
});

describe('loot boxes', () => {
  test('opening a box removes it and pays out', () => {
    const { save } = addBox(emptySave(), 'silver', 'Test');
    const opened = openBox(save, save.boxes[0].id, seeded(7))!;
    expect(opened.save.boxes).toHaveLength(0);
    expect(opened.save.gold).toBeGreaterThan(0);
    expect(opened.loot.length).toBeGreaterThan(1);
    expect(opened.save.counters.boxesOpened).toBe(1);
  });

  test('better boxes are better, on average', () => {
    const value = (tier: 'bronze' | 'gold' | 'platinum') => {
      let total = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const { save } = addBox(emptySave(), tier, 'Test');
        total += openBox(save, save.boxes[0].id, seeded(seed))!.save.gold;
      }
      return total;
    };
    expect(value('gold')).toBeGreaterThan(value('bronze'));
    expect(value('platinum')).toBeGreaterThan(value('gold'));
  });

  test('legendary boxes guarantee a legendary item, celestial the Heart of the Orrery', () => {
    const leg = addBox(emptySave(), 'legendary', 'Test').save;
    const opened = openBox(leg, leg.boxes[0].id, seeded(3))!;
    expect(opened.loot.some((l) => l.kind === 'item' && l.item.rarity === 'legendary')).toBe(true);
    const cel = addBox(emptySave(), 'celestial', 'Test').save;
    expect(openBox(cel, cel.boxes[0].id, seeded(3))!.save.items['orrery-heart']).toBe(1);
  });

  test('duplicate cosmetics are salvaged for gold', () => {
    let s: Save = emptySave();
    for (let i = 0; i < 40; i++) s = addBox(s, 'gold', 'Test').save;
    const rng = seeded(11);
    let salvaged = 0;
    while (s.boxes.length) {
      const r = openBox(s, s.boxes[0].id, rng)!;
      s = r.save;
      salvaged += r.loot.filter((l) => l.kind === 'gold' && l.note).length;
    }
    for (const it of ALL_ITEMS.filter((i) => i.kind !== 'collectible')) expect(s.items[it.id] ?? 0).toBeLessThanOrEqual(1);
    expect(salvaged).toBeGreaterThan(0);
  });

  test('floor scrolls only come from their boss, never at random', () => {
    let s: Save = emptySave();
    for (let i = 0; i < 80; i++) s = addBox(s, 'platinum', 'Test').save;
    const rng = seeded(5);
    while (s.boxes.length) s = openBox(s, s.boxes[0].id, rng)!.save;
    for (const scroll of Object.values(FLOOR_SCROLLS)) expect(s.items[scroll]).toBeUndefined();
  });
});

describe('viewers', () => {
  test('crossing a milestone sends a Fan Box', () => {
    const r = addViewers(emptySave(), FAN_MILESTONES[1] + 5);
    expect(r.save.fanMilestones).toBe(2);
    expect(r.save.boxes.filter((b) => b.source.startsWith('Fan Box'))).toHaveLength(2);
  });
  test('Crowd Favourites get better Fan Boxes', () => {
    const r = addViewers({ ...emptySave(), classId: 'crowd-favourite' }, FAN_MILESTONES[0]);
    expect(r.save.boxes[0].tier).toBe('silver');
  });
});

describe('achievements', () => {
  test('each is awarded once, with its box', () => {
    const s = completeLevel(emptySave(), first, perfect, seeded()).save;
    expect(s.achievements).toContain('hello-world');
    const again = checkAchievements(s);
    expect(again.events).toHaveLength(0);
  });
  test('titles come with some achievements', () => {
    const boss = DECKS[0].levels.at(-1)!;
    const s = completeLevel(emptySave(), boss, perfect, seeded()).save;
    expect(s.achievements).toContain('boss-slayer');
    expect(s.items['title-boss']).toBe(1);
  });
  test('ids are unique and every achievement can be described', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(45);
    for (const a of ACHIEVEMENTS) {
      expect(a.description.length).toBeGreaterThan(5);
      expect(a.quip.length).toBeGreaterThan(10);
      if (a.title) expect(item(a.title).kind).toBe('title');
    }
  });
});

describe('runs, hints and the solution', () => {
  test('failed runs count toward Persistence', () => {
    let s = emptySave();
    for (let i = 0; i < 5; i++) s = recordRun(s, first.id, false).save;
    s = recordRun(s, first.id, true).save;
    s = completeLevel(s, first, { ...perfect, firstTry: false, failedRuns: 5 }, seeded()).save;
    expect(s.achievements).toContain('persistence');
  });
  test('a hint token reveals a hint without costing a star', () => {
    const s = revealHint({ ...emptySave(), hintTokens: 1 }, first.id, 3, true).save;
    expect(s.hintTokens).toBe(0);
    expect(levelState(s, first.id)).toMatchObject({ hints: 1, freeHints: 1 });
    expect(s.achievements).toContain('token-gesture');
    const paid = revealHint(emptySave(), first.id, 3, false).save;
    expect(levelState(paid, first.id)).toMatchObject({ hints: 1, freeHints: 0 });
  });
  test('without a token, asking for one still costs a star', () => {
    const s = revealHint({ ...emptySave(), hintTokens: 0 }, first.id, 3, true).save;
    expect(levelState(s, first.id)).toMatchObject({ hints: 1, freeHints: 0 });
  });
  test('seeing the solution is noticed', () => {
    const s = revealSolution(emptySave(), first.id).save;
    expect(levelState(s, first.id).solution).toBe(true);
    expect(s.achievements).toContain('peeked');
  });
});

describe('daily quests and streaks', () => {
  test('three quests a day, the same for everyone that day', () => {
    const a = ensureQuests(emptySave(), '2026-10-04');
    const b = ensureQuests(emptySave(), '2026-10-04');
    expect(a.quests!.ids).toHaveLength(3);
    expect(new Set(a.quests!.ids).size).toBe(3);
    expect(a.quests!.ids).toEqual(b.quests!.ids);
    const days = new Set(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'].map((d) => ensureQuests(emptySave(), d).quests!.ids.join()));
    expect(days.size).toBeGreaterThan(1);
  });
  test('quest progress counts from the start of the day, and claiming pays once', () => {
    const today = '2026-10-04';
    let s = ensureQuests({ ...emptySave(), quests: { day: today, ids: ['clear-2', 'quiz', 'runs'], claimed: [], base: { ...emptySave().counters } } }, today);
    const clear2 = QUESTS.find((q) => q.id === 'clear-2')!;
    expect(claimQuest(s, 'clear-2', today).save).toBe(s);
    s = completeLevel(s, ALL_LEVELS[0], perfect, seeded()).save;
    s = completeLevel(s, ALL_LEVELS[1], perfect, seeded()).save;
    expect(questProgress(s, clear2)).toBe(2);
    const claimed = claimQuest(s, 'clear-2', today).save;
    expect(claimed.quests!.claimed).toEqual(['clear-2']);
    expect(claimed.gold).toBe(s.gold + 30);
    expect(claimQuest(claimed, 'clear-2', today).save).toBe(claimed);
  });
  test('streaks grow day by day and reset after a gap', () => {
    let s = touchStreak(emptySave(), '2026-10-01').save;
    s = touchStreak(s, '2026-10-02').save;
    s = touchStreak(s, '2026-10-02').save;
    const third = touchStreak(s, '2026-10-03');
    expect(third.save.streak).toEqual({ day: '2026-10-03', count: 3, best: 3 });
    expect(third.save.boxes.some((b) => b.source === 'Streak Box: 3 days')).toBe(true);
    const gap = touchStreak(third.save, '2026-10-06').save;
    expect(gap.streak).toEqual({ day: '2026-10-06', count: 1, best: 3 });
  });
});

describe('the Safe Room', () => {
  test('buying spends gold and delivers', () => {
    const rich = { ...emptySave(), gold: 1000 };
    const token = buy(rich, 'token')!.save;
    expect(token.gold).toBe(940);
    expect(token.hintTokens).toBe(rich.hintTokens + 1);
    const box = buy(rich, 'box-gold')!.save;
    expect(box.boxes[0].tier).toBe('gold');
    expect(buy({ ...emptySave(), gold: 10 }, 'token')).toBeNull();
  });
  test('cosmetics can only be bought once', () => {
    const ware = WARES.find((w) => w.kind === 'item')!;
    const once = buy({ ...emptySave(), gold: 5000 }, ware.id)!.save;
    expect(buy(once, ware.id)).toBeNull();
  });
  test('the first class is free; changing it costs gold', () => {
    const chosen = changeClass(emptySave(), 'bug-hunter')!;
    expect(chosen.classId).toBe('bug-hunter');
    expect(changeClass(chosen, 'speedrunner')).toBeNull();
    const switched = changeClass({ ...chosen, gold: 500 }, 'speedrunner')!;
    expect(switched.classId).toBe('speedrunner');
    expect(switched.gold).toBe(200);
  });
});

describe('spaced review', () => {
  const today = '2026-10-04';
  const quiz = ALL_LEVELS.find((l) => l.kind === 'quiz')!;
  const cleared = () => {
    let s = emptySave();
    for (const l of ALL_LEVELS.slice(0, ALL_LEVELS.indexOf(quiz) + 1)) s = completeLevel(s, l, perfect, seeded()).save;
    return s;
  };

  test('clearing a quiz adds its questions to the deck, first due the next day', () => {
    const s = syncReviews(cleared(), today);
    const ids = REVIEW_ITEMS.filter((r) => r.after === quiz.id).map((r) => r.id);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(s.reviews[id]).toEqual({ box: 0, due: addDays(today, 1) });
    expect(dueReviews(s, today)).toHaveLength(0);
    expect(dueReviews(s, addDays(today, 1)).map((r) => r.id)).toEqual(expect.arrayContaining(ids));
    expect(syncReviews(s, today)).toBe(s);
  });

  test('nothing joins the deck before its level is cleared', () => {
    expect(syncReviews(emptySave(), today).reviews).toEqual({});
  });

  test('remembering pushes a card further out; forgetting brings it back tomorrow', () => {
    const tomorrow = addDays(today, 1);
    let s = syncReviews(cleared(), today);
    const id = dueReviews(s, tomorrow)[0].id;
    s = answerReview(s, id, true, tomorrow).save;
    expect(s.reviews[id]).toEqual({ box: 1, due: addDays(tomorrow, REVIEW_INTERVALS[1]) });
    s = answerReview(s, id, true, s.reviews[id].due).save;
    expect(s.reviews[id].box).toBe(2);
    const missed = answerReview(s, id, false, s.reviews[id].due).save;
    expect(missed.reviews[id]).toEqual({ box: 0, due: addDays(s.reviews[id].due, 1) });
    expect(missed.counters.reviewsAnswered).toBe(3);
    expect(missed.counters.reviewsCorrect).toBe(2);
  });

  test('reviewing pays a little XP, more for remembering', () => {
    const s = syncReviews(cleared(), today);
    const id = Object.keys(s.reviews)[0];
    const right = answerReview(s, id, true, addDays(today, 1)).save.xp - s.xp;
    const wrong = answerReview(s, id, false, addDays(today, 1)).save.xp - s.xp;
    expect(right).toBeGreaterThan(wrong);
    expect(wrong).toBeGreaterThan(0);
  });

  test('a session with no mistakes is a clean sweep', () => {
    const r = finishReview(emptySave(), 6, 0).save;
    expect(r.counters.reviewSessions).toBe(1);
    expect(r.achievements).toEqual(expect.arrayContaining(['remember-when', 'clean-sweep']));
    expect(finishReview(emptySave(), 6, 1).save.counters.perfectReviews).toBe(0);
  });

  test('the review quest only appears once there is a deck', () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'];
    for (const d of days) expect(ensureQuests(emptySave(), d).quests!.ids).not.toContain('review');
  });
});

describe('the notebook', () => {
  test('the first real explanation of a level earns XP once', () => {
    const words = Array.from({ length: NOTE_MIN_WORDS }, () => 'word').join(' ');
    const once = saveNote(emptySave(), first.id, words, 1);
    expect(once.save.notes[first.id].text).toBe(words);
    expect(once.save.counters.notesWritten).toBe(1);
    expect(once.save.xp).toBeGreaterThan(0);
    const edited = saveNote(once.save, first.id, `${words} more`, 2).save;
    expect(edited.xp).toBe(once.save.xp);
    expect(edited.notes[first.id].text).toBe(`${words} more`);
  });

  test('a note too short to explain anything is kept, but earns nothing', () => {
    const r = saveNote(emptySave(), first.id, 'ok', 1).save;
    expect(r.notes[first.id].text).toBe('ok');
    expect(r.xp).toBe(0);
  });

  test('saving an empty note deletes it', () => {
    const s = saveNote(emptySave(), first.id, 'one two three four five', 1).save;
    expect(saveNote(s, first.id, '  ', 2).save.notes[first.id]).toBeUndefined();
  });
});

describe('learning from mistakes', () => {
  test('replaying a level for more stars earns Second Wind', () => {
    const one = completeLevel(emptySave(), first, { ...perfect, stars: 1, firstTry: false }, seeded()).save;
    const better = completeLevel(one, first, perfect, seeded()).save;
    expect(better.counters.improvedClears).toBe(1);
    expect(better.achievements).toContain('second-wind');
  });
});
