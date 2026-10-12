// Builders for the AWS certification paths. A lesson is a quiz level: the
// lesson text teaches, then its questions check you understood, and every one
// of them also counts towards your exam readiness.
import type { SkillId } from '../../game/skills';
import type { ExamQuestion, Question, QuizLevel } from '../../game/types';

/**
 * Shuffle the options into a fixed order seeded by the prompt, and move the
 * answer with them. Questions are easiest to write with the right answer
 * anywhere, and writers lean towards B; this spreads the answers evenly over
 * A to D without changing between page loads.
 */
function arrange(prompt: string, options: string[], answer: number[]): { options: string[]; answer: number[] } {
  let h = 2166136261;
  for (const ch of prompt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const order = options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    const j = h % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { options: order.map((i) => options[i]), answer: answer.map((a) => order.indexOf(a)).sort() };
}

/** A single-answer question. `answer` is the index of the right option, as written. */
export function q(prompt: string, options: string[], answer: number, explain: string): Question {
  const a = arrange(prompt, options, [answer]);
  return { prompt, options: a.options, answer: a.answer[0], explain };
}

interface LessonSpec {
  id: string;
  title: string;
  system: string;
  skills: SkillId[];
  brief: string;
  lesson: string;
  questions: Question[];
}

export const lesson = (spec: LessonSpec): QuizLevel => ({ kind: 'quiz', ...spec });

/** The end-of-floor test: exam-style scenarios across everything on the floor. */
export const checkpoint = (spec: LessonSpec): QuizLevel => ({ kind: 'quiz', checkpoint: true, ...spec });

/**
 * Exam-style practice questions for one domain. A "Choose TWO" question
 * gives `answer` as an array, and says so in its prompt.
 */
export const bankFor =
  (prefix: string, domain: string) =>
  (n: number, prompt: string, options: string[], answer: number | number[], explain: string): ExamQuestion => {
    const a = arrange(prompt, options, typeof answer === 'number' ? [answer] : answer);
    return { id: `${prefix}/${domain}/${n}`, domain, prompt, options: a.options, answer: typeof answer === 'number' ? a.answer[0] : a.answer, explain };
  };
