"use client";
import {Button,Alert} from "../../../components/ui/primitives";
import type {NoteScope} from "../../notes/api";
import type {KnowledgeApi} from "../api";
import {useBacklinks} from "../hooks";
export function BacklinksPanel({scope,api,id,onSelect}:{scope:NoteScope;api:KnowledgeApi;id:string;onSelect:(id:string)=>void}){
 const links=useBacklinks(scope,api,id),first=links.data?.pages[0];
 return <details className="mm-backlinks" open><summary>Backlinks</summary><p className="mm-muted">Committed references. Renaming a title does not rewrite other notes.</p>
 {links.isPending?<p role="status">Loading backlinks…</p>:links.isError?<Alert title="Backlinks unavailable" tone="danger"><Button variant="secondary" onClick={()=>void links.refetch()}>Retry backlinks</Button></Alert>:first?.resolution==="ambiguous"?<p role="status">This title is ambiguous; incoming references cannot be assigned to one duplicate.</p>:<><p role="status">{first?.total??0} incoming notes</p><ul className="mm-backlink-list">{links.data?.pages.flatMap(page=>page.items).map(link=><li key={link.sourceId}><Button variant="ghost" onClick={()=>onSelect(link.sourceId)}>{link.title||"Untitled note"}</Button><p>{link.context}</p><span className="mm-muted">{link.occurrenceCount} occurrences · revision {link.sourceRevision}</span></li>)}</ul></>}
 {links.hasNextPage&&<Button variant="secondary" loading={links.isFetchingNextPage} onClick={()=>void links.fetchNextPage()}>Load more backlinks</Button>}
 </details>;
}
