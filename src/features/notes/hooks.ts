"use client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { NotePage } from "./types";
import type { NotesApi, NoteScope } from "./api";
export function noteKeys(scope: NoteScope) {
  return ["notes", scope.ownerId, scope.generation] as const;
}
export function useNotes(scope: NoteScope, api: NotesApi) {
  return useInfiniteQuery({
    queryKey: [...noteKeys(scope), "list"],
    initialPageParam: null as NotePage["nextCursor"],
    queryFn: ({ signal, pageParam }) => api.list(signal, pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: false,
  });
}
export function useNote(scope: NoteScope, api: NotesApi, id: string | null) {
  return useQuery({
    queryKey: [...noteKeys(scope), "detail", id],
    queryFn: ({ signal }) => api.read(id!, signal),
    enabled: id !== null,
    retry: false,
  });
}
