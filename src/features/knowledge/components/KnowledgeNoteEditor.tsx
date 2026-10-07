"use client";
import {NoteEditor,type NoteEditorProps} from "../../notes/components/NoteEditor";
import type {NoteScope} from "../../notes/api";
import type {KnowledgeApi} from "../api";
import {useWikiNavigation} from "./WikiLink";
import {BacklinksPanel} from "./BacklinksPanel";
export function KnowledgeNoteEditor({scope,knowledgeApi,onSelect,onCreated,...props}:NoteEditorProps&{scope:NoteScope;knowledgeApi:KnowledgeApi;onSelect:(id:string)=>void;onCreated:NonNullable<NoteEditorProps["onSaved"]>}){
 const wiki=useWikiNavigation({api:knowledgeApi,notesApi:props.api,scope,onSelect,onCreated});
 return <NoteEditor {...props} knowledgeApi={knowledgeApi} onWikiLink={target=>void wiki.activate(target)}>{wiki.panel}{props.note&&<BacklinksPanel scope={scope} api={knowledgeApi} id={props.note.id} onSelect={onSelect}/>}</NoteEditor>;
}
