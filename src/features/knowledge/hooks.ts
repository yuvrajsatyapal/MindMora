"use client";
import {useInfiniteQuery} from "@tanstack/react-query";
import type {NoteScope} from "../notes/api";
import type {KnowledgeApi} from "./api";
import type {SearchPage,TagPage,BacklinksPage} from "./types";
import {normalizeTagKey} from "./syntax";
export function knowledgeKeys(scope:NoteScope){return ["knowledge",scope.ownerId,scope.generation] as const;}
export function useKnowledgeSearch(scope:NoteScope,api:KnowledgeApi,query:string,tag?:string){return useInfiniteQuery({queryKey:[...knowledgeKeys(scope),"search",query,tag?normalizeTagKey(tag):null],initialPageParam:null as SearchPage["nextCursor"],queryFn:({signal,pageParam})=>api.search(query,tag,signal,pageParam),getNextPageParam:page=>page.nextCursor??undefined,retry:false});}
export function useTags(scope:NoteScope,api:KnowledgeApi){return useInfiniteQuery({queryKey:[...knowledgeKeys(scope),"tags"],initialPageParam:null as TagPage["nextCursor"],queryFn:({signal,pageParam})=>api.tags(signal,pageParam),getNextPageParam:page=>page.nextCursor??undefined,retry:false});}
export function useBacklinks(scope:NoteScope,api:KnowledgeApi,id:string){return useInfiniteQuery({queryKey:[...knowledgeKeys(scope),"backlinks",id],initialPageParam:null as BacklinksPage["nextCursor"],queryFn:({signal,pageParam})=>api.backlinks(id,signal,pageParam),getNextPageParam:page=>page.nextCursor??undefined,retry:false});}
