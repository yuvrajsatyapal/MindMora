"use client";
import {useEffect,useState} from "react";
import {Button,Alert,TextField} from "../../../components/ui/primitives";
import type {NoteScope} from "../../notes/api";
import type {KnowledgeApi} from "../api";
import {useKnowledgeSearch} from "../hooks";
import {TagBrowser} from "./TagBrowser";
export function KnowledgeSearch({scope,api,onSelect}:{scope:NoteScope;api:KnowledgeApi;onSelect:(id:string)=>void}){
 const [input,setInput]=useState(""),[query,setQuery]=useState(""),[tag,setTag]=useState<string|undefined>();
 useEffect(()=>{const timer=setTimeout(()=>setQuery(input),250);return()=>clearTimeout(timer);},[input]);
 const results=useKnowledgeSearch(scope,api,query,tag),updating=input!==query;
 const notes=results.data?[...new Map(results.data.pages.flatMap(page=>page.items).map(note=>[note.id,note])).values()]:[];
 return <section className="mm-stack" aria-label="Knowledge search">
 <TextField label="Search all notes" value={input} onChange={event=>setInput([...event.target.value].slice(0,256).join(""))} placeholder="Titles, content and tags"/>
 {input&&<Button variant="secondary" onClick={()=>{setInput("");setQuery("");}}>Clear search</Button>}
 <TagBrowser scope={scope} api={api} selected={tag} onSelect={setTag}/>
 <h2>Your notes</h2><p className="mm-muted">Search covers committed notes across your account.</p>
 {results.isPending||updating?<p role="status">Searching notes…</p>:results.isError?<Alert title="Search unavailable" tone="danger"><Button variant="secondary" onClick={()=>void results.refetch()}>Retry search</Button></Alert>:<><p role="status">{notes.length?`${notes.length} notes loaded`:"No matching notes."}</p><ul className="mm-search-results">{notes.map(note=><li key={note.id}><Button variant="ghost" onClick={()=>onSelect(note.id)}>{note.title||"Untitled note"}</Button>{note.snippet&&<p>{note.snippet}</p>}</li>)}</ul></>}
 {!updating&&results.hasNextPage&&<Button variant="secondary" loading={results.isFetchingNextPage} onClick={()=>void results.fetchNextPage()}>Load more results</Button>}
 </section>;
}
