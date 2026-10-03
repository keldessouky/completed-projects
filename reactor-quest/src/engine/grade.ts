// Grading a code level: type-check the player's file plus each hidden type
// check, then run every behavioural check against the real module.
import { createElement } from 'react';
import type { CodeLevel, Kit } from '../game/types';
import type { CheckResult, Diagnostic } from './checker';
import { CheckFailure, Sandbox, Stage, expect, fn, loadModule, wait } from './runtime';

export type Compile = (files: Record<string, string>) => Promise<CheckResult>;

export interface CheckOutcome {
  label: string;
  pass: boolean;
  message?: string;
}

export interface Report {
  /** The player's file, compiled to CommonJS — for the live preview. */
  js: string;
  typeErrors: Diagnostic[];
  typeChecks: CheckOutcome[];
  checks: CheckOutcome[];
  logs: string[];
  /** The module failed to load at all (a throw at top level). */
  loadError?: string;
  passed: boolean;
}

const CHECK_TIMEOUT_MS = 4000;

export const typeCheckPath = (i: number) => `/__typecheck_${i}.tsx`;

export async function grade(level: CodeLevel, source: string, compile: Compile): Promise<Report> {
  const mainPath = `/${level.file}`;
  const files: Record<string, string> = { [mainPath]: source };
  (level.typeChecks ?? []).forEach((tc, i) => (files[typeCheckPath(i)] = tc.code));
  const { diagnostics, js } = await compile(files);

  const typeErrors = diagnostics.filter((d) => d.file === mainPath);
  const typeChecks: CheckOutcome[] = (level.typeChecks ?? []).map((tc, i) => {
    const errs = diagnostics.filter((d) => d.file === typeCheckPath(i));
    if (!errs.length) return { label: tc.label, pass: true };
    const unused = errs.find((d) => d.code === 2578);
    return {
      label: tc.label,
      pass: false,
      message: unused
        ? 'This should be rejected by the compiler, but your types allow it.'
        : `Your types reject code that should be allowed: ${errs[0].message}`,
    };
  });

  const logs: string[] = [];
  const sandbox = new Sandbox((l) => logs.push(l));
  let mod: Record<string, any>;
  try {
    mod = loadModule(js[mainPath], sandbox);
  } catch (e) {
    const loadError = errorText(e);
    return {
      js: js[mainPath], typeErrors, typeChecks, logs, loadError, passed: false,
      checks: level.checks.map((c) => ({ label: c.label, pass: false, message: 'Your code crashed before this could run.' })),
    };
  }

  const checks: CheckOutcome[] = [];
  for (const check of level.checks) {
    const stage = new Stage();
    const kit: Kit = { mod, source, h: createElement, expect, fn, wait, render: (el) => stage.render(el), activeTimers: () => sandbox.activeTimers };
    try {
      await withTimeout(Promise.resolve().then(() => check.run(kit)), CHECK_TIMEOUT_MS);
      checks.push({ label: check.label, pass: true });
    } catch (e) {
      checks.push({ label: check.label, pass: false, message: errorText(e) });
    } finally {
      stage.cleanup();
      sandbox.clearAll();
    }
  }

  const passed = !typeErrors.length && typeChecks.every((c) => c.pass) && checks.every((c) => c.pass);
  return { js: js[mainPath], typeErrors, typeChecks, checks, logs, passed };
}

function errorText(e: unknown): string {
  if (e instanceof CheckFailure) return e.message;
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return String(e);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new CheckFailure(`Timed out after ${ms / 1000}s — is something waiting forever?`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
