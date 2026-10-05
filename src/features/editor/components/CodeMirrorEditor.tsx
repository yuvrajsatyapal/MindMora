"use client";
import { useEffect, useRef, type RefObject } from "react";
import { Annotation, EditorState } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
export type FormatAction = "heading" | "bold" | "italic" | "list" | "checklist" | "quote" | "link" | "code";
export type EditorHandle = { format: (action: FormatAction) => void; focus: () => void };
const external = Annotation.define<boolean>();
const syntax = HighlightStyle.define([
  { tag: tags.heading, color: "var(--accent-text)", fontWeight: "600" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: [tags.url, tags.link], color: "var(--accent-text)" },
  { tag: tags.monospace, color: "var(--text-muted)" },
]);
const wrappers: Record<FormatAction, [string, string, string]> = {
  heading: ["## ", "", "Heading"], bold: ["**", "**", "bold text"],
  italic: ["*", "*", "italic text"], list: ["- ", "", "List item"],
  checklist: ["- [ ] ", "", "Task"], quote: ["> ", "", "Quote"],
  link: ["[", "](https://example.com)", "link text"], code: ["```\n", "\n```", "code"],
};
export function CodeMirrorEditor({ value, onChange, nonce, onSave, onComposing, handle: handleRef }: {
  value: string; onChange: (value: string) => void; nonce?: string;
  onSave: () => void; onComposing?: (value: boolean) => void;
  handle?: RefObject<EditorHandle | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({onChange, onSave, onComposing});
  useEffect(() => { callbacks.current = {onChange, onSave, onComposing}; });
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({ parent: host.current, state: EditorState.create({
      doc: value,
      extensions: [markdown(), history(), highlightActiveLine(), EditorView.lineWrapping,
        syntaxHighlighting(syntax), EditorView.cspNonce.of(nonce ?? ""),
        EditorView.contentAttributes.of({ "aria-label": "Markdown content", "aria-multiline": "true", role: "textbox" }),
        keymap.of([{key: "Mod-s", preventDefault: true, run: () => {callbacks.current.onSave(); return true;}}, ...defaultKeymap, ...historyKeymap]),
        EditorView.domEventHandlers({
          compositionstart: () => { callbacks.current.onComposing?.(true); return false; },
          compositionend: () => { callbacks.current.onComposing?.(false); return false; },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !update.transactions.some((transaction) => transaction.annotation(external)))
            callbacks.current.onChange(update.state.doc.toString());
        }),
      ],
    }) });
    view.current = editor;
    if (handleRef) handleRef.current = {
      focus: () => editor.focus(),
      format: (action) => {
        const {from, to} = editor.state.selection.main;
        const [before, after, placeholder] = wrappers[action];
        const selected = editor.state.sliceDoc(from, to) || placeholder;
        editor.dispatch({changes: {from, to, insert: before + selected + after},
          selection: {anchor: from + before.length, head: from + before.length + selected.length}, userEvent: "input"});
        editor.focus();
      },
    };
    return () => { editor.destroy(); view.current = null; if (handleRef) handleRef.current = null; };
    // A view belongs to one mounted editor lease, not each draft render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, handleRef]);
  useEffect(() => {
    const editor = view.current;
    if (editor && value !== editor.state.doc.toString()) editor.dispatch({
      changes: {from: 0, to: editor.state.doc.length, insert: value},
      annotations: [external.of(true)],
    });
  }, [value]);
  return <div ref={host} className="mm-code-editor" />;
}
