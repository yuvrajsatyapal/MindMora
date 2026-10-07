"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { Note } from "../types";
import type {KnowledgeApi} from "../../knowledge/api";
import {extractKnowledge} from "../../knowledge/syntax";
import {PREVIEW_BYTES} from "../../editor/markdown";
import type { NotesApi } from "../api";
import { Button, TextField, Alert } from "../../../components/ui/primitives";
import { SaveStatus, type SaveState } from "../../../components/mindmora";
import { PreviewBoundary } from "../../editor/components/PreviewBoundary";
import { useNoteAutosave } from "../../editor/use-note-autosave";
import { CodeMirrorEditor, type EditorHandle } from "../../editor/components/CodeMirrorEditor";
import { EditorToolbar, type EditorMode } from "../../editor/components/EditorToolbar";
const MarkdownPreview = dynamic(()=>import("../../editor/components/MarkdownPreview").then(module=>module.MarkdownPreview), {ssr:false,loading:()=> <p role="status">Loading preview…</p>});
export type NoteEditorProps={note:Note|null;api:NotesApi;onSaved:(note:Note)=>void;onDeleted:()=>void;onDirty:(dirty:boolean)=>void;unavailable?:boolean;nonce?:string;knowledgeApi?:KnowledgeApi;onWikiLink?:(target:string)=>void;children?:ReactNode;};
export function NoteEditor({note,api,onSaved,onDeleted,onDirty,unavailable=false,nonce,knowledgeApi,onWikiLink,children}:NoteEditorProps) {
 const editor=useNoteAutosave({note,api,onSaved,onDeleted,onDirty,unavailable});
 const [mode,setMode]=useState<EditorMode>("edit");
 const [draftTags,setDraftTags]=useState<{source:string;tags:string[];limited:boolean}|null>(null);
 useEffect(()=>{if(!knowledgeApi)return;const source=editor.draft.content;const timer=setTimeout(()=>{
  const limited=new TextEncoder().encode(source).length>PREVIEW_BYTES||(source.match(/[*_~`[\]{}<>|$]/g)?.length??0)>2000||(source.match(/\n/g)?.length??0)>=5000;
  setDraftTags({source,limited,tags:limited?[]:extractKnowledge(source).tags.map(tag=>tag.displayName)});
 },250);return()=>clearTimeout(timer);},[editor.draft.content,knowledgeApi]);
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
   <div hidden={mode==="preview"} className="mm-source-pane"><span className="mm-muted">Source</span><CodeMirrorEditor value={editor.draft.content} onChange={editor.setContent} nonce={nonce} handle={handle} onSave={()=>void editor.saveNow()} onComposing={editor.setComposing} knowledgeApi={knowledgeApi}/></div>
   {mode!=="edit"&&<section className="mm-preview-pane" aria-label="Markdown preview"><span className="mm-muted">Preview · current draft</span><PreviewBoundary><MarkdownPreview content={editor.draft.content} nonce={nonce} onWikiLink={onWikiLink}/></PreviewBoundary></section>}
  </div>
  {knowledgeApi&&<div className="mm-draft-tags"><span className="mm-muted">Tags · current draft (provisional)</span><ul className="mm-tag-list">{draftTags?.source===editor.draft.content&&draftTags.tags.map(tag=><li key={tag}>#{tag}</li>)}</ul>{draftTags?.source===editor.draft.content&&draftTags.limited&&<p className="mm-muted">Draft tag preview limit reached; committed tags remain searchable after save.</p>}</div>}
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
  {children}
 </section>;
}
