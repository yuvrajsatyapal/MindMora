import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthConfig, isKnowledgeEnabled, type AuthConfig } from "../config";
import { verifyDatabaseSession, type VerifiedOwner } from "../db/user-context";
import { DatabaseFailure } from "../db/client";
import { AuthFailure } from "../auth/provider";
import { clearSession, writeCookie } from "../auth/session";
import { assertRequestBounds, readBoundedBody, readJson } from "../http/body";
import { assertOrigin } from "../http/csrf";
import { HttpFailure } from "../http/errors";
import { errorResponse, privateResponse, responseErrorCode } from "../http/responses";
import { limiter } from "../rate-limit/limiter";
import { logRequest } from "../logging/logger";
import { wikiTargetsSchema, backlinksInputSchema, tagsInputSchema, searchInputSchema } from "../../features/knowledge/validation";
import { createKnowledgeService } from "./service";
import { createKnowledgeRepository } from "./repository";
import type { NoteDatabase } from "../notes/repository";
export type KnowledgeAction = "targets" | "backlinks" | "tags" | "search";
export type KnowledgeDependencies = {
 config?:AuthConfig; enabled?:boolean; fetcher?:typeof fetch; database?:NoteDatabase;
 repository?:ReturnType<typeof createKnowledgeRepository>;
 admission?:(owner:VerifiedOwner)=>Promise<{degraded:boolean}>;logger?:typeof logRequest;
};
function pageInput(request:Request) {
 const params=new URL(request.url).searchParams;
 if([...params.keys()].some(key=>!["limit","cursor"].includes(key)||params.getAll(key).length!==1)) throw new HttpFailure("invalid_request");
 let cursor:unknown;
 if(params.has("cursor")) {try{cursor=JSON.parse(params.get("cursor")!);}catch{throw new HttpFailure("invalid_request");}}
 return {...(params.has("limit")?{limit:params.get("limit")!}:{}),...(cursor!==undefined?{cursor}:{})};
}
/** HTTP admission and session controls remain independent of SQL ownership/RLS. */
export async function handleKnowledge(request:Request,action:KnowledgeAction,id?:string,dependencies:KnowledgeDependencies={}) {
 const correlationId=randomUUID(),started=performance.now();
 const method=action==="search"||action==="targets"?"POST":"GET";
 let config:AuthConfig|undefined,verified:Awaited<ReturnType<typeof verifyDatabaseSession>>|undefined;
 let degraded=false;let result:NextResponse;
 try {
  assertRequestBounds(request);
  try {config=dependencies.config??getAuthConfig();}catch{throw new HttpFailure("auth_unavailable");}
  if(request.method!==method) throw new HttpFailure("method_not_allowed");
  assertOrigin(request,config.appOrigin,method==="POST");
  verified=await verifyDatabaseSession(request,{config,fetcher:dependencies.fetcher});
  degraded=(await(dependencies.admission??limiter.basic)(verified.owner)).degraded;
  let enabled:boolean;
  try{enabled=dependencies.enabled??isKnowledgeEnabled();}catch{throw new HttpFailure("service_unavailable");}
  if(!enabled) throw new HttpFailure("service_unavailable");
  const owner=verified.owner;
  if(action==="backlinks") z.uuid().parse(id);
  // Validate all external inputs before building the lazy SQL pool.
  const input=await(async()=>{
   if(method==="POST") {
    if(new URL(request.url).search) throw new HttpFailure("invalid_request");
    if(action==="targets") return {action:"targets",input:await readJson(request,wikiTargetsSchema,8192)} as const;
    return {action:"search",input:await readJson(request,searchInputSchema,8192)} as const;
   }
   if((await readBoundedBody(request,1024)).byteLength) throw new HttpFailure("invalid_request");
   if(action==="tags") return {action:"tags",input:tagsInputSchema.parse(pageInput(request))} as const;
   return {action:"backlinks",input:backlinksInputSchema.parse(pageInput(request))} as const;
  })();
  const repository=dependencies.repository??createKnowledgeRepository(dependencies.database);
  const service=createKnowledgeService(repository);
  switch(input.action) {
   case "targets": {
    const body=input.input;
    result=NextResponse.json(body.kind==="complete"?await service.complete(owner,body):await service.resolve(owner,body.targets));
    break;
   }
   case "search": result=NextResponse.json(await service.search(owner,input.input));break;
   case "tags": result=NextResponse.json(await service.tags(owner,input.input));break;
   case "backlinks":result=NextResponse.json(await service.backlinks(owner,id!,input.input));break;
  }
 } catch(error) {
  const safe=error instanceof z.ZodError?new HttpFailure("invalid_request"):error instanceof AuthFailure?new HttpFailure(error.kind==="unauthenticated"?"unauthenticated":"auth_unavailable"):error instanceof DatabaseFailure?new HttpFailure("service_unavailable"):error;
  result=errorResponse(safe,correlationId);
  if(error instanceof AuthFailure&&error.kind==="unauthenticated"&&config)clearSession(result,config.appOrigin);
 }
 privateResponse(result,correlationId);
 if(result.status===405)result.headers.set("Allow",method);
 if(degraded)result.headers.set("X-RateLimit-Degraded","true");
 if(verified?.refreshed&&config)writeCookie(result,config.appOrigin,"session",verified.tokens,60*60*24*7);
 (dependencies.logger??logRequest)({correlationId,operation:`knowledge.${action}`,status:result.status,errorCode:responseErrorCode(result),durationMs:Math.max(0,performance.now()-started)});
 return result;
}
