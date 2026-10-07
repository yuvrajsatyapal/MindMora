import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { adminConnection } from './database-common.mjs';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){try{return nextResolve(specifier,context);}catch(error){if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!specifier.endsWith('.ts'))return nextResolve(`${specifier}.ts`,context);throw error;}}});
const { deriveKnowledge, replaceKnowledge } = await import('../src/server/knowledge/derivation.ts');
import { fileURLToPath } from 'node:url';
/** Privileged CLI only: never invoked by HTTP startup. Bounded rerunnable passes. */
export async function backfillKnowledge(connection) {
 const db=drizzle(connection);let repaired=0,changed=0;
 for(let pass=0;pass<3;pass++){
  let cursor='00000000-0000-0000-0000-000000000000';let skipped=0;
  for(;;){const rows=await db.execute(sql`SELECT id,user_id AS "userId",title,content,revision FROM notes WHERE id>${cursor}::uuid ORDER BY id LIMIT 50`);if(!rows.length)break;
   for(const candidate of rows){cursor=candidate.id;const derivation=deriveKnowledge(candidate.title,candidate.content);
    await db.transaction(async tx=>{const current=await tx.execute(sql`SELECT id,user_id AS "userId",revision,updated_at AS "updatedAt",deleted_at AS "deletedAt" FROM notes WHERE id=${candidate.id}::uuid AND user_id=${candidate.userId}::uuid FOR UPDATE`);const note=current[0];if(!note||note.revision!==candidate.revision){skipped++;changed++;return;}
     await replaceKnowledge(tx,{id:note.id,userId:note.userId,revision:note.revision,updatedAt:new Date(note.updatedAt)},note.deletedAt?null:derivation);
     await tx.execute(sql`UPDATE notes SET title_key=${derivation.titleKey},knowledge_revision=revision WHERE id=${note.id}::uuid AND user_id=${note.userId}::uuid AND revision=${note.revision}`);repaired++;});
   }
  }
  if(!skipped)break;
 }
 // Derived tables deliberately have no new FKs; privileged lifecycle cleanup is explicit.
 await db.execute(sql`DELETE FROM note_links l WHERE NOT EXISTS(SELECT 1 FROM notes n WHERE n.id=l.source_note_id AND n.user_id=l.user_id)`);
 await db.execute(sql`DELETE FROM note_tags t WHERE NOT EXISTS(SELECT 1 FROM notes n WHERE n.id=t.note_id AND n.user_id=t.user_id)`);
 const invalid=await db.execute(sql`SELECT count(*)::integer AS count FROM notes WHERE deleted_at IS NULL AND (title_key IS NULL OR knowledge_revision IS DISTINCT FROM revision)`);
 if(invalid[0].count)throw new Error('Knowledge consistency verification failed; keep reads disabled and rerun.');
 return {repaired,changed};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let connection;try{connection=adminConnection();const result=await backfillKnowledge(connection);console.log(`Knowledge backfill verified: ${result.repaired} records processed; ${result.changed} concurrent changes retried.`);}catch{console.error('Knowledge backfill unavailable; keep reads disabled. No credentials or note content printed.');process.exitCode=1;}finally{if(connection)await connection.end({timeout:5});}
}
