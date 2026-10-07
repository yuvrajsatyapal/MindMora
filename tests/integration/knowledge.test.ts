import { beforeAll, afterAll, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../src/server/db/client';
import { getDatabaseConfig,getMigrationConfig } from '../../src/server/db/config';
import { verifyDatabaseSession,type VerifiedOwner } from '../../src/server/db/user-context';
import { createNoteRepository } from '../../src/server/notes/repository';
import { createKnowledgeRepository } from '../../src/server/knowledge/repository';
import { backfillKnowledge } from '../../scripts/backfill-knowledge.mjs';
const config=getMigrationConfig();const admin=postgres(config.url,{max:1,prepare:false,ssl:config.ssl?{rejectUnauthorized:true,ca:config.ca}:false,onnotice:()=>{}});
const db=createDatabase(getDatabaseConfig());const notes=createNoteRepository(db),knowledge=createKnowledgeRepository(db);const ids=[randomUUID(),randomUUID()];let a:VerifiedOwner,b:VerifiedOwner;
async function owner(id:string){return (await verifyDatabaseSession(new Request('http://localhost:3000',{headers:{cookie:`mindmora-session=${Buffer.from(JSON.stringify({accessToken:'fixture',refreshToken:'fixture',expiresAt:Math.floor(Date.now()/1000)+3600})).toString('base64url')}`}}),{config:{appOrigin:'http://localhost:3000',supabaseUrl:'https://fixture.supabase.co',publishableKey:'sb_publishable_fixture'},fetcher:async()=>Response.json({id,aud:'authenticated',role:'authenticated',email:'fixture@example.invalid',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()})})).owner;}
async function create(who:VerifiedOwner,title:string,content=''){const outcome=await notes.create(who,null,{title,content},randomUUID());if(outcome.kind!=='note')throw Error('fixture failed');return outcome.row;}
beforeAll(async()=>{await admin`INSERT INTO auth.users(id) VALUES(${ids[0]}),(${ids[1]})`;a=await owner(ids[0]);b=await owner(ids[1]);});
afterAll(async()=>{await db.close();await admin`DELETE FROM note_links WHERE user_id IN(${ids[0]},${ids[1]})`;await admin`DELETE FROM note_tags WHERE user_id IN(${ids[0]},${ids[1]})`;await admin`DELETE FROM auth.users WHERE id IN(${ids[0]},${ids[1]})`;await admin.end({timeout:5});});
it('indexes committed writes, isolates owners, preserves partial updates and rejects stale writes',async()=>{
 const target=await create(a,'Ｔarget');const source=await create(a,'Source','[[Target]] twice [[Target|label]] #Été secretword');await create(b,'Target','foreignword #foreign');
 expect((await knowledge.resolve(a,[' target '])).items[0]).toMatchObject({status:'resolved',note:{id:target.id}});
 expect((await knowledge.backlinks(a,target.id,{limit:20}))).toMatchObject({total:1,items:[{sourceId:source.id,occurrenceCount:2,sourceRevision:1}]});
 expect((await knowledge.tags(a,{limit:20})).items).toEqual([{key:'été',displayName:'Été',noteCount:1}]);
 await notes.update(a,null,source.id,{title:'Renamed source',expectedRevision:1});
 expect((await knowledge.backlinks(a,target.id,{limit:20})).items[0].sourceRevision).toBe(2);
 expect((await knowledge.tags(a,{limit:20})).items).toEqual([{key:'été',displayName:'Été',noteCount:1}]);
 expect((await notes.update(a,null,source.id,{content:'#wrong',expectedRevision:1})).kind).toBe('revision_conflict');
 expect((await knowledge.search(a,{query:'secretword',limit:20})).items.map(n=>n.id)).toEqual([source.id]);
 expect((await knowledge.search(a,{query:'foreignword',limit:20})).items).toEqual([]);
 expect((await knowledge.search(a,{query:'été',limit:20})).items.map(n=>n.id)).toEqual([source.id]);
 await create(a,'target');expect((await knowledge.resolve(a,['Target'])).items[0].status).toBe('ambiguous');expect((await knowledge.backlinks(a,target.id,{limit:20})).total).toBe(0);
 await notes.remove(a,null,source.id,{expectedRevision:2});expect((await knowledge.tags(a,{limit:20})).items).toEqual([]);expect(await admin`SELECT * FROM note_links WHERE source_note_id=${source.id}`).toHaveLength(0);
});
it('enforces derived RLS source owner, revision, deletion and direct-role privilege checks',async()=>{
 const foreign=await create(b,'Foreign');const own=await create(a,'Own');
 await db.run(a,async tx=>{for(const table of ['note_links','note_tags']){const rows=await tx.execute(sql`SELECT user_id FROM ${sql.identifier(table)}`);expect(rows.every(row=>row.user_id===a.userId)).toBe(true);}});
 for(const source of [foreign.id,randomUUID()])await expect(db.run(a,tx=>tx.execute(sql`INSERT INTO note_links(user_id,source_note_id,target_key,target_title,source_revision,occurrence_count,context) VALUES(${a.userId},${source},'bad','bad',1,1,'')`))).rejects.toThrow();
 for(const source of [foreign.id,randomUUID()])await expect(db.run(a,tx=>tx.execute(sql`INSERT INTO note_tags(user_id,note_id,tag_key,display_name,source_revision) VALUES(${a.userId},${source},'bad','bad',1)`))).rejects.toThrow();
 await expect(db.run(a,tx=>tx.execute(sql`INSERT INTO note_tags(user_id,note_id,tag_key,display_name,source_revision) VALUES(${a.userId},${own.id},'bad','bad',2)`))).rejects.toThrow();
 await notes.remove(a,null,own.id,{expectedRevision:1});await expect(db.run(a,tx=>tx.execute(sql`INSERT INTO note_tags(user_id,note_id,tag_key,display_name,source_revision) VALUES(${a.userId},${own.id},'bad','bad',2)`))).rejects.toThrow();
 await admin`GRANT SELECT ON note_tags TO mindmora_app`;try{await expect(knowledge.tags(a,{limit:20})).rejects.toThrow();}finally{await admin`REVOKE SELECT ON note_tags FROM mindmora_app`;}
});
it('backfills legacy notes twice without changing canonical revision or timestamps',async()=>{
 const id=randomUUID();await admin`INSERT INTO profiles(user_id) VALUES(${a.userId}) ON CONFLICT DO NOTHING`;await admin`INSERT INTO notes(id,user_id,title,content) VALUES(${id},${a.userId},'Legacy','[[Own]] #legacy')`;
 const [before]=await admin`SELECT revision,updated_at FROM notes WHERE id=${id}`;
 await backfillKnowledge(admin);await backfillKnowledge(admin);
 const [after]=await admin`SELECT revision,updated_at,knowledge_revision,title_key FROM notes WHERE id=${id}`;
 expect(after).toMatchObject({revision:before.revision,knowledge_revision:1,title_key:'legacy'});expect(new Date(after.updated_at).toISOString()).toBe(new Date(before.updated_at).toISOString());expect(await admin`SELECT * FROM note_tags WHERE note_id=${id}`).toHaveLength(1);
});
it('paginates tied ranks and rejects cursor fingerprints; escapes LIKE metacharacters',async()=>{
 const x=await create(a,'100%_literal','needle');await create(a,'Other','needle');
 expect((await knowledge.complete(a,{kind:'complete',prefix:'100%_',limit:20})).items.map(n=>n.id)).toEqual([x.id]);
 const first=await knowledge.search(a,{query:'needle',limit:1});expect(first.nextCursor).not.toBeNull();const second=await knowledge.search(a,{query:'needle',limit:1,cursor:first.nextCursor!});expect(second.items[0].id).not.toBe(first.items[0].id);
 await expect(knowledge.search(a,{query:'other',limit:1,cursor:first.nextCursor!})).rejects.toMatchObject({code:'invalid_request'});
 expect((await knowledge.search(a,{query:'!!!',limit:20})).items).toEqual([]);
});
it('accepts NFKC-expanded maximum titles, wiki targets and tags without index bounds loss',async()=>{
 const title='ﷺ'.repeat(200),tag='ﷺ'.repeat(64);
 const target=await create(a,title);const source=await create(a,'Expanded',`[[${title}]] #${tag}`);
 expect((await knowledge.resolve(a,[title])).items[0]).toMatchObject({status:'resolved',note:{id:target.id}});
 expect((await knowledge.backlinks(a,target.id,{limit:20})).items[0].sourceId).toBe(source.id);
 expect((await knowledge.tags(a,{limit:100})).items.some(t=>t.displayName===tag)).toBe(true);
});
it('rolls back canonical writes when a derived insert fails and preserves idempotent replay',async()=>{
 const operation=randomUUID();const first=await notes.create(a,null,{title:'Replay',content:'#original'},operation);if(first.kind!=='note')throw Error('fixture');
 await notes.update(a,null,first.row.id,{content:'#latest',expectedRevision:1});const replay=await notes.create(a,null,{title:'Replay',content:'#original'},operation);
 expect(replay.kind==='note'&&replay.row.revision).toBe(2);expect((await knowledge.search(a,{query:'latest',limit:20})).items.some(n=>n.id===first.row.id)).toBe(true);
 await admin`ALTER TABLE note_tags ADD CONSTRAINT knowledge_fixture_reject CHECK(tag_key <> 'fixture-reject')`;
 try{await expect(notes.create(a,null,{title:'Must rollback',content:'#fixture-reject'},randomUUID())).rejects.toThrow();expect(await admin`SELECT id FROM notes WHERE user_id=${a.userId} AND title='Must rollback'`).toHaveLength(0);}finally{await admin`ALTER TABLE note_tags DROP CONSTRAINT knowledge_fixture_reject`;}
});
it('saves a maximum-byte unique-word corpus and searches its final committed token',async()=>{
 const words=Array.from({length:200000},(_,i)=>`w${i.toString(36)}`);const content=words.join(' ').slice(0,1048576);const tail=content.trim().split(' ').at(-2)!;
 expect(Buffer.byteLength(content)).toBe(1048576);
 const note=await create(a,'Maximum corpus',content);
 expect((await knowledge.search(a,{query:tail,limit:100})).items.some(item=>item.id===note.id)).toBe(true);
},30000);
it('backfill retries a candidate changed after its scan and never revives deleted associations',async()=>{
 const note=await create(a,'Backfill race','#before');let raced=false;
 const intercepted=new Proxy(admin,{get(target,property,receiver){if(property==='unsafe')return(...args:Parameters<typeof admin.unsafe>)=>{
  const pending=target.unsafe(...args);
  if(!args[0].includes('SELECT id,user_id')||!args[0].includes('LIMIT 50'))return pending;
  return new Proxy(pending,{get(query,key,context){if(key==='then')return(fulfilled:((value:unknown)=>unknown)|undefined,rejected:((error:unknown)=>unknown)|undefined)=>query.then(async rows=>{
   if(!raced){raced=true;await notes.update(a,null,note.id,{content:'#after',expectedRevision:1});}
   return rows;
  }).then(fulfilled,rejected);return Reflect.get(query,key,context);}});
 };return Reflect.get(target,property,receiver);}});
 const result=await backfillKnowledge(intercepted);expect(result.changed).toBeGreaterThan(0);
 expect((await knowledge.search(a,{query:'after',limit:100})).items.some(n=>n.id===note.id)).toBe(true);
 const deletion=await notes.remove(a,null,note.id,{expectedRevision:2});expect(deletion.kind).toBe('note');
 await backfillKnowledge(admin);expect(await admin`SELECT * FROM note_tags WHERE note_id=${note.id}`).toHaveLength(0);
});
it('commits maximum-byte dense wiki/tag prose with full occurrence aggregation',async()=>{
 const chunk='[[person@example.com]] #dense text\n';const repeats=Math.floor(1048576/chunk.length);const content=chunk.repeat(repeats).padEnd(1048576,' ');
 const target=await create(a,'person@example.com');const source=await create(a,'Maximum wiki corpus',content);
 expect((await knowledge.backlinks(a,target.id,{limit:20})).items.find(item=>item.sourceId===source.id)?.occurrenceCount).toBe(repeats);
 expect((await knowledge.search(a,{query:'text',tag:'dense',limit:20})).items.some(item=>item.id===source.id)).toBe(true);
},30000);
it('inspects owner-selective lookup plans on representative disposable data',async()=>{
 const title='Explain target';await create(a,title,'explainneedle #explain');
 const plans=await db.run(a,async tx=>{
  await tx.execute(sql`SET LOCAL enable_seqscan=off`);
  const target=await tx.execute(sql`EXPLAIN (FORMAT JSON) SELECT id FROM notes WHERE user_id=${a.userId} AND deleted_at IS NULL AND md5(title_key)=md5('explain target') AND title_key='explain target'`);
  const tags=await tx.execute(sql`EXPLAIN (FORMAT JSON) SELECT note_id FROM note_tags WHERE user_id=${a.userId} AND tag_hash=public.mindmora_key_hash('explain') AND tag_key='explain'`);
  const search=await tx.execute(sql`EXPLAIN (FORMAT JSON) SELECT id FROM notes WHERE user_id=${a.userId} AND deleted_at IS NULL AND search_vector @@ websearch_to_tsquery('simple','explainneedle')`);
  return {target,tags,search};
 });
 // Forced scan preference establishes usable index paths, not production latency.
 expect(JSON.stringify(plans.target)).toContain('notes_owner_title_key');
 expect(JSON.stringify(plans.tags)).toContain('note_tags_owner_key');
 expect(JSON.stringify(plans.search)).toContain('Index');
 expect(JSON.stringify(plans.search)).toContain('user_id');
 console.log('PASS disposable EXPLAIN: title/hash and tag/hash indexes selected; native search chooses an owner index on this small RLS fixture; production plan/latency not asserted.');
});
