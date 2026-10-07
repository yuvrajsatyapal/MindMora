import 'server-only';
import { sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { getDatabase } from '../db/client';
import type { VerifiedOwner } from '../db/user-context';
import { HttpFailure } from '../http/errors';
import { normalizeTagKey, normalizeTitleKey } from '../../features/knowledge/syntax';
import type { CompleteInput, BacklinksInput, TagsInput, SearchInput } from '../../features/knowledge/types';
import { targetPageSchema, resolutionPageSchema, backlinksPageSchema, tagPageSchema, searchPageSchema } from '../../features/knowledge/types';
export function searchQueryKey(query:string, tag?:string) { return createHash('sha256').update(JSON.stringify([query.trim().toLowerCase(),tag ? normalizeTagKey(tag) : null])).digest('hex'); }
export function escapePrefix(value:string) { return value.replace(/[\\%_]/g,'\\$&')+'%'; }
const summary = sql`n.id, n.user_id AS "userId", n.title, n.revision`;
/** Every read explicitly restricts owner, deletion and current indexed revision. */
export function createKnowledgeRepository(database=getDatabase()) {
 return {
  async complete(owner:VerifiedOwner,input:CompleteInput) {
   return database.run(owner,async tx=>{
    const cursor=input.cursor;
    const rows=await tx.execute(sql`SELECT ${summary}, n.title_key AS "titleKey" FROM notes n WHERE n.user_id=${owner.userId} AND n.deleted_at IS NULL AND n.knowledge_revision=n.revision AND n.title_key LIKE ${escapePrefix(normalizeTitleKey(input.prefix))} ESCAPE '\\' ${cursor?sql`AND (n.title_key,n.id)>(${normalizeTitleKey(cursor.title)},${cursor.id}::uuid)`:sql``} ORDER BY n.title_key,n.id LIMIT ${input.limit+1}`);
    const last=rows[Math.min(rows.length,input.limit)-1];
    return targetPageSchema.parse({items:rows.slice(0,input.limit).map(row=>({id:row.id,userId:row.userId,title:row.title,revision:row.revision})),nextCursor:rows.length>input.limit&&last?{title:last.title,id:last.id}:null});
   });
  },
  async resolve(owner:VerifiedOwner,targets:string[]) {
   return database.run(owner,async tx=>{
    const keys=[...new Set(targets.map(normalizeTitleKey))];
    const rows=await tx.execute(sql`SELECT matches.* FROM (VALUES ${sql.join(keys.map(key=>sql`(${key}::text)`),sql`,`)}) AS target(key) CROSS JOIN LATERAL (SELECT ${summary}, n.title_key AS "key" FROM notes n WHERE n.user_id=${owner.userId} AND n.deleted_at IS NULL AND n.knowledge_revision=n.revision AND md5(n.title_key)=md5(target.key) AND n.title_key=target.key ORDER BY n.id LIMIT 2) matches`);
    return resolutionPageSchema.parse({items:targets.map(target=>{const key=normalizeTitleKey(target);const matches=rows.filter(row=>row.key===key);const status=matches.length===0?'missing':matches.length===1?'resolved':'ambiguous';const match=matches[0];return {target,key,status,note:status==='resolved'?{id:match.id,userId:match.userId,title:match.title,revision:match.revision}:null};})});
   });
  },
  async backlinks(owner:VerifiedOwner,id:string,input:BacklinksInput) {
   const result = await database.run(owner,async tx=>{
    const targets=await tx.execute(sql`SELECT revision,title_key AS key FROM notes WHERE user_id=${owner.userId} AND id=${id}::uuid AND deleted_at IS NULL AND knowledge_revision=revision`);
    if(!targets[0])return null;const target=targets[0];
    const duplicates=await tx.execute(sql`SELECT count(*)::integer AS count FROM notes WHERE user_id=${owner.userId} AND title_key=${target.key} AND deleted_at IS NULL AND knowledge_revision=revision`);
    if(duplicates[0].count!==1)return backlinksPageSchema.parse({targetRevision:target.revision,resolution:'ambiguous',total:0,items:[],nextCursor:null});
    const base=sql`FROM note_links l JOIN notes n ON n.id=l.source_note_id AND n.user_id=l.user_id AND n.revision=l.source_revision AND n.knowledge_revision=n.revision WHERE l.user_id=${owner.userId} AND n.user_id=${owner.userId} AND n.deleted_at IS NULL AND l.target_hash=public.mindmora_key_hash(${target.key}) AND l.target_key=${target.key}`;
    const counts=await tx.execute(sql`SELECT count(*)::integer AS count ${base}`);
    const rows=await tx.execute(sql`SELECT n.id AS "sourceId",n.title,l.source_revision AS "sourceRevision",l.occurrence_count AS "occurrenceCount",l.context ${base} ${input.cursor?sql`AND n.id>${input.cursor.sourceId}::uuid`:sql``} ORDER BY n.id LIMIT ${input.limit+1}`);
    const last=rows[Math.min(rows.length,input.limit)-1];return backlinksPageSchema.parse({targetRevision:target.revision,resolution:'resolved',total:counts[0].count,items:rows.slice(0,input.limit),nextCursor:rows.length>input.limit&&last?{sourceId:last.sourceId}:null});
   });
   if (!result) throw new HttpFailure('not_found');
   return result;
  },
  async tags(owner:VerifiedOwner,input:TagsInput) {
   return database.run(owner,async tx=>{
    const rows=await tx.execute(sql`SELECT t.tag_key AS key,(array_agg(t.display_name ORDER BY t.note_id))[1] AS "displayName",count(*)::integer AS "noteCount" FROM note_tags t JOIN notes n ON n.id=t.note_id AND n.user_id=t.user_id AND n.revision=t.source_revision AND n.knowledge_revision=n.revision WHERE t.user_id=${owner.userId} AND n.user_id=${owner.userId} AND n.deleted_at IS NULL ${input.cursor?sql`AND t.tag_key>${input.cursor.key}`:sql``} GROUP BY t.tag_key ORDER BY t.tag_key LIMIT ${input.limit+1}`);
    const last=rows[Math.min(rows.length,input.limit)-1];return tagPageSchema.parse({items:rows.slice(0,input.limit),nextCursor:rows.length>input.limit&&last?{key:last.key}:null});
   });
  },
  async search(owner:VerifiedOwner,input:SearchInput) {
   const query=input.query.trim();const queryKey=searchQueryKey(query,input.tag);const cursor=input.cursor;
   if(cursor&&(cursor.queryKey!==queryKey||(query? !('rank' in cursor):!('updatedAt' in cursor))))throw new HttpFailure('invalid_request');
   if(query&&!/[\p{L}\p{N}]/u.test(query))return searchPageSchema.parse({items:[],nextCursor:null});
   return database.run(owner,async tx=>{
    const tagMatch=(key:string)=>sql`EXISTS (SELECT 1 FROM note_tags t WHERE t.user_id=n.user_id AND t.note_id=n.id AND t.source_revision=n.revision AND t.tag_hash=public.mindmora_key_hash(${key}) AND t.tag_key=${key})`;
    const vector=query?sql`CASE WHEN n.search_vector IS NULL THEN public.mindmora_query_vector(n.title,n.content,${query}) ELSE n.search_vector END`:sql`coalesce(n.search_vector,''::tsvector)`;
    const rank=query?sql`ts_rank(search.vector,websearch_to_tsquery('simple',${query}))`:sql`0::real`;
    const match=query?sql`AND (search.vector @@ websearch_to_tsquery('simple',${query}) OR ${tagMatch(normalizeTagKey(query.replace(/^#/,'')))})`:sql``;
    const paging=cursor?('rank'in cursor?sql`AND (${rank}<${cursor.rank}::real OR (${rank}=${cursor.rank}::real AND n.id>${cursor.id}::uuid))`:sql`AND (n.updated_at,n.id)<(${cursor.updatedAt}::timestamptz,${cursor.id}::uuid)`):sql``;
    const rows=await tx.execute(sql`SELECT ${summary},n.created_at AS "createdAt",n.updated_at AS "updatedAt",n.deleted_at AS "deletedAt",left(n.content,240) AS snippet,${rank} AS rank FROM notes n CROSS JOIN LATERAL (SELECT ${vector} AS vector OFFSET 0) search WHERE n.user_id=${owner.userId} AND n.deleted_at IS NULL AND n.knowledge_revision=n.revision ${match} ${input.tag?sql`AND ${tagMatch(normalizeTagKey(input.tag))}`:sql``} ${paging} ORDER BY ${query?sql`${rank} DESC,n.id ASC`:sql`n.updated_at DESC,n.id DESC`} LIMIT ${input.limit+1}`);
    const last=rows[Math.min(rows.length,input.limit)-1];
    const iso=(value:unknown)=>value instanceof Date?value.toISOString():new Date(String(value)).toISOString();
    const items=rows.slice(0,input.limit).map(row=>({id:row.id,userId:row.userId,title:row.title,revision:row.revision,snippet:row.snippet,createdAt:iso(row.createdAt),updatedAt:iso(row.updatedAt),deletedAt:null}));
    return searchPageSchema.parse({items,nextCursor:rows.length>input.limit&&last?(query?{queryKey,rank:Number(last.rank),id:last.id}:{queryKey,updatedAt:iso(last.updatedAt),id:last.id}):null});
   });
  },
 };
}
export type KnowledgeRepository=ReturnType<typeof createKnowledgeRepository>;
