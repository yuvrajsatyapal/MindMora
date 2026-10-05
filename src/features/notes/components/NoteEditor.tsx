"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Note } from "../types";
import type { NotesApi } from "../api";
import { Button, TextField, Alert } from "../../../components/ui/primitives";
import { SaveStatus, type SaveState } from "../../../components/mindmora";
import { PreviewBoundary } from "../../editor/components/PreviewBoundary";
import { useNoteAutosave } from "../../editor/use-note-autosave";
import { CodeMirrorEditor, type EditorHandle } from "../../editor/components/CodeMirrorEditor";
import { EditorToolbar, type EditorMode } from "../../editor/components/EditorToolbar";
const MarkdownPreview = dynamic(()=>import("../../editor/components/MarkdownPreview").then(module=>module.MarkdownPreview), {ssr:false,loading:()=> <p role="status">Loading preview…</p>});
export function NoteEditor({note,api,onSaved,onDeleted,onDirty,unavailable=false,nonce}: {
 note:Note|null;api:NotesApi;onSaved:(note:Note)=>void;onDeleted:()=>void;onDirty:(dirty:boolean)=>void;unavailable?:boolean;nonce?:string;
}) {
 const editor=useNoteAutosave({note,api,onSaved,onDeleted,onDirty,unavailable});
 const [mode,setMode]=useState<EditorMode>("edit");
 const handle=useRef<EditorHandle|null>(null);
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{root.current?.querySelector<HTMLInputElement>("input")?.focus();},[]);
 const state:SaveState=editor.phase==="clean"?"saved":editor.phase==="saving"||editor.phase==="reconciling"?"saving":editor.phase==="dirty"?"unsaved":"error";
 return <section ref={root} className="mm-stack mm-note-editor" aria-label="Note editor">
  <div className="mm-editor-heading"><h2>{editor.base?"Edit note":"New note"}</h2><span className="mm-muted">Markdown</span></div>
  <p className="mm-muted">Autosave confirms server commits. Unsaved drafts stay in this tab; closing or reloading can discard them.</p>
  <TextField label="Title" placeholder="Untitled note" value={editor.draft.title} onChange={event=>editor.setTitle(event.target.value)} onCompositionStart={()=>editor.setComposing(true)} onCompositionEnd={()=>editor.setComposing(false)} />
  <EditorToolbar mode={mode} setMode={setMode} handle={handle}/>
  <div className="mm-editor-panes" data-mode={mode}>
   <div hidden={mode==="preview"} className="mm-source-pane"><span className="mm-muted">Source</span><CodeMirrorEditor value={editor.draft.content} onChange={editor.setContent} nonce={nonce} handle={handle} onSave={()=>void editor.saveNow()} onComposing={editor.setComposing}/></div>
   {mode!=="edit"&&<section className="mm-preview-pane" aria-label="Markdown preview"><span className="mm-muted">Preview · current draft</span><PreviewBoundary><MarkdownPreview content={editor.draft.content} nonce={nonce}/></PreviewBoundary></section>}
  </div>
  <div className="mm-workspace-actions mm-editor-actions">
   <SaveStatus state={state}/>
   <Button onClick={()=>void editor.saveNow()} disabled={editor.busy||editor.phase==="unavailable"||editor.phase==="conflict"||editor.cooldownSeconds>0||(!editor.dirty&&!!editor.base)}>Save note</Button>
   {(editor.phase==="paused"||editor.phase==="invalid")&&<Button variant="secondary" disabled={editor.busy||editor.cooldownSeconds>0} onClick={()=>void editor.retry()}>Retry save</Button>}
   {editor.base&&<Button variant="danger" disabled={editor.phase==="unavailable"} onClick={()=>void editor.remove()}>Delete note</Button>}
  </div>
  {editor.cooldownSeconds>0&&<p role="status">Retry available in {editor.cooldownSeconds} seconds.</p>}
  {editor.message&&<Alert title={editor.phase==="unavailable"?"Note no longer available":"Note needs attention"} tone="danger" urgent>{editor.message}</Alert>}
  {editor.latest&&<div className="mm-stack">
   <h3>Current server version (revision {editor.latest.revision})</h3><p>{editor.latest.title}</p><pre className="mm-server-version">{editor.latest.content}</pre>
   <div className="mm-workspace-actions"><Button variant="secondary" onClick={editor.useServerVersion}>Use server version</Button><Button onClick={editor.keepDraft}>Keep draft with latest revision</Button></div>
  </div>}
 </section>;
}
