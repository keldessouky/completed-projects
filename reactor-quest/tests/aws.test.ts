// The AWS certification paths: the content is valid exam-style material, and
// the readiness estimate behaves the way the game promises.
import { describe, expect, test } from 'vitest';
import { CERT_PATHS, DEFAULT_CERT, findLevel, pathById, pathLevels } from '../src/content';
import { emptySave, isUnlocked, parseSave, type Save } from '../src/game/progress';
import {
  answers,
  certQuestions,
  isRight,
  mastery,
  pickQuestions,
  quotas,
  readiness,
  recordAnswer,
  scaled,
  scoreSession,
} from '../src/game/readiness';
import { completeLevel, finishPractice } from '../src/game/rewards';
import { SKILLS } from '../src/game/skills';
import type { ExamQuestion, Path } from '../src/game/types';
import { perfect, seeded } from './progress.test';

/** A save where every question of a path has been answered, right or wrong. */
function answeredAll(path: Path, right: (q: ExamQuestion) => boolean, s: Save = emptySave()): Save {
  return certQuestions(path).reduce((acc, q) => recordAnswer(acc, q.id, right(q)), { ...s, path: path.id });
}
function clearedAll(path: Path, s: Save = emptySave()): Save {
  for (const l of pathLevels(path)) s = completeLevel(s, l, perfect, seeded()).save;
  return s;
}

describe.each(CERT_PATHS.map((p) => [p.id, p] as const))('%s content', (_id, path) => {
  const exam = path.exam!;
  const questions = certQuestions(path);

  test('the exam guide facts add up', () => {
    expect(exam.domains.reduce((n, d) => n + d.weight, 0)).toBe(100);
    expect(exam.pass).toBeGreaterThanOrEqual(100);
    expect(exam.pass).toBeLessThanOrEqual(1000);
  });

  test('every floor prepares for one exam domain, and every domain has floors', () => {
    for (const deck of path.decks) expect(exam.domains.map((d) => d.id), deck.id).toContain(deck.domain);
    for (const d of exam.domains) expect(path.decks.some((deck) => deck.domain === d.id), d.id).toBe(true);
  });

  test('every floor is lessons ending in exactly one checkpoint', () => {
    for (const deck of path.decks) {
      const checkpoints = deck.levels.filter((l) => l.kind === 'quiz' && l.checkpoint);
      expect(checkpoints, deck.id).toHaveLength(1);
      expect(deck.levels.at(-1), deck.id).toBe(checkpoints[0]);
      expect(deck.levels.length, deck.id).toBeGreaterThanOrEqual(4);
    }
  });

  test('every lesson teaches, asks enough, and trains Cloud skills', () => {
    for (const level of pathLevels(path)) {
      expect(level.kind).toBe('quiz');
      if (level.kind !== 'quiz') continue;
      expect(level.id.startsWith(`${path.id.replace('aws-', '')}-`), level.id).toBe(true);
      expect(level.lesson.length, level.id).toBeGreaterThan(200);
      expect(level.questions.length, level.id).toBeGreaterThanOrEqual(level.checkpoint ? 8 : 6);
      for (const s of level.skills) expect(SKILLS[s].school, `${level.id}: ${s}`).toBe('Cloud');
    }
  });

  test('there are enough questions for a full mock exam in every domain', () => {
    const q = quotas(exam, exam.questions);
    for (const d of exam.domains) {
      expect(questions.filter((x) => x.domain === d.id).length, d.id).toBeGreaterThanOrEqual(Math.max(q[d.id], 20));
    }
  });

  test('every question is well formed', () => {
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
    for (const q of questions) {
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(4);
      expect(q.options.length, q.id).toBeLessThanOrEqual(5);
      expect(new Set(q.options).size, q.id).toBe(q.options.length);
      expect(q.explain.length, q.id).toBeGreaterThan(10);
      const right = answers(q);
      for (const a of right) {
        expect(a, q.id).toBeGreaterThanOrEqual(0);
        expect(a, q.id).toBeLessThan(q.options.length);
      }
      expect(new Set(right).size, q.id).toBe(right.length);
      // "Choose TWO" questions say so, and nothing else does.
      const choose = q.prompt.match(/\(Choose (TWO|THREE)\.\)/)?.[1];
      expect(choose ? (choose === 'TWO' ? 2 : 3) : 1, q.id).toBe(right.length);
    }
  });

  test('right answers are spread evenly over the letters', () => {
    const counts = [0, 0, 0, 0];
    const singles = questions.filter((q) => typeof q.answer === 'number');
    for (const q of singles) counts[q.answer as number]++;
    for (const c of counts) expect(c / singles.length).toBeLessThan(0.35);
    for (const c of counts) expect(c / singles.length).toBeGreaterThan(0.15);
  });

  test('every bank question belongs to a domain of this exam', () => {
    for (const q of path.bank ?? []) expect(exam.domains.map((d) => d.id), q.id).toContain(q.domain);
  });
});

describe('journeys', () => {
  test('AWS starts with the easiest certification', () => {
    expect(DEFAULT_CERT).toBe(CERT_PATHS[0].id);
    expect(pathById(DEFAULT_CERT).exam!.level).toBe('Foundational');
  });

  test('a new save plays the TypeScript & React station; the journey round-trips through the save', () => {
    expect(emptySave().path).toBe('reactor');
    const s = parseSave(JSON.stringify({ ...emptySave(), path: 'aws-saa' }));
    expect(s.path).toBe('aws-saa');
    expect(parseSave(JSON.stringify({ ...emptySave(), path: 'aws-nope' })).path).toBe('reactor');
  });

  test('levels know their journey', () => {
    expect(findLevel('clf-what-is-cloud')?.path.id).toBe('aws-clf');
    expect(findLevel('saa-policy-evaluation')?.path.id).toBe('aws-saa');
  });

  test('every certification floor opens at once; lessons unlock in order; checkpoints are open to test out', () => {
    const s = emptySave();
    for (const path of CERT_PATHS) {
      for (const deck of path.decks) {
        expect(isUnlocked(s, deck.levels[0].id), deck.id).toBe(true);
        expect(isUnlocked(s, deck.levels.at(-1)!.id), deck.id).toBe(true);
        expect(isUnlocked(s, deck.levels[1].id), deck.id).toBe(false);
      }
    }
    const first = pathById('aws-clf').decks[0].levels;
    const after = completeLevel(s, first[0], perfect, seeded()).save;
    expect(isUnlocked(after, first[1].id)).toBe(true);
  });
});

describe('recording answers', () => {
  const clf = pathById('aws-clf');
  const q = certQuestions(clf)[0];

  test('keeps the last few results per certification question, and ignores anything else', () => {
    let s = emptySave();
    for (const r of [true, false, true, true, false]) s = recordAnswer(s, q.id, r);
    expect(s.exam.answers[q.id]).toBe('0110');
    expect(recordAnswer(s, 'quiz-collections/1', true)).toBe(s);
  });

  test('mastery leans on the latest answer', () => {
    expect(mastery('')).toBe(0);
    expect(mastery('1')).toBe(1);
    expect(mastery('0')).toBe(0);
    expect(mastery('01')).toBeCloseTo(0.6);
    expect(mastery('10')).toBeCloseTo(0.4);
  });

  test('a "Choose TWO" question needs exactly both right options', () => {
    const multi = (clf.bank ?? []).find((x) => Array.isArray(x.answer))!;
    const right = answers(multi);
    expect(isRight(multi, right)).toBe(true);
    expect(isRight(multi, [right[0]])).toBe(false);
    const wrong = multi.options.map((_, i) => i).find((i) => !right.includes(i))!;
    expect(isRight(multi, [right[0], wrong])).toBe(false);
  });

  test('scaled scores run from 100 to 1000', () => {
    expect(scaled(0)).toBe(100);
    expect(scaled(1)).toBe(1000);
    expect(scaled(2 / 3)).toBe(700);
  });
});

describe.each(CERT_PATHS.map((p) => [p.id, p] as const))('%s readiness', (_id, path) => {
  const exam = path.exam!;

  test('a new player has not started, and the estimate starts at a guess', () => {
    const r = readiness(emptySave(), path);
    expect(r.verdict).toBe('not-started');
    expect(r.percent).toBe(0);
    expect(r.estimate).toBeLessThan(400);
  });

  test('answering everything wrong is not ready', () => {
    const r = readiness(answeredAll(path, () => false), path);
    expect(r.verdict).toBe('not-ready');
    expect(r.estimate).toBeLessThan(300);
  });

  test('knowing every answer is not enough without the lessons and a mock exam', () => {
    const r = readiness(answeredAll(path, () => true), path);
    expect(r.estimate).toBeGreaterThanOrEqual(r.target);
    expect(r.verdict).toBe('almost');
    expect(r.percent).toBeLessThan(100);
    expect(r.checklist.find((c) => c.label.includes('mock'))!.done).toBe(false);
  });

  test('lessons, practice in every domain, a strong estimate and a passed mock exam: ready at 100%', () => {
    let s = answeredAll(path, () => true, clearedAll(path));
    const qs = pickQuestions(s, path, { count: exam.questions, mode: 'full' }, seeded(3));
    s = finishPractice(s, qs.map((q) => ({ q, correct: true })), 'full', '2026-10-12').save;
    const r = readiness(s, path);
    expect(r.checklist.every((c) => c.done)).toBe(true);
    expect(r.verdict).toBe('ready');
    expect(r.percent).toBe(100);
  });

  test('readiness grows as you learn', () => {
    // Nested sets: the first third right, then two thirds, then everything.
    const all_ = certQuestions(path);
    const some = answeredAll(path, (q) => all_.indexOf(q) % 3 === 0);
    const more = answeredAll(path, (q) => all_.indexOf(q) % 3 !== 2);
    const all = answeredAll(path, () => true);
    const p = [some, more, all].map((s) => readiness(s, path).percent);
    expect(p[0]).toBeLessThanOrEqual(p[1]);
    expect(p[1]).toBeLessThanOrEqual(p[2]);
  });

  test('the weakest domain is the one you get wrong', () => {
    const weak = exam.domains[1].id;
    const s = answeredAll(path, (q) => q.domain !== weak);
    const r = readiness(s, path);
    expect(r.weakest.id).toBe(weak);
    // The advice points at the weakest domain: its lessons first, then drilling it.
    const lessons = path.decks.filter((d) => d.domain === weak).map((d) => d.name);
    expect(lessons.some((name) => r.advice.includes(name))).toBe(true);
    const learned = readiness(answeredAll(path, (q) => q.domain !== weak, clearedAll(path)), path);
    expect(learned.advice).toContain(r.weakest.name);
  });

  test('the estimate weights domains like the exam', () => {
    // Failing the biggest domain costs more than failing the smallest.
    const byWeight = [...exam.domains].sort((a, b) => b.weight - a.weight);
    const failBig = readiness(answeredAll(path, (q) => q.domain !== byWeight[0].id), path).estimate;
    const failSmall = readiness(answeredAll(path, (q) => q.domain !== byWeight.at(-1)!.id), path).estimate;
    expect(failBig).toBeLessThan(failSmall);
  });
});

describe('practice sessions', () => {
  const path = pathById('aws-clf');
  const exam = path.exam!;

  test('mixed sessions follow the domain weights', () => {
    const q = quotas(exam, 65);
    expect(Object.values(q).reduce((a, b) => a + b, 0)).toBe(65);
    for (const d of exam.domains) expect(Math.abs(q[d.id] - (65 * d.weight) / 100)).toBeLessThan(1);
    const picked = pickQuestions(emptySave(), path, { count: 65, mode: 'full' }, seeded(1));
    expect(picked).toHaveLength(65);
    expect(new Set(picked.map((x) => x.id)).size).toBe(65);
    for (const d of exam.domains) expect(picked.filter((x) => x.domain === d.id)).toHaveLength(q[d.id]);
  });

  test('drills stay in their domain and favour what you missed or haven\'t seen', () => {
    const d = exam.domains[3].id;
    const pool = certQuestions(path).filter((x) => x.domain === d);
    // Know half of the domain; the drill should pick from the other half.
    const known = pool.slice(0, Math.floor(pool.length / 2));
    const s = known.reduce((acc, x) => recordAnswer(acc, x.id, true), emptySave());
    const drill = pickQuestions(s, path, { count: 10, domain: d, mode: 'drill' }, seeded(2));
    expect(drill.every((x) => x.domain === d)).toBe(true);
    expect(drill.filter((x) => known.includes(x)).length).toBe(0);
  });

  test('finishing a session records every answer, keeps the result and pays XP', () => {
    const qs = pickQuestions(emptySave(), path, { count: 15, mode: 'quick' }, seeded(5));
    const results = qs.map((q, i) => ({ q, correct: i % 3 !== 0 }));
    const { save } = finishPractice({ ...emptySave(), path: 'aws-clf' }, results, 'quick', '2026-10-12');
    expect(Object.keys(save.exam.answers)).toHaveLength(15);
    expect(save.exam.mocks).toHaveLength(1);
    const m = save.exam.mocks[0];
    expect(m.correct).toBe(10);
    expect(m.total).toBe(15);
    expect(m.score).toBe(scaled(10 / 15));
    expect(save.xp).toBeGreaterThan(0);
    const again = parseSave(JSON.stringify(save));
    expect(again.exam).toEqual(save.exam);
  });

  test('a session result tallies each domain', () => {
    const qs = certQuestions(path).slice(0, 4);
    const r = scoreSession(path, 'drill', qs.map((q) => ({ q, correct: true })), '2026-10-12');
    expect(Object.values(r.domains).reduce((n, [, t]) => n + t, 0)).toBe(4);
    expect(r.passed).toBe(true);
  });

  test('passing a full mock earns the achievement', () => {
    const qs = pickQuestions(emptySave(), path, { count: 65, mode: 'full' }, seeded(9));
    const { save } = finishPractice({ ...emptySave(), path: 'aws-clf' }, qs.map((q) => ({ q, correct: true })), 'full', '2026-10-12');
    expect(save.achievements).toContain('mock-pass');
  });
});
