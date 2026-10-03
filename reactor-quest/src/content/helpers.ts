import type { ComponentType } from 'react';
import { CheckFailure, type Module } from '../engine/runtime';
import type { CodeLevel } from '../game/types';

// Starter and solution files live beside this module in code/<level-id>/, as
// real .ts/.tsx files, so they read like code rather than escaped strings.
const files = import.meta.glob<string>('./code/*/*', { query: '?raw', import: 'default', eager: true });

export function codeFiles(id: string, ext: 'ts' | 'tsx'): Pick<CodeLevel, 'starter' | 'solution' | 'file'> {
  const starter = files[`./code/${id}/starter.${ext}`];
  const solution = files[`./code/${id}/solution.${ext}`];
  if (starter === undefined || solution === undefined) throw new Error(`Missing code files for level ${id}`);
  return { starter, solution, file: `solution.${ext}` };
}

/** An exported function from the player's module, or a clear failure if it isn't there. */
export function fnOf<T = (...args: any[]) => any>(mod: Module, name: string): T {
  const v = mod[name];
  if (typeof v !== 'function') {
    throw new CheckFailure(v === undefined ? `Nothing named "${name}" is exported. Did you write \`export\` in front of it?` : `"${name}" is exported, but it isn't a function.`);
  }
  return v as T;
}

export const comp = (mod: Module, name: string) => fnOf<ComponentType<any>>(mod, name);

/** Source text with comments stripped, for checks like "uses useState". */
export const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** The nth line the player's code printed, or a clear failure if it never got that far. */
export function line(logs: string[], n: number): string {
  if (logs.length <= n) {
    throw new CheckFailure(
      logs.length === 0
        ? 'Nothing was printed. Use console.log(...) to print something.'
        : `Only ${logs.length} line${logs.length > 1 ? 's were' : ' was'} printed — expected at least ${n + 1}.`,
    );
  }
  return logs[n];
}

/** Fail with a friendly message unless the (comment-free) source matches. */
export function mustUse(source: string, pattern: RegExp, message: string) {
  if (!pattern.test(code(source))) throw new CheckFailure(message);
}

/** Fail if the (comment-free) source contains something it shouldn't. */
export function mustNotUse(source: string, pattern: RegExp, message: string) {
  if (pattern.test(code(source))) throw new CheckFailure(message);
}
