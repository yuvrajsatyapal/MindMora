"use client";
import { parseAsString, useQueryState } from "nuqs";
import { z } from "zod";
export function useNoteSelection() {
  const [rawId, setId] = useQueryState(
    "note",
    parseAsString.withOptions({ history: "replace", shallow: true }),
  );
  const valid = rawId === null || z.uuid().safeParse(rawId).success;
  return { id: valid ? rawId : null, invalid: !valid, select: setId };
}
