import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';
import { useEffect, useRef } from 'react';
import type { Diagnostic } from '../engine/checker';

interface Props {
  value: string;
  tsx: boolean;
  diagnostics: Diagnostic[];
  onChange(value: string): void;
  onRun(): void;
}

export function CodeEditor({ value, tsx, diagnostics, onChange, onRun }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // Latest callbacks, so the editor (created once) never calls stale ones.
  const handlers = useRef({ onChange, onRun });
  handlers.current = { onChange, onRun };

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
          autocompletion(),
          syntaxHighlighting(classHighlighter),
          javascript({ typescript: true, jsx: tsx }),
          lintGutter(),
          EditorState.tabSize.of(2),
          EditorView.lineWrapping,
          keymap.of([
            { key: 'Mod-Enter', run: () => (handlers.current.onRun(), true) },
            { key: 'Mod-s', run: () => (handlers.current.onRun(), true) },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) handlers.current.onChange(u.state.doc.toString());
          }),
          EditorView.contentAttributes.of({ 'aria-label': 'Code editor', spellcheck: 'false' }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
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
