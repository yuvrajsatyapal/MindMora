import 'server-only';
import { and, eq } from 'drizzle-orm';
import type { getDatabase } from '../db/client';
import { noteLinks, noteTags } from '../db/schema';
import { extractKnowledge, normalizeTitleKey } from '../../features/knowledge/syntax';
export type KnowledgeDerivation = ReturnType<typeof deriveKnowledge>;
export function deriveKnowledge(title:string,content:string) { return {titleKey:normalizeTitleKey(title), ...extractKnowledge(content)}; }
type Transaction = Parameters<Parameters<ReturnType<typeof getDatabase>['run']>[1]>[0];
/** Operates on the canonical write transaction; failure rolls back both sides. */
export async function replaceKnowledge(tx:Transaction, source:{id:string;userId:string;revision:number;updatedAt:Date}, derivation:KnowledgeDerivation|null) {
 await tx.delete(noteLinks).where(and(eq(noteLinks.userId,source.userId),eq(noteLinks.sourceNoteId,source.id)));
 await tx.delete(noteTags).where(and(eq(noteTags.userId,source.userId),eq(noteTags.noteId,source.id)));
 if(!derivation)return;
 for(let offset=0;offset<derivation.links.length;offset+=500) await tx.insert(noteLinks).values(derivation.links.slice(offset,offset+500).map(link=>({...link,userId:source.userId,sourceNoteId:source.id,sourceRevision:source.revision,updatedAt:source.updatedAt})));
 for(let offset=0;offset<derivation.tags.length;offset+=500) await tx.insert(noteTags).values(derivation.tags.slice(offset,offset+500).map(tag=>({...tag,userId:source.userId,noteId:source.id,sourceRevision:source.revision,updatedAt:source.updatedAt})));
}
