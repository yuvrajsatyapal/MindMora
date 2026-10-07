import {z} from "zod";
import {apiRequest,ApiError} from "../../lib/api/client";
import type {NoteScope} from "../notes/api";
import {targetPageSchema,resolutionPageSchema,backlinksPageSchema,tagPageSchema,searchPageSchema,type TargetPage,type BacklinksPage,type TagPage,type SearchPage} from "./types";
import {wikiTargetsSchema,targetResolveSchema,searchInputSchema,backlinksInputSchema,tagsInputSchema} from "./validation";
import {normalizeTitleKey} from "./syntax";
export function createKnowledgeApi(scope:NoteScope){
 async function scoped<T>(path:string,schema:z.ZodType<T>,options:RequestInit={}):Promise<T>{
  scope.assertActive();await scope.verify();scope.assertActive();
  try {const result=await apiRequest(path,schema,{...options,signal:scope.signal?options.signal?AbortSignal.any([scope.signal,options.signal]):scope.signal:options.signal});scope.assertActive();return result;}
  catch(error){scope.assertActive();if(error instanceof ApiError&&error.status===401)scope.invalidate?.();throw error;}
 }
 function owned(items:{userId:string;deletedAt?:string|null}[]){if(items.some(item=>item.userId!==scope.ownerId||item.deletedAt!=null))throw new ApiError("invalid_response");}
 function post(body:unknown,signal?:AbortSignal):RequestInit{return {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal};}
 function params(input:{limit:number;cursor?:unknown}){const query=new URLSearchParams({limit:String(input.limit)});if(input.cursor)query.set("cursor",JSON.stringify(input.cursor));return query;}
 return {
  async complete(prefix:string,signal?:AbortSignal,cursor?:TargetPage["nextCursor"]){const body=wikiTargetsSchema.parse({kind:"complete",prefix,limit:20,...(cursor?{cursor}:{})});const page=await scoped("/api/knowledge/wiki-targets/",targetPageSchema,post(body,signal));owned(page.items);return page;},
  async resolve(targets:string[],signal?:AbortSignal){const body=targetResolveSchema.parse({kind:"resolve",targets});const page=await scoped("/api/knowledge/wiki-targets/",resolutionPageSchema,post(body,signal));owned(page.items.flatMap(item=>item.note?[item.note]:[]));if(page.items.length!==targets.length||page.items.some((item,index)=>item.target!==body.targets[index]||item.key!==normalizeTitleKey(body.targets[index])))throw new ApiError("invalid_response");return page;},
  async backlinks(id:string,signal?:AbortSignal,cursor?:BacklinksPage["nextCursor"]){z.uuid().parse(id);const input=backlinksInputSchema.parse({limit:20,...(cursor?{cursor}:{})});return scoped(`/api/notes/${id}/backlinks/?${params(input)}`,backlinksPageSchema,{signal});},
  async tags(signal?:AbortSignal,cursor?:TagPage["nextCursor"]){const input=tagsInputSchema.parse({limit:20,...(cursor?{cursor}:{})});return scoped(`/api/tags/?${params(input)}`,tagPageSchema,{signal});},
  async search(query:string,tag?:string,signal?:AbortSignal,cursor?:SearchPage["nextCursor"]){const body=searchInputSchema.parse({query,...(tag?{tag}:{}),limit:20,...(cursor?{cursor}:{})});const page=await scoped("/api/search/",searchPageSchema,post(body,signal));owned(page.items);return page;},
 };
}
export type KnowledgeApi=ReturnType<typeof createKnowledgeApi>;
