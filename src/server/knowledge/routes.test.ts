// @vitest-environment node
import { expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { handleKnowledge } from "./routes";
import { isKnowledgeEnabled } from "../config";
const config={appOrigin:"http://localhost:3000",supabaseUrl:"https://fixture.supabase.co",publishableKey:"sb_publishable_fixture"};
it("defaults the rollout closed and validates boolean configuration",()=>{
  expect(isKnowledgeEnabled({})).toBe(false);
  expect(isKnowledgeEnabled({KNOWLEDGE_FEATURES_ENABLED:"true"})).toBe(true);
  expect(()=>isKnowledgeEnabled({KNOWLEDGE_FEATURES_ENABLED:"yes"})).toThrow();
});
it("authenticates private corpus reads before SQL",async()=>{
 const response=await handleKnowledge(new Request(config.appOrigin+"/api/tags"),"tags",undefined,{config,enabled:true});
 expect(response.status).toBe(401);
 expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});
it("rejects a foreign read POST origin before provider work",async()=>{
 const fetcher=vi.fn();
 const response=await handleKnowledge(new Request(config.appOrigin+"/api/search",{method:"POST",headers:{Origin:"https://attacker.example","Content-Type":"application/json"},body:'{"query":"secret"}'}),"search",undefined,{config,fetcher,enabled:true});
 expect(response.status).toBe(403);expect(fetcher).not.toHaveBeenCalled();
});
it("reports private method failures with Allow",async()=>{
 const response=await handleKnowledge(new Request(config.appOrigin+"/api/search"),"search",undefined,{config,enabled:true});
 expect(response.status).toBe(405);expect(response.headers.get("Allow")).toBe("POST");
});
import { createAuthProvider } from "../auth/provider";
import { authProviderFixture } from "../../tests/auth-provider-fixture";
async function authenticated(method="POST",body:unknown={query:"private"},path="/api/search",expired=false) {
 const fixture=authProviderFixture();const provider=createAuthProvider(config,fixture.fetcher);
 const flow=await provider.start(config.appOrigin+"/api/auth/callback");
 const callback=new URL(fixture.authorize(flow.url));const tokens=await provider.exchange(callback.searchParams.get("code")!,flow.flowId);await provider.dispose();
 const request=new Request(config.appOrigin+path,{method,headers:{Origin:config.appOrigin,"Content-Type":"application/json",cookie:`mindmora-session=${Buffer.from(JSON.stringify({...tokens,...(expired?{expiresAt:1}:{})})).toString("base64url")}`},...(method==="POST"?{body:JSON.stringify(body)}:{})});
 return {request,fixture};
}
it("rejects forged fields before SQL and preserves a refreshed cookie",async()=>{
 const {request,fixture}=await authenticated("POST",{query:"private",userId:"foreign"},"/api/search",true);
 const database={run:vi.fn(),close:vi.fn()};
 const response=await handleKnowledge(request,"search",undefined,{config,fetcher:fixture.fetcher,database,enabled:true,admission:async()=>({degraded:false})});
 expect(response.status).toBe(400);expect(database.run).not.toHaveBeenCalled();expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
 expect(await response.text()).not.toContain("foreign");
});
it("bounds read bodies and query parameters before SQL",async()=>{
 const database={run:vi.fn(),close:vi.fn()};
 for(const [body,path,expected] of [[{query:"x".repeat(9000)},"/api/search",413],[{query:"x"},"/api/search?query=private",400]] as const){
  const f=await authenticated("POST",body,path);const response=await handleKnowledge(f.request,"search",undefined,{config,fetcher:f.fixture.fetcher,database,enabled:true,admission:async()=>({degraded:false})});expect(response.status).toBe(expected);
 }
 const f=await authenticated("GET",undefined,"/api/tags?limit=1&limit=2");expect((await handleKnowledge(f.request,"tags",undefined,{config,fetcher:f.fixture.fetcher,database,enabled:true,admission:async()=>({degraded:false})})).status).toBe(400);
 expect(database.run).not.toHaveBeenCalled();
});
it("uses typed admission errors and keeps the disabled rollout unavailable",async()=>{
 const database={run:vi.fn(),close:vi.fn()};const f=await authenticated();
 const response=await handleKnowledge(f.request,"search",undefined,{config,fetcher:f.fixture.fetcher,database,enabled:false,admission:async()=>({degraded:true})});expect(response.status).toBe(503);expect(response.headers.get("X-RateLimit-Degraded")).toBe("true");expect(database.run).not.toHaveBeenCalled();
});
