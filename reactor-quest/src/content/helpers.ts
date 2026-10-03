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
