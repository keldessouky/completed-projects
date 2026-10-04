// Renders the player's component live, in its own React root, so nothing the
// player writes can take the game's UI down with it.
import { Component, createElement, useEffect, useRef, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Sandbox, activity, loadModule } from '../engine/runtime';
import type { CodeLevel } from '../game/types';

interface Props {
  level: CodeLevel;
  js: string;
  runId: number;
  log(line: string): void;
}

class Boundary extends Component<{ children: ReactNode; onError(e: Error): void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.state.error ? <p className="preview-error">💥 {this.state.error.message}</p> : this.props.children;
  }
}

export function Preview({ level, js, runId, log }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const sandbox = new Sandbox(log);
    const mount = document.createElement('div');
    el.replaceChildren(mount);
    const root = createRoot(mount, { onUncaughtError: (e) => log(`✖ ${(e as Error).message ?? e}`) });
    const onSubmit = (e: Event) => {
      if (!e.defaultPrevented) log('⚠ The form tried to reload the page. Call event.preventDefault() in onSubmit.');
      e.preventDefault();
    };
    const onError = (e: ErrorEvent) => {
      if (activity.stages > 0) return; // a check is running; the error is its to report
      e.preventDefault();
      log(`✖ ${e.message}`);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (activity.stages > 0) return;
      e.preventDefault();
      log(`✖ Unhandled promise rejection: ${e.reason instanceof Error ? e.reason.message : String(e.reason)}`);
    };
    mount.addEventListener('submit', onSubmit);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    try {
      const mod = loadModule(js, sandbox);
      const node = level.preview?.(mod, createElement, log) ?? null;
      root.render(<Boundary onError={(e) => log(`✖ ${e.message}`)}>{node}</Boundary>);
    } catch (e) {
      root.render(<p className="preview-error">💥 {(e as Error).message}</p>);
    }
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      sandbox.clearAll();
      // Unmount after the current render pass finishes.
      setTimeout(() => root.unmount());
    };
    // Re-mount on every run, even if the code is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [js, runId]);

  return <div className="preview-surface" ref={host} />;
}
