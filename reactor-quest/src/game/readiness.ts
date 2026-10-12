// How ready are you for your certification exam? Every certification question
// you answer (in a lesson, a review card or a practice exam) is remembered,
// and readiness is worked out from those answers the way the exam is scored:
// domain by domain, weighted by each domain's share of the questions.
//
// It's an honest estimate, not a promise: it assumes the real exam asks about
// what these questions cover, and it starts from the score you'd get by
// guessing until you've shown what you know.
import { CERT_PATHS, pathLevels } from '../content';
import { levelState, type MockResult, type Save } from './progress';
import type { Exam, ExamQuestion, Path, PathId } from './types';

/** How many recent results are kept for each question. */
export const HISTORY = 4;
/** What a question you haven't answered counts as: a guess between four options. */
const PRIOR = 0.25;
/** …and how many answers' worth of weight that guess carries. */
const PRIOR_WEIGHT = 4;
/** How far above the passing score "ready" sits, so a bad day still passes. */
export const MARGIN = 50;

// ---------------------------------------------------------------- questions

const QUESTIONS = new Map<PathId, ExamQuestion[]>();
const OWNER = new Map<string, PathId>();

/** Every question for a certification: each lesson's and checkpoint's, then the practice bank. */
export function certQuestions(path: Path): ExamQuestion[] {
  const cached = QUESTIONS.get(path.id);
  if (cached) return cached;
  const fromLessons = path.decks.flatMap((deck) =>
    deck.levels.flatMap((level) =>
      level.kind === 'quiz'
        ? level.questions.map((q, i): ExamQuestion => ({
            id: `${level.id}/${i + 1}`,
            domain: deck.domain ?? '',
            prompt: q.prompt,
            code: q.code,
            options: q.options,
            answer: q.answer,
            explain: q.explain,
            from: level.id,
          }))
        : [],
    ),
  );
  const all = [...fromLessons, ...(path.bank ?? [])];
  QUESTIONS.set(path.id, all);
  for (const q of all) OWNER.set(q.id, path.id);
  return all;
}

/** The right options of a question, as a list. */
export const answers = (q: ExamQuestion): number[] => (typeof q.answer === 'number' ? [q.answer] : q.answer);

/** Is this set of picked options exactly right? */
export function isRight(q: ExamQuestion, picked: number[]): boolean {
  const right = answers(q);
  return picked.length === right.length && right.every((a) => picked.includes(a));
}

// ---------------------------------------------------------------- recording answers

/** Remember an answer to a certification question (anything else is ignored). */
export function recordAnswer(save: Save, id: string, correct: boolean): Save {
  if (!OWNER.size) CERT_PATHS.forEach(certQuestions);
  if (!OWNER.has(id)) return save;
  const history = ((save.exam.answers[id] ?? '') + (correct ? '1' : '0')).slice(-HISTORY);
  return { ...save, exam: { ...save.exam, answers: { ...save.exam.answers, [id]: history } } };
}

/** How well you know one question, 0 to 1: mostly your latest answer, partly the ones before. */
export function mastery(history: string): number {
  if (!history) return 0;
  const last = history.endsWith('1') ? 1 : 0;
  if (history.length === 1) return last;
  const earlier = history.slice(0, -1);
  return 0.6 * last + 0.4 * ([...earlier].filter((c) => c === '1').length / earlier.length);
}

/** A fraction of questions right, on AWS's scaled score of 100 to 1000 (rounded to tens). */
export const scaled = (fraction: number) => Math.round((100 + 900 * Math.min(1, Math.max(0, fraction))) / 10) * 10;

// ---------------------------------------------------------------- readiness

export interface DomainReadiness {
  id: string;
  name: string;
  weight: number;
  /** Questions available for this domain. */
  pool: number;
  /** …of which you've answered. */
  answered: number;
  /** How many you need to have answered before the estimate is trusted. */
  need: number;
  /** Estimated share you'd get right on the exam, 0 to 1. */
  accuracy: number;
  /** How much evidence there is, 0 to 1. */
  confidence: number;
  lessonsDone: number;
  lessonsTotal: number;
}

export type Verdict = 'not-started' | 'not-ready' | 'getting-there' | 'almost' | 'ready';

export interface Readiness {
  exam: Exam;
  /** 0 to 100. Only 100 when every item on the checklist is done. */
  percent: number;
  verdict: Verdict;
  /** Estimated exam score, on AWS's scale of 100 to 1000. */
  estimate: number;
  target: number;
  domains: DomainReadiness[];
  weakest: DomainReadiness;
  lessonsDone: number;
  lessonsTotal: number;
  answered: number;
  lastFull?: MockResult;
  checklist: { label: string; done: boolean }[];
  /** The one thing to do next. */
  advice: string;
}

export const VERDICTS: Record<Verdict, { label: string; icon: string }> = {
  'not-started': { label: 'Not started', icon: '🛰' },
  'not-ready': { label: 'Not ready yet', icon: '🔴' },
  'getting-there': { label: 'Getting there', icon: '🟠' },
  almost: { label: 'Almost ready', icon: '🟡' },
  ready: { label: 'Ready to book the exam', icon: '🟢' },
};

export function domainReadiness(save: Save, path: Path): DomainReadiness[] {
  const exam = path.exam!;
  const questions = certQuestions(path);
  return exam.domains.map((d) => {
    const pool = questions.filter((q) => q.domain === d.id);
    const histories = pool.map((q) => save.exam.answers[q.id]).filter((h): h is string => !!h);
    const known = histories.reduce((n, h) => n + mastery(h), 0);
    const need = Math.min(pool.length, Math.max(10, Math.round(pool.length * 0.5)));
    const lessons = path.decks.filter((deck) => deck.domain === d.id).flatMap((deck) => deck.levels);
    return {
      id: d.id,
      name: d.name,
      weight: d.weight,
      pool: pool.length,
      answered: histories.length,
      need,
      accuracy: (known + PRIOR * PRIOR_WEIGHT) / (histories.length + PRIOR_WEIGHT),
      confidence: need ? Math.min(1, histories.length / need) : 0,
      lessonsDone: lessons.filter((l) => levelState(save, l.id).done).length,
      lessonsTotal: lessons.length,
    };
  });
}

export function readiness(save: Save, path: Path): Readiness {
  const exam = path.exam!;
  const domains = domainReadiness(save, path);
  const share = (f: (d: DomainReadiness) => number) => domains.reduce((n, d) => n + (d.weight / 100) * f(d), 0);
  const estimate = scaled(share((d) => d.accuracy));
  const target = Math.min(1000, exam.pass + MARGIN);
  const levels = pathLevels(path);
  const lessonsDone = levels.filter((l) => levelState(save, l.id).done).length;
  const lessonsTotal = levels.length;
  const answered = domains.reduce((n, d) => n + d.answered, 0);
  const practice = share((d) => d.confidence);
  const lastFull = save.exam.mocks.filter((m) => m.cert === path.id && m.mode === 'full').at(-1);

  const checklist = [
    { label: `Finish every lesson (${lessonsDone} of ${lessonsTotal})`, done: lessonsTotal > 0 && lessonsDone === lessonsTotal },
    { label: 'Practise every domain (at least half of each domain\'s questions)', done: domains.every((d) => d.confidence >= 1) },
    { label: 'Get 70% or more in every domain', done: domains.every((d) => d.accuracy >= 0.7 && d.confidence >= 1) },
    { label: `Reach an estimated score of ${target} (passing is ${exam.pass})`, done: estimate >= target },
    { label: `Score ${target} or more on a full mock exam`, done: !!lastFull && lastFull.score >= target },
  ];
  const ready = checklist.every((c) => c.done);

  // Most of the weight is the estimated score; it only counts once you're
  // clearly past guessing (400), and grows fastest near the target.
  const scoreTerm = Math.min(1, Math.max(0, (estimate - 400) / (target - 400))) ** 2;
  const raw = Math.round(100 * (0.15 * (lessonsTotal ? lessonsDone / lessonsTotal : 0) + 0.15 * practice + 0.7 * scoreTerm));
  const percent = ready ? 100 : Math.min(99, raw);

  // The weakest domain: the least practised if any domain lacks evidence, else the least accurate.
  const thin = domains.filter((d) => d.confidence < 1);
  const weakest = (thin.length ? thin.sort((a, b) => a.confidence - b.confidence || b.weight - a.weight) : [...domains].sort((a, b) => a.accuracy - b.accuracy))[0];

  const verdict: Verdict =
    answered === 0 && lessonsDone === 0
      ? 'not-started'
      : ready
        ? 'ready'
        : estimate >= exam.pass && practice >= 0.8
          ? 'almost'
          : percent >= 40
            ? 'getting-there'
            : 'not-ready';

  // Unfinished lessons: the weakest domain's first.
  const open = path.decks.filter((deck) => deck.levels.some((l) => !levelState(save, l.id).done));
  const unfinished = open.find((deck) => deck.domain === weakest.id) ?? open[0];
  const advice = ready
    ? `You're ready. Book the ${exam.code} exam, and keep your review streak going until the day.`
    : !checklist[0].done && unfinished
      ? `Work through the "${unfinished.name}" lessons: they teach what the questions test.`
      : !checklist[1].done
        ? `Practise ${weakest.name}: you've answered ${weakest.answered} of the ${weakest.need} questions needed to judge it.`
        : !checklist[2].done || !checklist[3].done
          ? `Drill ${weakest.name}: you're at about ${Math.round(weakest.accuracy * 100)}% there.`
          : `Take a full ${exam.questions}-question mock exam under exam conditions (${exam.minutes} minutes).`;

  return { exam, percent, verdict, estimate, target, domains, weakest, lessonsDone, lessonsTotal, answered, lastFull, checklist, advice };
}

// ---------------------------------------------------------------- picking practice questions

export interface PracticeSpec {
  count: number;
  /** Only this domain (a drill), or every domain in proportion to its weight. */
  domain?: string;
  /** Drills favour what you don't know yet; mock exams are a fair random draw (that you haven't seen first). */
  mode: MockResult['mode'];
}

/** How many questions each domain gets in a mixed session of `count`, by weight. */
export function quotas(exam: Exam, count: number): Record<string, number> {
  const raw = exam.domains.map((d) => ({ id: d.id, n: (count * d.weight) / 100 }));
  const out = Object.fromEntries(raw.map((r) => [r.id, Math.floor(r.n)]));
  let left = count - Object.values(out).reduce((a, b) => a + b, 0);
  for (const r of [...raw].sort((a, b) => (b.n % 1) - (a.n % 1))) {
    if (left <= 0) break;
    out[r.id]++;
    left--;
  }
  return out;
}

export function pickQuestions(save: Save, path: Path, spec: PracticeSpec, rng: () => number): ExamQuestion[] {
  const all = certQuestions(path);
  const priority = (q: ExamQuestion) => {
    const h = save.exam.answers[q.id];
    if (!h) return 0;
    if (spec.mode === 'full') return 1;
    return h.endsWith('0') ? 1 : 2 + mastery(h);
  };
  const take = (pool: ExamQuestion[], n: number) =>
    pool
      .map((q) => ({ q, key: priority(q) + rng() * 0.9 }))
      .sort((a, b) => a.key - b.key)
      .slice(0, n)
      .map((x) => x.q);
  const chosen = spec.domain
    ? take(all.filter((q) => q.domain === spec.domain), spec.count)
    : Object.entries(quotas(path.exam!, spec.count)).flatMap(([d, n]) => take(all.filter((q) => q.domain === d), n));
  // Mixed sessions shouldn't arrive grouped by domain.
  return chosen
    .map((q) => ({ q, key: rng() }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.q);
}

/** Tally a finished session into a result. */
export function scoreSession(path: Path, mode: MockResult['mode'], results: { q: ExamQuestion; correct: boolean }[], day: string): MockResult {
  const domains: Record<string, [number, number]> = {};
  for (const { q, correct } of results) {
    const d = (domains[q.domain] ??= [0, 0]);
    d[1]++;
    if (correct) d[0]++;
  }
  const correct = results.filter((r) => r.correct).length;
  const score = scaled(results.length ? correct / results.length : 0);
  return { cert: path.id, day, mode, correct, total: results.length, score, passed: score >= path.exam!.pass, domains };
}
