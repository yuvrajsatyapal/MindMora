"use client";
import {useEffect,useRef,useState} from "react";
import {Button,Alert} from "../../../components/ui/primitives";
import type {KnowledgeApi} from "../api";
import type {NotesApi,NoteScope} from "../../notes/api";
import type {Note} from "../../notes/types";
import type {Resolution} from "../types";
export function useWikiNavigation({api,notesApi,scope,onSelect,onCreated}:{api:KnowledgeApi;notesApi:NotesApi;scope:NoteScope;onSelect:(id:string)=>void;onCreated:(note:Note)=>void}){
 const [resolution,setResolution]=useState<Resolution|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[operationPending,setOperationPending]=useState(false);
 const mounted=useRef(true),locked=useRef(false);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 function active(){scope.assertActive();if(!mounted.current)throw Error("Reference controller closed.");}
 const operation=useRef<{key:string;input:{title:string;content:string}}|null>(null),sequence=useRef(0);
 async function activate(target:string){
  if(locked.current||operation.current){setMessage("Finish or retry the pending create before following another reference.");return;}
  const request=++sequence.current;locked.current=true;setBusy(true);setMessage("");setResolution(null);
  try{const result=(await api.resolve([target])).items[0];active();if(request!==sequence.current)return;setResolution(result);if(result.status==="resolved")onSelect(result.note.id);}
  catch(error){try{active();setMessage(error instanceof Error?error.message:"Reference unavailable.");}catch{/* Session or editor lease ended; discard late result. */}}
  finally{try{active();if(request===sequence.current){locked.current=false;setBusy(false);}}catch{/* Session or editor lease ended; discard late result. */}}
 }
 async function create(){
  if(locked.current||(!operation.current&&resolution?.status!=="missing"))return;
  locked.current=true;setBusy(true);setMessage("");
  try{
   if(!operation.current){
    const target=resolution!.target,result=(await api.resolve([target])).items[0];active();setResolution(result);
    if(result.status!=="missing"){if(result.status==="resolved")onSelect(result.note.id);return;}
    if(!window.confirm(`Create note “${target}”?`))return;
    operation.current={key:crypto.randomUUID(),input:{title:target,content:""}};setOperationPending(true);
   }
   const pending=operation.current,note=await notesApi.create(pending.input,pending.key);active();onCreated(note);
   const result=(await api.resolve([pending.input.title])).items[0];active();setResolution(result);operation.current=null;setOperationPending(false);
   if(result.status==="resolved")onSelect(result.note.id);
  }catch(error){try{active();setMessage(error instanceof Error?error.message:"Creation could not be confirmed. Retry uses the same operation.");}catch{/* Session or editor lease ended; discard late result. */}}
  finally{try{active();locked.current=false;setBusy(false);}catch{/* Session or editor lease ended; discard late result. */}}
 }
 const panel=<div className="mm-wiki-status" aria-live="polite">
  {busy&&<p role="status">Checking reference…</p>}
  {resolution?.status==="missing"&&<><p>Missing note: {resolution.target}</p><Button variant="secondary" disabled={busy} onClick={()=>void create()}>{operationPending?"Retry create":`Create “${resolution.target}”`}</Button></>}
  {resolution?.status==="ambiguous"&&<Alert title="Ambiguous title">Multiple notes match “{resolution.target}”. Rename duplicate titles to make this portable reference unique.</Alert>}
  {message&&<Alert title="Reference needs attention" tone="danger">{message}{operationPending&&resolution?.status!=="missing"&&<Button disabled={busy} onClick={()=>void create()}>Retry create</Button>}</Alert>}
 </div>;
 return {activate,panel};
}
