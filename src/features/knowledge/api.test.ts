import {afterEach,expect,it,vi} from "vitest";
import {createKnowledgeApi} from "./api";
const ownerId="11111111-1111-4111-8111-111111111111";
const scope={ownerId,generation:1,assertActive(){},async verify(){}};
afterEach(()=>vi.unstubAllGlobals());
it("keeps private completion prefixes in a POST body and accepts owned projections",async()=>{
 const fetcher=vi.fn(async(...args:[string,RequestInit?])=>{void args;return Response.json({items:[{id:"33333333-3333-4333-8333-333333333333",userId:ownerId,title:"Target",revision:1}],nextCursor:null});});vi.stubGlobal("fetch",fetcher);
 const result=await createKnowledgeApi(scope).complete("Tar");
 expect(result.items[0].title).toBe("Target");expect(fetcher.mock.calls[0][0]).toBe("/api/knowledge/wiki-targets/");expect(fetcher.mock.calls[0][1]).toMatchObject({method:"POST",body:JSON.stringify({kind:"complete",prefix:"Tar",limit:20})});
});
it("rejects a foreign target before returning private knowledge",async()=>{
 vi.stubGlobal("fetch",vi.fn(async(...args:[string,RequestInit?])=>{void args;return Response.json({items:[{id:"33333333-3333-4333-8333-333333333333",userId:"22222222-2222-4222-8222-222222222222",title:"Secret",revision:1}],nextCursor:null});}));
 await expect(createKnowledgeApi(scope).complete("S")).rejects.toThrow();
});
it("rejects late results after account lease replacement",async()=>{
 let active=true;vi.stubGlobal("fetch",vi.fn(async()=>{active=false;return Response.json({items:[],nextCursor:null});}));
 await expect(createKnowledgeApi({...scope,assertActive(){if(!active)throw Error("Session changed");}}).complete("T")).rejects.toThrow("Session changed");
});
it("invalidates an expired session",async()=>{
 const invalidate=vi.fn();vi.stubGlobal("fetch",vi.fn(async(...args:[string,RequestInit?])=>{void args;return Response.json({error:{code:"unauthenticated",message:"Expired",correlationId:"33333333-3333-4333-8333-333333333333"}},{status:401});}));
 await expect(createKnowledgeApi({...scope,invalidate}).complete("T")).rejects.toThrow();expect(invalidate).toHaveBeenCalledOnce();
});
it.each(["search","resolve"] as const)("drops late %s responses from a replaced owner generation",async action=>{
 let active=true;let deliver!:(value:Response)=>void;let started!:()=>void;
 const fetched=new Promise<void>(resolve=>{started=resolve;});vi.stubGlobal("fetch",vi.fn(()=>{started();return new Promise<Response>(resolve=>{deliver=resolve;});}));
 const api=createKnowledgeApi({...scope,assertActive(){if(!active)throw Error("Session changed");}});
 const pending=action==="search"?api.search("private"):api.resolve(["Target"]);await fetched;active=false;
 deliver(Response.json(action==="search"?{items:[],nextCursor:null}:{items:[{target:"Target",key:"target",status:"missing",note:null}]}));
 await expect(pending).rejects.toThrow("Session changed");
});
