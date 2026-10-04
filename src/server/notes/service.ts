import "server-only";
import {
  noteSchema,
  noteSummarySchema,
  notePageSchema,
  profileSchema,
  type ListNotesInput,
} from "../../features/notes/types";
import { HttpFailure } from "../http/errors";
import {
  type NoteOutcome,
  type NoteRow,
  createNoteRepository,
  type NoteRepository,
} from "./repository";
export function profileName(value: unknown): string | null {
  const parsed = profileSchema.shape.displayName.safeParse(value);
  return parsed.success ? parsed.data : null;
}
/** Explicit projection excludes immutable create keys/hashes from public JSON. */
export function normalizeNote(row: NoteRow) {
  return noteSchema.parse({
    id: row.id,
    userId: row.userId,
    title: row.title,
    content: row.content,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  });
}
export function resolveNote(outcome: NoteOutcome) {
  if (outcome.kind !== "note") throw new HttpFailure(outcome.kind);
  return {
    note: normalizeNote(outcome.row),
    created: outcome.created === true,
  };
}
export function createNoteService(
  repository: NoteRepository = createNoteRepository(),
) {
  return {
    create: async (...args: Parameters<NoteRepository["create"]>) =>
      resolveNote(await repository.create(...args)),
    detail: async (...args: Parameters<NoteRepository["detail"]>) =>
      resolveNote(await repository.detail(...args)).note,
    update: async (...args: Parameters<NoteRepository["update"]>) =>
      resolveNote(await repository.update(...args)).note,
    remove: async (...args: Parameters<NoteRepository["remove"]>) =>
      resolveNote(await repository.remove(...args)).note,
    async list(
      owner: Parameters<NoteRepository["list"]>[0],
      name: string | null,
      input: ListNotesInput,
    ) {
      const rows = await repository.list(owner, name, input);
      const items = rows
        .slice(0, input.limit)
        .map((row) =>
          noteSummarySchema.parse({
            ...row,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            deletedAt: row.deletedAt?.toISOString() ?? null,
          }),
        );
      const last = items.at(-1);
      return notePageSchema.parse({
        items,
        nextCursor:
          rows.length > input.limit && last
            ? { updatedAt: last.updatedAt, id: last.id }
            : null,
      });
    },
  };
}
