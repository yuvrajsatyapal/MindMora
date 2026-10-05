import { z } from "zod";
import { apiRequest, ApiError } from "../../lib/api/client";
import {
  noteSchema,
  notePageSchema,
  type NotePage,
  type CreateNoteInput,
  type UpdateNoteInput,
} from "./types";
import {
  createNoteSchema,
  updateNoteSchema,
  deleteNoteSchema,
} from "./validation";
export type NoteScope = {
  ownerId: string;
  generation: number;
  signal?: AbortSignal;
  invalidate?: () => void;
  assertActive: () => void;
  verify: () => Promise<void>;
};
export function createNotesApi(scope: NoteScope) {
  async function scoped<T>(
    path: string,
    schema: z.ZodType<T>,
    options?: RequestInit,
  ): Promise<T> {
    scope.assertActive();
    await scope.verify();
    scope.assertActive();
    try {
      const result = await apiRequest(path, schema, {
        ...options,
        signal: scope.signal
          ? options?.signal
            ? AbortSignal.any([scope.signal, options.signal])
            : scope.signal
          : options?.signal,
      });
      scope.assertActive();
      return result;
    } catch (error) {
      scope.assertActive();
      if (error instanceof ApiError && error.status === 401)
        scope.invalidate?.();
      throw error;
    }
  }
  function owned<T extends { userId: string; deletedAt: string | null }>(
    note: T,
  ): T {
    if (note.userId !== scope.ownerId || note.deletedAt !== null)
      throw new ApiError("invalid_response");
    return note;
  }
  const api = {
    async list(signal?: AbortSignal, cursor?: NotePage["nextCursor"]) {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", JSON.stringify(cursor));
      const page = await scoped(`/api/notes/?${params}`, notePageSchema, {
        signal,
      });
      page.items.forEach(owned);
      return page;
    },
    async read(id: string, signal?: AbortSignal) {
      z.uuid().parse(id);
      const result = owned(
        await scoped(`/api/notes/${id}/`, noteSchema, { signal }),
      );
      if (result.id !== id) throw new ApiError("invalid_response");
      return result;
    },
    async create(input: CreateNoteInput, operationId: string) {
      const body = createNoteSchema.parse(input);
      z.uuid().parse(operationId);
      return owned(
        await scoped("/api/notes/", noteSchema, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": operationId,
          },
          body: JSON.stringify(body),
        }),
      );
    },
    async update(id: string, input: UpdateNoteInput) {
      z.uuid().parse(id);
      const body = updateNoteSchema.parse(input);
      const result = owned(
        await scoped(`/api/notes/${id}/`, noteSchema, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      if (result.id !== id || result.revision !== input.expectedRevision + 1)
        throw new ApiError("uncertain");
      return result;
    },
    async remove(id: string, revision: number) {
      z.uuid().parse(id);
      const body = deleteNoteSchema.parse({ expectedRevision: revision });
      const result = await scoped(`/api/notes/${id}/`, noteSchema, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (
        result.id !== id ||
        result.userId !== scope.ownerId ||
        result.deletedAt === null ||
        result.revision !== revision + 1
      )
        throw new ApiError("uncertain");
    },
  };
  return api;
}
export type NotesApi = ReturnType<typeof createNotesApi>;
