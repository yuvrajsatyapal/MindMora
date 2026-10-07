"use client";
import {Button,Alert} from "../../../components/ui/primitives";
import type {NoteScope} from "../../notes/api";
import type {KnowledgeApi} from "../api";
import {useTags} from "../hooks";
export function TagBrowser({scope,api,selected,onSelect}:{scope:NoteScope;api:KnowledgeApi;selected?:string;onSelect:(key?:string)=>void}){
 const tags=useTags(scope,api);
 return <section className="mm-stack" aria-label="Tags"><h2>Tags · committed notes</h2>
 {tags.isPending?<p role="status">Loading tags…</p>:tags.isError?<Alert title="Tags unavailable" tone="danger"><Button variant="secondary" onClick={()=>void tags.refetch()}>Retry tags</Button></Alert>:<ul className="mm-tag-list">{tags.data.pages.flatMap(page=>page.items).map(tag=><li key={tag.key}><Button variant="ghost" aria-pressed={selected===tag.key} onClick={()=>onSelect(selected===tag.key?undefined:tag.key)}>#{tag.displayName}<span className="mm-muted"> ({tag.noteCount})</span></Button></li>)}</ul>}
 {selected&&<Button variant="secondary" onClick={()=>onSelect(undefined)}>Clear tag filter</Button>}
 {tags.hasNextPage&&<Button variant="secondary" loading={tags.isFetchingNextPage} onClick={()=>void tags.fetchNextPage()}>Load more tags</Button>}
 </section>;
}
