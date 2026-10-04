import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { forEachDiagnostic, lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, hoverTooltip, keymap, lineNumbers } from '@codemirror/view';
import { tsxLanguage } from '@codemirror/lang-javascript';
import { classHighlighter, highlightCode } from '@lezer/highlight';
import { useEffect, useRef } from 'react';
import type { Diagnostic } from '../engine/checker';
import { completions, quickInfo } from '../engine/compiler';
import { isTouch } from './device';

interface Props {
  value: string;
  /** The file's path for the compiler, e.g. "/solution.tsx". */
  path: string;
  tsx: boolean;
  diagnostics: Diagnostic[];
  onChange(value: string): void;
  onRun(): void;
  /** The live editor, for the phone symbol bar. */
  onView?(view: EditorView | null): void;
  onFocusChange?(focused: boolean): void;
  /**
   * Touch screens have no hover, so tapping a name reports its type (or, on a
   * red squiggle, the error) here instead.
   */
  onTapInfo?(info: { kind: 'type' | 'error'; text: string } | null): void;
}

// TypeScript's completion kinds → CodeMirror's icon types.
const KIND: Record<string, string> = {
  function: 'function', 'local function': 'function', method: 'method', property: 'property', getter: 'property', setter: 'property',
  var: 'variable', let: 'variable', const: 'constant', 'local var': 'variable', parameter: 'variable', alias: 'variable',
  class: 'class', interface: 'interface', type: 'type', 'type parameter': 'type', enum: 'enum', 'enum member': 'enum',
  module: 'namespace', keyword: 'keyword', 'JSX attribute': 'property',
};

/** A hover card: the type signature, highlighted like the editor, plus any docs. */
function typeCard(signature: string, doc: string) {
  const dom = document.createElement('div');
  dom.className = 'cm-type-tip';
  const pre = document.createElement('pre');
  highlightCode(
    signature,
    tsxLanguage.parser.parse(signature),
    classHighlighter,
    (text, classes) => {
      const span = document.createElement('span');
      if (classes) span.className = classes;
      span.textContent = text;
      pre.appendChild(span);
    },
    () => pre.appendChild(document.createTextNode('\n')),
  );
  dom.appendChild(pre);
  if (doc) {
    const p = document.createElement('p');
    p.textContent = doc;
    dom.appendChild(p);
  }
  return dom;
}

export function CodeEditor({ value, path, tsx, diagnostics, onChange, onRun, onView, onFocusChange, onTapInfo }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // Latest callbacks, so the editor (created once) never calls stale ones.
  const handlers = useRef({ onChange, onRun, onFocusChange, onTapInfo, path });
  handlers.current = { onChange, onRun, onFocusChange, onTapInfo, path };
  const tapTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion({
            override: [
              async (ctx: CompletionContext): Promise<CompletionResult | null> => {
                const word = ctx.matchBefore(/[\w$]*/);
                if (!word) return null;
                const afterDot = ctx.state.sliceDoc(word.from - 1, word.from) === '.';
                if (word.from === word.to && !afterDot && !ctx.explicit) return null;
                const file = handlers.current.path;
                const items = await completions({ [file]: ctx.state.doc.toString() }, file, ctx.pos).catch(() => []);
                if (ctx.aborted || !items.length) return null;
                return {
                  from: word.from,
                  validFor: /^[\w$]*$/,
                  options: items.map((c) => ({
                    label: c.name,
                    type: KIND[c.kind] ?? 'text',
                    boost: Math.max(-99, 40 - (parseInt(c.sort, 10) || 20) * 3),
                  })),
                };
              },
            ],
          }),
          // Hover any name to see its type — the compiler's view of your code.
          hoverTooltip(async (v, pos) => {
            const file = handlers.current.path;
            const info = await quickInfo({ [file]: v.state.doc.toString() }, file, pos).catch(() => null);
            if (!info) return null;
            return { pos: info.from, end: info.to, above: true, create: () => ({ dom: typeCard(info.signature, info.doc) }) };
          }),
          syntaxHighlighting(classHighlighter),
          javascript({ typescript: true, jsx: tsx }),
          lintGutter(),
          EditorState.tabSize.of(2),
          EditorView.lineWrapping,
          keymap.of([
            // ⌘↵ on a Mac, Ctrl+↵ elsewhere — and Ctrl+↵ on a Mac too, for muscle memory.
            { key: 'Mod-Enter', run: () => (handlers.current.onRun(), true) },
            { key: 'Ctrl-Enter', run: () => (handlers.current.onRun(), true) },
            { key: 'Mod-s', run: () => (handlers.current.onRun(), true) },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) handlers.current.onChange(u.state.doc.toString());
            if (u.focusChanged) handlers.current.onFocusChange?.(u.view.hasFocus);
            // A tap that moves the cursor: say what's under it (the touch-screen hover).
            const tap = u.transactions.some((t) => t.isUserEvent('select.pointer'));
            if (tap && isTouch() && handlers.current.onTapInfo) {
              const pos = u.state.selection.main.head;
              window.clearTimeout(tapTimer.current);
              tapTimer.current = window.setTimeout(async () => {
                let error: string | null = null;
                forEachDiagnostic(u.state, (d, from, to) => {
                  if (!error && pos >= from && pos <= to) error = d.message;
                });
                if (error) return handlers.current.onTapInfo?.({ kind: 'error', text: error });
                const file = handlers.current.path;
                const info = await quickInfo({ [file]: u.state.doc.toString() }, file, pos).catch(() => null);
                handlers.current.onTapInfo?.(info ? { kind: 'type', text: info.signature } : null);
              }, 200);
            }
          }),
          EditorView.contentAttributes.of({ 'aria-label': 'Code editor', spellcheck: 'false' }),
        ],
      }),
    });
    view.current = v;
    onView?.(v);
    return () => {
      onView?.(null);
      v.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tsx]);

  // Outside changes (reset, load solution) replace the document.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const len = v.state.doc.length;
    const cm: CmDiagnostic[] = diagnostics
      .filter((d) => d.from <= len)
      .map((d) => ({ from: d.from, to: Math.min(d.to, len), severity: 'error', message: d.message }));
    v.dispatch(setDiagnostics(v.state, cm));
  }, [diagnostics]);

  return <div className="editor" ref={host} />;
}
