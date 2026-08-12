import { QUEST } from '../flavour';
import type { QuestDef } from '../types';

/**
 * The quest line.
 *
 * Goals are declarative — a kind and a count, a POI, a threshold — so progress
 * is evaluated by `WorldState` from events it already receives rather than by
 * each quest carrying its own bespoke hook. Adding a quest is a table entry.
 */
export const QUESTS: QuestDef[] = [
  {
    id: 'ratting',
    giver: 'broker',
    title: QUEST.ratting.title,
    brief: QUEST.ratting.brief,
    done: QUEST.ratting.done,
    goal: { type: 'kill', kind: 'rat', count: 12 },
    rewardGold: 90,
    rewardXp: 70,
    requires: [],
  },
  {
    id: 'survey',
    giver: 'guide',
    title: QUEST.survey.title,
    brief: QUEST.survey.brief,
    done: QUEST.survey.done,
    goal: { type: 'discover', count: 6 },
    rewardGold: 120,
    rewardXp: 110,
    requires: [],
  },
  {
    id: 'camps',
    giver: 'broker',
    title: QUEST.camps.title,
    brief: QUEST.camps.brief,
    done: QUEST.camps.done,
    goal: { type: 'clear', poi: 'any-camp' },
    rewardGold: 160,
    rewardXp: 150,
    requires: ['ratting'],
  },
  {
    id: 'foreman',
    giver: 'broker',
    title: QUEST.foreman.title,
    brief: QUEST.foreman.brief,
    done: QUEST.foreman.done,
    goal: { type: 'kill', kind: 'elite', count: 3 },
    rewardGold: 300,
    rewardXp: 320,
    requires: ['camps'],
  },
  {
    id: 'depot',
    giver: 'guide',
    title: QUEST.depot.title,
    brief: QUEST.depot.brief,
    done: QUEST.depot.done,
    goal: { type: 'boss' },
    rewardGold: 600,
    rewardXp: 700,
    requires: ['survey'],
  },
];

export const questById = (id: string): QuestDef | undefined => QUESTS.find((q) => q.id === id);

/** How many units of progress a quest needs before it can be turned in. */
export function goalTarget(q: QuestDef): number {
  switch (q.goal.type) {
    case 'kill': return q.goal.count;
    case 'discover': return q.goal.count;
    case 'clear': return 1;
    case 'boss': return 1;
  }
}

/** One line of "3 / 12"-style progress text. */
export function goalLabel(q: QuestDef, progress: number): string {
  return `${Math.min(progress, goalTarget(q))} / ${goalTarget(q)}`;
}
