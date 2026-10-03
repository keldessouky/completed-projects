// Skills: every level trains one or more, and each grows from level 0 to 5 as
// you complete (and master) levels that use it — "Your Arrays skill is now
// level 3". Together they show the player's whole journey, JavaScript → React.

export type School = 'JavaScript' | 'TypeScript' | 'React';

export const SKILLS = {
  output: { name: 'Output & Values', school: 'JavaScript', icon: '💬' },
  logic: { name: 'Logic', school: 'JavaScript', icon: '🔀' },
  functions: { name: 'Functions', school: 'JavaScript', icon: '🧩' },
  arrays: { name: 'Arrays', school: 'JavaScript', icon: '📦' },
  objects: { name: 'Objects', school: 'JavaScript', icon: '🗂' },
  iteration: { name: 'Loops & Array Methods', school: 'JavaScript', icon: '🔁' },
  modern: { name: 'Modern JavaScript', school: 'JavaScript', icon: '✨' },
  errors: { name: 'Errors', school: 'JavaScript', icon: '🧯' },
  async: { name: 'Async', school: 'JavaScript', icon: '⏳' },
  types: { name: 'Types', school: 'TypeScript', icon: '🏷' },
  narrowing: { name: 'Narrowing', school: 'TypeScript', icon: '🔎' },
  generics: { name: 'Generics', school: 'TypeScript', icon: '🧬' },
  'type-level': { name: 'Type-Level Programming', school: 'TypeScript', icon: '🧠' },
  components: { name: 'Components', school: 'React', icon: '🧱' },
  state: { name: 'State & Events', school: 'React', icon: '🎛' },
  effects: { name: 'Effects', school: 'React', icon: '🌀' },
  hooks: { name: 'Hooks & Patterns', school: 'React', icon: '🪝' },
  data: { name: 'Data Fetching', school: 'React', icon: '📡' },
  performance: { name: 'Performance', school: 'React', icon: '⚡' },
  a11y: { name: 'Accessibility', school: 'React', icon: '♿' },
  testing: { name: 'Testing', school: 'React', icon: '🧪' },
} as const satisfies Record<string, { name: string; school: School; icon: string }>;

export type SkillId = keyof typeof SKILLS;

/** Skill points needed for each skill level: level 1 at 1 point … level 5 at 12. */
export const SKILL_THRESHOLDS = [1, 3, 5, 8, 12] as const;
export const MAX_SKILL_LEVEL = SKILL_THRESHOLDS.length;

export function skillLevel(points: number): number {
  let level = 0;
  for (const t of SKILL_THRESHOLDS) if (points >= t) level++;
  return level;
}

export const SKILL_RANKS = ['Untrained', 'Novice', 'Apprentice', 'Adept', 'Expert', 'Master'] as const;
