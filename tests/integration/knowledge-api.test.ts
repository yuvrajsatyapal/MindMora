import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { searchPageSchema, tagPageSchema, backlinksPageSchema, resolutionPageSchema, targetPageSchema } from "../../src/features/knowledge/types";
import { createKnowledgeRepository } from "../../src/server/knowledge/repository";
import { HttpFailure } from "../../src/server/http/errors";
import { DatabaseFailure } from "../../src/server/db/client";
import { handleKnowledge } from "../../src/server/knowledge/routes";
import { handleNotes } from "../../src/server/notes/routes";
import { createDatabase } from "../../src/server/db/client";
import { getDatabaseConfig, getMigrationConfig } from "../../src/server/db/config";
const config = { appOrigin: "http://localhost:3000", supabaseUrl: "https://fixture.supabase.co", publishableKey: "sb_publishable_fixture" };
const ids: string[] = [randomUUID(), randomUUID()];
const admin = postgres(getMigrationConfig().url, { max: 1, onnotice: () => {} });
const database = createDatabase(getDatabaseConfig());
const fetcher: typeof fetch = async (input, init) => {
  const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
  const id = headers.get("authorization")?.replace("Bearer verified-", "");
  return ids.includes(id ?? "") ? Response.json({ id, aud: "authenticated", role: "authenticated", email: "fixture@example.invalid", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }) : Response.json({}, { status: 401 });
};
const deps = { config, fetcher, database, enabled: true, admission: async () => ({ degraded: false }) };
function request(user: number, path: string, method = "GET", body?: unknown, headers: Record<string,string> = {}) {
  const session = { accessToken: `verified-${ids[user]}`, refreshToken: "fixture-refresh", expiresAt: Math.floor(Date.now()/1000)+3600 };
  return new Request(`${config.appOrigin}${path}`, { method, headers: { cookie: `mindmora-session=${Buffer.from(JSON.stringify(session)).toString("base64url")}`, ...(method !== "GET" ? { Origin: config.appOrigin, "Content-Type": "application/json" } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
function knowledge(user: number, action: "targets"|"backlinks"|"tags"|"search", body?: unknown, id?: string, query = "") {
  const path = action === "targets" ? "/api/knowledge/wiki-targets" : action === "backlinks" ? `/api/notes/${id}/backlinks` : `/api/${action}`;
  return handleKnowledge(request(user, path + query, body === undefined ? "GET" : "POST", body), action, id, deps);
}
async function create(user: number, title: string, content = "") {
  const response = await handleNotes(request(user, "/api/notes", "POST", { title, content }, { "Idempotency-Key": randomUUID() }), undefined, deps);
  expect(response.status).toBe(201); return await response.json();
}
beforeAll(async () => { await admin`INSERT INTO auth.users(id) VALUES (${ids[0]}),(${ids[1]})`; });
afterAll(async () => { await database.close(); await admin`DELETE FROM note_links WHERE user_id IN (${ids[0]},${ids[1]})`; await admin`DELETE FROM note_tags WHERE user_id IN (${ids[0]},${ids[1]})`; await admin`DELETE FROM auth.users WHERE id IN (${ids[0]},${ids[1]})`; await admin.end(); });
it("searches beyond a note-list page, projects safe snippets and isolates exact tags", async () => {
  for (let i=0;i<22;i++) await create(0, `Corpus ${i}`, i===0 ? "rareterm #Research" : "ordinary");
  await create(1,"Foreign","rareterm #Research secret-marker");
  const complete = targetPageSchema.parse(await (await knowledge(0,"targets",{kind:"complete",prefix:"Corpus",limit:2})).json());
  expect(complete.items).toHaveLength(2); expect(complete.nextCursor).not.toBeNull();
  const next = targetPageSchema.parse(await (await knowledge(0,"targets",{kind:"complete",prefix:"Corpus",limit:2,cursor:complete.nextCursor})).json());
  expect(next.items.some(note=>complete.items.some(previous=>previous.id===note.id))).toBe(false);
  const response = await knowledge(0,"search",{query:"rareterm"});
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  const page = searchPageSchema.parse(await response.json()); expect(page.items).toHaveLength(1); expect(page.items[0].title).toBe("Corpus 0"); expect(page.items[0]).not.toHaveProperty("content"); expect(page.items[0].snippet).not.toContain("secret-marker");
  const tagged = await (await knowledge(0,"search",{query:"",tag:"research"})).json(); expect(tagged.items).toHaveLength(1);
  const tags = tagPageSchema.parse(await (await knowledge(0,"tags")).json()); expect(tags.items.find((tag:{key:string})=>tag.key==="research")?.noteCount).toBe(1);
  expect((await (await knowledge(0,"search",{query:"!!!"})).json()).items).toEqual([]);
});
it("resolves duplicates safely and re-resolves rename, deletion and source edits", async () => {
  const target = await create(0,"Unique Target"); const source = await create(0,"Source", "Context [[Unique Target]] and [[Unique Target|Alias]] #knowledge");
  const resolved = resolutionPageSchema.parse(await (await knowledge(0,"targets",{kind:"resolve",targets:["  UNIQUE   Target "]})).json()); expect(resolved.items[0].status).toBe("resolved"); expect(resolved.items[0].note?.id).toBe(target.id);
  const incoming = backlinksPageSchema.parse(await (await knowledge(0,"backlinks",undefined,target.id)).json()); expect(incoming.total).toBe(1); expect(incoming.items[0]).toMatchObject({sourceId:source.id,sourceRevision:1,occurrenceCount:2}); expect(incoming.items[0].context).toContain("Context");
  const duplicate = await create(0,"unique target"); expect((await (await knowledge(0,"targets",{kind:"resolve",targets:["Unique Target"]})).json()).items[0].status).toBe("ambiguous");
  const ambiguous = await (await knowledge(0,"backlinks",undefined,target.id)).json(); expect(ambiguous.resolution).toBe("ambiguous"); expect(ambiguous.total).toBe(0);
  await handleNotes(request(0,`/api/notes/${duplicate.id}`,"DELETE",{expectedRevision:1}),duplicate.id,deps);
  await handleNotes(request(0,`/api/notes/${target.id}`,"PATCH",{title:"Renamed",expectedRevision:1}),target.id,deps);
  expect((await (await knowledge(0,"targets",{kind:"resolve",targets:["Unique Target"]})).json()).items[0].status).toBe("missing");
  const recreated = await create(0,"Unique Target"); expect((await (await knowledge(0,"backlinks",undefined,recreated.id)).json()).total).toBe(1);
  await handleNotes(request(0,`/api/notes/${source.id}`,"PATCH",{content:"No references",expectedRevision:1}),source.id,deps);
  expect((await (await knowledge(0,"backlinks",undefined,recreated.id)).json()).total).toBe(0);
  expect((await (await knowledge(0,"tags")).json()).items.some((tag:{key:string})=>tag.key==="knowledge")).toBe(false);
});
it("rejects foreign backlinks, hostile inputs, wrong methods and missing Origin", async () => {
  const privateNote = await create(1,"Private target","secret-marker"); expect((await knowledge(0,"backlinks",undefined,privateNote.id)).status).toBe(404);
  for (const body of [{query:"x",userId:ids[1]}, {query:"x",limit:101},{query:"x",cursor:{queryKey:"forged",rank:1,id:randomUUID()}}]) expect((await knowledge(0,"search",body)).status).toBe(400);
  for (const query of ["?limit=2&limit=3","?userId=forged","?cursor=not-json"]) expect((await knowledge(0,"tags",undefined,undefined,query)).status).toBe(400);
  expect((await handleKnowledge(request(0,"/api/search"),"search",undefined,deps)).status).toBe(405);
  const originless = request(0,"/api/search","POST",{query:"x"}); originless.headers.delete("Origin"); expect((await handleKnowledge(originless,"search",undefined,deps)).status).toBe(403);
  const unauthenticated = new Request(`${config.appOrigin}/api/tags`); expect((await handleKnowledge(unauthenticated,"tags",undefined,deps)).status).toBe(401);
  const disabled = await handleKnowledge(request(0,"/api/tags"),"tags",undefined,{...deps,enabled:false}); expect(disabled.status).toBe(503);
});

it("returns bounded admission and outage failures without content or credentials", async () => {
  const throttled = await handleKnowledge(request(0,"/api/search","POST",{query:"private-marker"}),"search",undefined,{...deps,admission:async()=>{throw new HttpFailure("rate_limited",2);}});
  expect(throttled.status).toBe(429); expect(throttled.headers.get("Retry-After")).toBe("2"); expect(await throttled.text()).not.toContain("private-marker");
  const unavailable = await handleKnowledge(request(0,"/api/search","POST",{query:"private-marker"}),"search",undefined,{...deps,repository:{...createKnowledgeRepository(database),search:async()=>{throw new DatabaseFailure("connection");}}});
  expect(unavailable.status).toBe(503); expect(await unavailable.text()).not.toContain("private-marker");
  const tooLarge = await handleKnowledge(request(0,"/api/search","POST",{query:"x".repeat(9000)}),"search",undefined,deps); expect(tooLarge.status).toBe(413);
});
it("admits the maximum accepted byte corpus over HTTP and searches its final committed token", async () => {
  const words = Array.from({ length: 200000 }, (_, index) => `w${index.toString(36)}`);
  const content = words.join(" ").slice(0, 1048576); const tail = content.trim().split(" ").at(-2)!;
  expect(Buffer.byteLength(content)).toBe(1048576);
  const note = await create(0, "Maximum HTTP corpus", content);
  const response = await knowledge(0, "search", { query: tail, limit: 100 }); expect(response.status).toBe(200);
  expect(searchPageSchema.parse(await response.json()).items.some(item => item.id === note.id)).toBe(true);
});
